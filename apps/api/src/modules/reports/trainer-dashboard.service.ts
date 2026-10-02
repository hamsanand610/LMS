import { Injectable } from '@nestjs/common';
import {
  addDaysToDateKey,
  toLocalDateKey,
  zonedDateTimeToUtc,
  type TrainerDashboard,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { ForbiddenError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { publicationsReaching } from '../../core/scope/publication-reach.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { AttendanceService, attendancePercentage } from '../attendance/index.js';
import { AnnouncementsService } from '../notifications/index.js';
import { reviewableWhere } from '../assignments/index.js';
import { SESSION_INCLUDE, toSessionItem } from '../sessions/index.js';

/**
 * The trainer's day (plan DP-T01): today's classes with the roll call a click away, what is
 * waiting to be marked, how each batch is doing and who is slipping. Journey J-05 starts here.
 */
@Injectable()
export class TrainerDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
    private readonly attendance: AttendanceService,
    private readonly announcements: AnnouncementsService,
  ) {}

  async build(user: AuthUser): Promise<TrainerDashboard> {
    const org = await this.tenant.getOrganization();
    const person = await this.scope.personFor(user.id);
    // Only the batches they teach: a learner's own batches are not a trainer's view of them.
    if (!person.trainerId) throw new ForbiddenError('This page is for trainers');
    const batchIds = person.taughtBatchIds;

    if (batchIds.length === 0) {
      return {
        today: [],
        unmarked: [],
        grading: { assignments: 0, tests: 0 },
        batches: [],
        atRisk: [],
        announcements: [],
        courses: await this.courses(person.trainerId, []),
        deadlines: [],
      };
    }

    // Today and tomorrow in the institute's own time zone, not a window around the clock.
    const now = new Date();
    const todayKey = toLocalDateKey(now, org.timezone);
    const dayStart = zonedDateTimeToUtc(todayKey, '00:00', org.timezone);
    const dayEnd = zonedDateTimeToUtc(addDaysToDateKey(todayKey, 2), '00:00', org.timezone);

    const [today, unmarked, batches, assignmentQueue, testQueue, announcements, records] =
      await Promise.all([
        this.prisma.liveSession.findMany({
          where: { batchId: { in: batchIds }, startsAt: { gte: dayStart, lte: dayEnd } },
          include: SESSION_INCLUDE,
          orderBy: { startsAt: 'asc' },
          take: 10,
        }),
        this.prisma.liveSession.findMany({
          where: {
            batchId: { in: batchIds },
            status: 'completed',
            attendanceMarkedAt: null,
            ...(person.trainerId ? { trainerId: person.trainerId } : {}),
          },
          include: { batch: { select: { code: true } } },
          orderBy: { startsAt: 'desc' },
          take: 10,
        }),
        this.prisma.batch.findMany({
          where: { id: { in: batchIds }, organizationId: org.id, deletedAt: null },
          include: {
            _count: { select: { members: { where: { isActive: true } } } },
            members: { where: { isActive: true }, select: { studentId: true } },
          },
          orderBy: { startDate: 'desc' },
        }),
        // The same answers the review queue lists as waiting, so the two never disagree.
        this.prisma.submission.count({
          where: {
            status: 'awaiting_grading',
            reviewDecision: null,
            assignment: { deletedAt: null },
            AND: [await reviewableWhere(this.prisma, batchIds)],
          },
        }),
        this.prisma.testAnswer.count({
          where: {
            status: 'awaiting_grading',
            attempt: {
              status: { in: ['submitted', 'graded'] },
              schedule: { batchId: { in: batchIds } },
            },
          },
        }),
        // The ones meant for this trainer, by their audience, as the learner dashboard does.
        this.announcements.activeFor(user),
        this.prisma.attendanceRecord.findMany({
          where: { batchId: { in: batchIds } },
          select: { batchId: true, status: true },
        }),
      ]);

    const rules = await this.attendance.rules();
    const counted = new Set(rules.countedStatuses);
    const perBatch = new Map<string, { conducted: number; attended: number }>();
    for (const record of records) {
      const entry = perBatch.get(record.batchId) ?? { conducted: 0, attended: 0 };
      entry.conducted += 1;
      if (counted.has(record.status)) entry.attended += 1;
      perBatch.set(record.batchId, entry);
    }

    const health = await Promise.all(
      batches.map(async (batch) => {
        const studentIds = batch.members.map((m) => m.studentId);
        const attendance = perBatch.get(batch.id);
        return {
          id: batch.id,
          code: batch.code,
          name: batch.name,
          status: batch.status,
          students: batch._count.members,
          attendancePct: attendance
            ? attendancePercentage(attendance.attended, attendance.conducted)
            : null,
          assignmentCompletionPct: await this.assignmentCompletion(batch.id, studentIds),
          lastTestAveragePct: await this.lastTestAverage(batch.id),
        };
      }),
    );

    return {
      today: today.map((session) => toSessionItem(session, now)),
      unmarked: unmarked.map((session) => ({
        sessionId: session.id,
        subject: session.subject,
        batchCode: session.batch.code,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
      })),
      grading: { assignments: assignmentQueue, tests: testQueue },
      batches: health,
      atRisk: await this.attendance.lowAttendanceFor({ batchIds, limit: 8 }),
      announcements: announcements.slice(0, 3).map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        startsAt: a.startsAt,
      })),
      courses: await this.courses(person.trainerId, batchIds),
      deadlines: await this.deadlines(batchIds, now),
    };
  }

  /** The courses they are in charge of, then those their batches have (ADR-0023). */
  private async courses(
    trainerId: string,
    batchIds: string[],
  ): Promise<TrainerDashboard['courses']> {
    const reach = batchIds.length > 0 ? await publicationsReaching(this.prisma, batchIds) : null;
    const rows = await this.prisma.course.findMany({
      where: {
        deletedAt: null,
        status: { not: 'archived' },
        OR: [
          { staff: { some: { trainerId } } },
          ...(reach ? [{ publications: { some: reach } }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        staff: { where: { trainerId }, select: { trainerId: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    });
    return rows
      .map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        inCharge: row.staff.length > 0,
      }))
      .sort((a, b) => Number(b.inCharge) - Number(a.inCharge))
      .slice(0, 8);
  }

  /** Assignments due and test windows closing in the next seven days, soonest first. */
  private async deadlines(batchIds: string[], now: Date): Promise<TrainerDashboard['deadlines']> {
    const until = new Date(now.getTime() + 7 * 86_400_000);
    const [assignments, tests] = await Promise.all([
      this.prisma.assignmentPublication.findMany({
        where: {
          batchId: { in: batchIds },
          withdrawnAt: null,
          dueAt: { gte: now, lte: until },
          assignment: { deletedAt: null, status: 'published' },
        },
        select: {
          dueAt: true,
          assignment: { select: { id: true, title: true } },
          batch: { select: { code: true } },
        },
      }),
      this.prisma.testSchedule.findMany({
        where: {
          batchId: { in: batchIds },
          closesAt: { gte: now, lte: until },
          test: { deletedAt: null, status: 'published' },
        },
        select: {
          closesAt: true,
          test: { select: { id: true, title: true } },
          batch: { select: { code: true } },
        },
      }),
    ]);
    return [
      ...assignments.map((row) => ({
        kind: 'assignment' as const,
        id: row.assignment.id,
        title: row.assignment.title,
        batchCode: row.batch?.code ?? '',
        at: row.dueAt!.toISOString(),
      })),
      ...tests.map((row) => ({
        kind: 'test' as const,
        id: row.test.id,
        title: row.test.title,
        batchCode: row.batch.code,
        at: row.closesAt.toISOString(),
      })),
    ]
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(0, 8);
  }

  /** Answers given as a share of what this batch's live assignments ask for. */
  private async assignmentCompletion(
    batchId: string,
    studentIds: string[],
  ): Promise<number | null> {
    if (studentIds.length === 0) return null;
    const publications = await this.prisma.assignmentPublication.findMany({
      where: { batchId, withdrawnAt: null },
      include: {
        assignment: {
          select: { id: true, modules: { select: { _count: { select: { questions: true } } } } },
        },
      },
    });
    if (publications.length === 0) return null;

    let possible = 0;
    for (const publication of publications) {
      const questions = publication.assignment.modules.reduce((t, m) => t + m._count.questions, 0);
      possible += questions * studentIds.length;
    }
    if (possible === 0) return null;

    const submissions = await this.prisma.submission.findMany({
      where: {
        assignmentId: { in: publications.map((p) => p.assignmentId) },
        studentId: { in: studentIds },
      },
      select: { studentId: true, assignmentQuestionId: true },
    });
    const answered = new Set(submissions.map((s) => `${s.studentId}:${s.assignmentQuestionId}`))
      .size;
    return Math.min(100, Math.round((answered / possible) * 100));
  }

  /** The mean score of the most recent test this batch sat. */
  private async lastTestAverage(batchId: string): Promise<number | null> {
    const schedule = await this.prisma.testSchedule.findFirst({
      where: { batchId, attempts: { some: { status: { in: ['submitted', 'graded'] } } } },
      orderBy: { opensAt: 'desc' },
      include: {
        attempts: {
          where: { status: { in: ['submitted', 'graded'] } },
          select: { score: true, totalMarks: true },
        },
      },
    });
    if (!schedule) return null;
    const scored = schedule.attempts.filter((attempt) => attempt.totalMarks > 0);
    if (scored.length === 0) return null;
    return Math.round(
      scored.reduce((total, a) => total + (Number(a.score) / a.totalMarks) * 100, 0) /
        scored.length,
    );
  }
}
