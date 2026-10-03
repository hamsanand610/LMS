import { Injectable } from '@nestjs/common';
import {
  LEADERBOARD_POINTS,
  addDaysToDateKey,
  toLocalDateKey,
  weekdayOfDateKey,
  zonedDateTimeToUtc,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  type LeaderboardQuery,
  type LeaderboardResponse,
} from '@lms/shared';
import { type AuthUser, scopeFor } from '../../core/auth/auth-user.js';
import { ForbiddenError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { batchesOf, ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { ACCEPTED_PRACTICE_RUN } from '../execution/index.js';

const WEEKDAY_OFFSET: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

export const LEADERBOARD_RULES = [
  `${LEADERBOARD_POINTS.lessonCompleted} points for every lesson you complete.`,
  'A practice problem’s own points (10 unless the author set otherwise) the first time you solve it.',
  'The marks awarded for your assignment answers — your best answer to each question.',
  'Your score in a test once its results are released.',
  'Only work done in the chosen period counts. The board covers your own batch, and shows first names and initials only.',
];

interface Row {
  studentId: string;
  userId: string;
  name: string;
  lessons: number;
  practice: number;
  assignments: number;
  tests: number;
}

/**
 * The points leaderboard (ADR-0014). Everything is counted on read from recorded work — lesson
 * completions, first accepted practice solutions, awarded assignment marks, released test scores —
 * so the board can never disagree with the pages that show that work.
 */
@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
  ) {}

  async board(
    user: AuthUser,
    query: LeaderboardQuery,
    now = new Date(),
  ): Promise<LeaderboardResponse> {
    const org = await this.tenant.getOrganization();
    const person = await this.scope.personFor(user.id);
    const scope = scopeFor(user, 'leaderboard:read');
    if (!scope) throw new ForbiddenError('You cannot see the leaderboard');

    // Which batches the caller may look at: those they learn in or teach, or every batch for
    // institute-wide staff. A board shows a learner and a trainer the same thing.
    // A learner's own scope is the batches they learn in; a trainer's is those they teach as well.
    const batchWhere =
      person.studentId || scope !== 'all'
        ? { id: { in: scope === 'own' ? person.memberBatchIds : batchesOf(person, user) } }
        : { organizationId: org.id, deletedAt: null };
    const batches = await this.prisma.batch.findMany({
      where: batchWhere,
      select: { id: true, code: true, name: true, status: true },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    });
    const preferred =
      batches.find((b) => b.id === query.batchId) ??
      batches.find((b) => b.status === 'running') ??
      batches[0] ??
      null;

    const from = periodStart(query.period, now, org.timezone);
    const base = {
      period: query.period,
      from: from?.dateKey ?? null,
      batches: batches.map(({ id, code, name }) => ({ id, code, name })),
      rules: LEADERBOARD_RULES,
    };
    if (!preferred) {
      return { ...base, batch: null, total: 0, entries: [], you: null };
    }

    const members = await this.prisma.batchMember.findMany({
      where: { batchId: preferred.id, isActive: true },
      select: {
        studentId: true,
        student: { select: { userId: true, user: { select: { name: true } } } },
      },
    });
    const rows = new Map<string, Row>(
      members.map((m) => [
        m.studentId,
        {
          studentId: m.studentId,
          userId: m.student.userId,
          name: m.student.user.name,
          lessons: 0,
          practice: 0,
          assignments: 0,
          tests: 0,
        },
      ]),
    );
    const studentIds = [...rows.keys()];
    const byUser = new Map([...rows.values()].map((r) => [r.userId, r]));
    const since = from?.instant;

    const [lessons, runs, submissions, attempts] = await Promise.all([
      this.prisma.lessonProgress.groupBy({
        by: ['studentId'],
        where: {
          studentId: { in: studentIds },
          status: 'completed',
          ...(since ? { completedAt: { gte: since } } : {}),
        },
        _count: { _all: true },
      }),
      this.prisma.executionRun.findMany({
        where: { userId: { in: [...byUser.keys()] }, ...ACCEPTED_PRACTICE_RUN },
        select: {
          userId: true,
          questionId: true,
          createdAt: true,
          question: { select: { practicePoints: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.submission.findMany({
        where: {
          studentId: { in: studentIds },
          status: { in: ['correct', 'partial'] },
          ...(since ? { submittedAt: { gte: since } } : {}),
        },
        select: { studentId: true, assignmentQuestionId: true, marks: true },
      }),
      this.prisma.testAttempt.findMany({
        where: {
          studentId: { in: studentIds },
          status: { in: ['submitted', 'graded'] },
          ...(since ? { submittedAt: { gte: since } } : {}),
        },
        select: {
          studentId: true,
          scheduleId: true,
          score: true,
          schedule: { select: { releasedAt: true } },
          test: { select: { settings: true } },
        },
      }),
    ]);

    for (const group of lessons) {
      const row = rows.get(group.studentId);
      if (row) row.lessons = group._count._all * LEADERBOARD_POINTS.lessonCompleted;
    }

    // A problem pays out once: on the first accepted solution, if that fell inside the period.
    const firstSolved = new Set<string>();
    for (const run of runs) {
      if (!run.userId || !run.questionId) continue;
      const key = `${run.userId}:${run.questionId}`;
      if (firstSolved.has(key)) continue;
      firstSolved.add(key);
      if (since && run.createdAt < since) continue;
      const row = byUser.get(run.userId);
      if (row) row.practice += run.question?.practicePoints ?? 0;
    }

    const bestAnswer = new Map<string, number>();
    for (const submission of submissions) {
      const key = `${submission.studentId}:${submission.assignmentQuestionId}`;
      bestAnswer.set(key, Math.max(bestAnswer.get(key) ?? 0, Number(submission.marks)));
    }
    for (const [key, marks] of bestAnswer) {
      const row = rows.get(key.split(':')[0] ?? '');
      if (row) row.assignments += marks;
    }

    // A score counts once its result is out: released by staff, or shown at once by the test's policy.
    // Each test counts once, at the learner's best attempt, as answers do: retaking a test must not
    // multiply its points.
    const bestTest = new Map<string, number>();
    for (const attempt of attempts) {
      const policy = (attempt.test.settings as { resultPolicy?: string } | null)?.resultPolicy;
      if (!attempt.schedule.releasedAt && policy !== 'immediately') continue;
      const key = `${attempt.studentId}:${attempt.scheduleId}`;
      bestTest.set(key, Math.max(bestTest.get(key) ?? 0, Number(attempt.score)));
    }
    for (const [key, score] of bestTest) {
      const row = rows.get(key.split(':')[0] ?? '');
      if (row) row.tests += score;
    }

    const ranked = [...rows.values()]
      .map((row) => ({
        row,
        points: Math.round(row.lessons + row.practice + row.assignments + row.tests),
      }))
      .sort((a, b) => b.points - a.points || a.row.name.localeCompare(b.row.name));

    let rank = 0;
    let previous: number | null = null;
    const entries: LeaderboardEntry[] = ranked.map(({ row, points }, index) => {
      if (points !== previous) {
        rank = index + 1;
        previous = points;
      }
      return {
        rank,
        studentId: row.studentId,
        displayName: shortName(row.name),
        initials: initialsOf(row.name),
        points,
        breakdown: {
          lessons: Math.round(row.lessons),
          practice: Math.round(row.practice),
          assignments: Math.round(row.assignments),
          tests: Math.round(row.tests),
        },
        isYou: row.studentId === person.studentId,
      };
    });

    const shown = entries.slice(0, query.limit);
    const mine = entries.find((e) => e.isYou) ?? null;
    return {
      ...base,
      batch: { id: preferred.id, code: preferred.code, name: preferred.name },
      total: entries.length,
      entries: shown,
      you: mine && !shown.includes(mine) ? mine : null,
    };
  }
}

/** The start of the chosen period in the institute's zone, or null for all time. */
function periodStart(
  period: LeaderboardPeriod,
  now: Date,
  zone: string,
): { dateKey: string; instant: Date } | null {
  if (period === 'all') return null;
  const today = toLocalDateKey(now, zone);
  const dateKey =
    period === 'week'
      ? addDaysToDateKey(today, -(WEEKDAY_OFFSET[weekdayOfDateKey(today)] ?? 0))
      : `${today.slice(0, 8)}01`;
  return { dateKey, instant: zonedDateTimeToUtc(dateKey, '00:00', zone) };
}

/** "Diya Das" → "Diya D."; a single name stays as it is. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? 'Learner';
  return `${parts[0]} ${parts.at(-1)?.[0]?.toUpperCase() ?? ''}.`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}
