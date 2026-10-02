import { Injectable } from '@nestjs/common';
import {
  addDaysToDateKey,
  dateKeysBetween,
  toLocalDateKey,
  type ActivityDay,
  type AdherenceDay,
  type AdherenceSummary,
  type LearningConsistency,
  type StreakSummary,
} from '@lms/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { AttendanceService } from '../attendance/index.js';

/** How far back the heatmap and the longest streak look. */
const HISTORY_DAYS = 365;
/** The adherence window. */
const ADHERENCE_DAYS = 30;

export const ACTIVITY_RULES = [
  'Completing a lesson',
  'Submitting an answer to an assignment question',
  'Submitting a practice solution',
  'Submitting a test',
];

const STREAK_RULE =
  'Your streak is the number of days in a row, ending today, on which you did at least one learning activity. Until you do something today it still stands on yesterday. Days are counted in the institute’s time zone.';

const ADHERENCE_RULE =
  'Adherence is measured on class days: days your batch had a class whose roll call has been taken. The daily target is to attend every marked class that day and do at least one learning activity. Adherence is the share of the last 30 class days on which you met both.';

/**
 * Consistency measures — the learning streak, the practice streak and daily adherence (ADR-0014).
 * Everything is computed on read from records that already exist: lesson completions, assignment
 * answers, practice submissions, test submissions and attendance marks. Nothing is stored twice,
 * so these figures cannot drift from the pages that show the underlying work.
 */
@Injectable()
export class ConsistencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly attendance: AttendanceService,
  ) {}

  async forStudent(
    student: { id: string; userId: string },
    now: Date = new Date(),
  ): Promise<LearningConsistency> {
    const org = await this.tenant.getOrganization();
    const zone = org.timezone;
    const today = toLocalDateKey(now, zone);
    const firstDay = addDaysToDateKey(today, -(HISTORY_DAYS - 1));
    // A little earlier than the first day's midnight in any zone, then filtered by date key.
    const since = new Date(`${addDaysToDateKey(firstDay, -1)}T00:00:00Z`);

    const [lessons, answers, practice, tests] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { studentId: student.id, status: 'completed', completedAt: { gte: since } },
        select: { completedAt: true },
      }),
      this.prisma.submission.findMany({
        where: { studentId: student.id, submittedAt: { gte: since } },
        select: { submittedAt: true },
      }),
      this.prisma.executionRun.findMany({
        where: { userId: student.userId, context: 'practice', createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.testAttempt.findMany({
        where: {
          studentId: student.id,
          status: { not: 'in_progress' },
          // A paper the server submitted at the deadline is not something the learner did that day.
          autoSubmitted: false,
          submittedAt: { gte: since },
        },
        select: { submittedAt: true },
      }),
    ]);

    const learning = new Map<string, number>();
    const practiceDays = new Map<string, number>();
    const bump = (map: Map<string, number>, at: Date | null) => {
      if (!at) return;
      const key = toLocalDateKey(at, zone);
      if (key < firstDay || key > today) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    };
    for (const row of lessons) bump(learning, row.completedAt);
    for (const row of answers) bump(learning, row.submittedAt);
    for (const row of tests) bump(learning, row.submittedAt);
    for (const row of practice) {
      bump(learning, row.createdAt);
      bump(practiceDays, row.createdAt);
    }

    const days: ActivityDay[] = dateKeysBetween(firstDay, today).map((date) => ({
      date,
      count: learning.get(date) ?? 0,
    }));

    const streak = streakFrom(days, today);
    const practiceStreak = streakFrom(
      dateKeysBetween(firstDay, today).map((date) => ({
        date,
        count: practiceDays.get(date) ?? 0,
      })),
      today,
    );

    return {
      streak,
      practiceStreak: {
        current: practiceStreak.current,
        longest: practiceStreak.longest,
        activeToday: practiceStreak.activeToday,
      },
      adherence: await this.adherence(student.id, today, zone, learning, now),
      definitions: { activity: ACTIVITY_RULES, streak: STREAK_RULE, adherence: ADHERENCE_RULE },
    };
  }

  /**
   * Class days are days with at least one marked class on the learner's roster; a day is met when
   * every one of them was attended (by the institute's counted statuses) and the learner did at
   * least one learning activity. Cancelled classes and classes nobody marked do not count.
   */
  private async adherence(
    studentId: string,
    today: string,
    zone: string,
    learning: Map<string, number>,
    now: Date,
  ): Promise<AdherenceSummary> {
    const rules = await this.attendance.rules();
    const windowStart = addDaysToDateKey(today, -(ADHERENCE_DAYS - 1));
    const since = new Date(`${addDaysToDateKey(windowStart, -1)}T00:00:00Z`);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        session: { startsAt: { gte: since, lte: now }, status: { not: 'cancelled' } },
      },
      select: { status: true, session: { select: { startsAt: true } } },
    });

    const byDay = new Map<string, { marked: number; attended: number }>();
    for (const record of records) {
      const key = toLocalDateKey(record.session.startsAt, zone);
      if (key < windowStart || key > today) continue;
      const day = byDay.get(key) ?? { marked: 0, attended: 0 };
      day.marked += 1;
      if (rules.countedStatuses.includes(record.status)) day.attended += 1;
      byDay.set(key, day);
    }

    const days: AdherenceDay[] = [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, day]) => {
        const activities = learning.get(date) ?? 0;
        const attendedAll = day.attended === day.marked;
        const status =
          attendedAll && activities > 0
            ? ('met' as const)
            : day.attended === 0 && activities === 0
              ? ('missed' as const)
              : ('partial' as const);
        return {
          date,
          status,
          classesMarked: day.marked,
          classesAttended: day.attended,
          activities,
        };
      });

    const metDays = days.filter((d) => d.status === 'met').length;
    const partialDays = days.filter((d) => d.status === 'partial').length;
    const missedDays = days.filter((d) => d.status === 'missed').length;

    // Today's target: every class on the learner's timetable today, and one learning activity.
    const memberships = await this.prisma.batchMember.findMany({
      where: { studentId, isActive: true },
      select: { batchId: true },
    });
    const dayStart = new Date(`${addDaysToDateKey(today, -1)}T00:00:00Z`);
    const dayEnd = new Date(`${addDaysToDateKey(today, 1)}T23:59:59Z`);
    const sessions =
      memberships.length === 0
        ? []
        : await this.prisma.liveSession.findMany({
            where: {
              batchId: { in: memberships.map((m) => m.batchId) },
              startsAt: { gte: dayStart, lte: dayEnd },
              status: { not: 'cancelled' },
            },
            select: { startsAt: true },
          });
    const todayMarks = byDay.get(today) ?? { marked: 0, attended: 0 };

    return {
      percentage: days.length === 0 ? null : Math.round((metDays / days.length) * 100),
      windowDays: ADHERENCE_DAYS,
      measuredDays: days.length,
      metDays,
      partialDays,
      missedDays,
      today: {
        classesScheduled: sessions.filter((s) => toLocalDateKey(s.startsAt, zone) === today).length,
        classesMarked: todayMarks.marked,
        classesAttended: todayMarks.attended,
        activityDone: (learning.get(today) ?? 0) > 0,
      },
      days,
    };
  }
}

/** Current and longest runs of active days. `days` is oldest first and ends today. */
export function streakFrom(days: ActivityDay[], today: string): StreakSummary {
  const active = new Set(days.filter((d) => d.count > 0).map((d) => d.date));
  const activeToday = active.has(today);

  let current = 0;
  let cursor = activeToday ? today : addDaysToDateKey(today, -1);
  while (active.has(cursor)) {
    current += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  for (const day of days) {
    run = day.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  const lastActive = [...active].sort().at(-1) ?? null;
  return {
    current,
    longest,
    activeToday,
    activeDays: active.size,
    lastActiveOn: lastActive,
    days,
  };
}
