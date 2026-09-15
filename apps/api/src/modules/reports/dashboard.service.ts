import { Injectable } from '@nestjs/common';
import type {
  DashboardAttentionItem,
  DashboardCourseRow,
  DashboardMetric,
  DashboardPoint,
  DashboardResponse,
} from '@lms/shared';
import { toLocalDateKey } from '@lms/shared';
import { type AuthUser, hasPermission } from '../../core/auth/auth-user.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { AttendanceService, attendancePercentage } from '../attendance/index.js';

/**
 * The admin dashboard (plan DP-A01). Every tile the customer's screenshot showed is either a
 * figure this build can measure or a placeholder naming the module that would supply it, so the
 * page never shows an invented number. Each one carries its own definition.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
    private readonly attendance: AttendanceService,
    private readonly jobs: JobsService,
  ) {}

  async build(
    user: AuthUser,
    query: {
      from?: string;
      to?: string;
      programId?: string;
      batchId?: string;
      courseId?: string;
      trainerId?: string;
    },
  ): Promise<DashboardResponse> {
    const org = await this.tenant.getOrganization();
    const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date();
    const from = query.from
      ? new Date(`${query.from}T00:00:00.000Z`)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const visible = await this.scope.visibleBatchIds(user, 'reports:read');

    const batchFilter = {
      ...(visible === null ? {} : { id: { in: visible } }),
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.batchId ? { id: query.batchId } : {}),
      ...(query.trainerId ? { trainers: { some: { trainerId: query.trainerId } } } : {}),
    };
    const batchRows = await this.prisma.batch.findMany({
      where: { organizationId: org.id, deletedAt: null, ...batchFilter },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { members: { where: { isActive: true } } } } },
    });
    const batchIds = batchRows.map((b) => b.id);
    const memberFilter = { isActive: true, batchId: { in: batchIds } };

    const [
      totalStudents,
      active7,
      active30,
      newStudents,
      trainerRows,
      recent,
      attendanceRecords,
      enrolments,
      attempts,
      submissionRows,
    ] = await this.prisma.$transaction([
      this.prisma.batchMember.count({ where: memberFilter }),
      this.prisma.batchMember.count({
        where: { ...memberFilter, student: { user: { lastLoginAt: { gte: daysBefore(to, 7) } } } },
      }),
      this.prisma.batchMember.count({
        where: { ...memberFilter, student: { user: { lastLoginAt: { gte: daysBefore(to, 30) } } } },
      }),
      this.prisma.batchMember.count({
        where: { ...memberFilter, student: { createdAt: { gte: from, lte: to } } },
      }),
      this.prisma.batchTrainer.findMany({
        where: { batchId: { in: batchIds } },
        select: { trainerId: true },
        distinct: ['trainerId'],
      }),
      this.prisma.studentProfile.findMany({
        where: {
          user: { organizationId: org.id, deletedAt: null },
          members: { some: memberFilter },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true } } },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { batchId: { in: batchIds }, session: { startsAt: { gte: from, lte: to } } },
        select: { status: true, batchId: true, session: { select: { startsAt: true } } },
      }),
      this.prisma.enrollment.findMany({
        where: {
          student: { members: { some: memberFilter } },
          ...(query.courseId ? { courseId: query.courseId } : {}),
        },
        select: {
          progressPct: true,
          status: true,
          courseId: true,
          course: { select: { title: true } },
        },
      }),
      this.prisma.testAttempt.findMany({
        where: {
          status: { in: ['submitted', 'graded'] },
          schedule: { batchId: { in: batchIds } },
          submittedAt: { gte: from, lte: to },
        },
        select: { score: true, totalMarks: true },
      }),
      this.prisma.submission.findMany({
        where: { student: { members: { some: memberFilter } } },
        select: { studentId: true, assignmentQuestionId: true, assignmentId: true },
      }),
    ]);

    const rules = await this.attendance.rules();
    const counted = new Set(rules.countedStatuses);

    // Attendance, overall and per batch and per day.
    let conducted = 0;
    let attended = 0;
    const perBatch = new Map<string, { conducted: number; attended: number }>();
    const perDay = new Map<string, { conducted: number; attended: number }>();
    for (const record of attendanceRecords) {
      const isAttended = counted.has(record.status);
      conducted += 1;
      if (isAttended) attended += 1;

      const batch = perBatch.get(record.batchId) ?? { conducted: 0, attended: 0 };
      batch.conducted += 1;
      if (isAttended) batch.attended += 1;
      perBatch.set(record.batchId, batch);

      const day = toLocalDateKey(record.session.startsAt, org.timezone);
      const dayEntry = perDay.get(day) ?? { conducted: 0, attended: 0 };
      dayEntry.conducted += 1;
      if (isAttended) dayEntry.attended += 1;
      perDay.set(day, dayEntry);
    }

    // Course completion, overall and per course.
    const perCourse = new Map<
      string,
      { title: string; enrolled: number; completed: number; sum: number }
    >();
    for (const enrolment of enrolments) {
      const entry = perCourse.get(enrolment.courseId) ?? {
        title: enrolment.course.title,
        enrolled: 0,
        completed: 0,
        sum: 0,
      };
      entry.enrolled += 1;
      entry.sum += enrolment.progressPct;
      if (enrolment.status === 'completed') entry.completed += 1;
      perCourse.set(enrolment.courseId, entry);
    }
    const completionPct =
      enrolments.length > 0
        ? Math.round(enrolments.reduce((total, e) => total + e.progressPct, 0) / enrolments.length)
        : null;

    // Assessment average across the tests submitted in the range.
    const scored = attempts.filter((attempt) => attempt.totalMarks > 0);
    const assessmentAverage =
      scored.length > 0
        ? Math.round(
            scored.reduce(
              (total, attempt) => total + (Number(attempt.score) / attempt.totalMarks) * 100,
              0,
            ) / scored.length,
          )
        : null;

    // Assignment status: answers given as a share of the answers the published work asks for.
    const assignmentCompletion = await this.assignmentCompletion(batchIds, submissionRows);

    const runningBatches = batchRows.filter((b) => b.status === 'running').length;
    const metrics: DashboardMetric[] = [
      metric('students.total', 'Students', totalStudents, 'count', {
        definition: 'Active memberships across the batches in the filter (CR-A01).',
      }),
      metric('students.active_7d', 'Active in 7 days', active7, 'count', {
        definition: 'Students who signed in within seven days of the end of the range (CR-A02).',
      }),
      metric('students.active_30d', 'Active in 30 days', active30, 'count', {
        definition: 'Students who signed in within thirty days of the end of the range (CR-A02).',
      }),
      metric('students.new', 'Added in range', newStudents, 'count', {
        definition: 'Student records created between the selected dates.',
      }),
      metric('batches.running', 'Running batches', runningBatches, 'count', {
        definition: 'Batches whose status is "running" (CR-A03).',
      }),
      metric('courses.published', 'Courses in progress', perCourse.size, 'count', {
        definition: 'Courses at least one of these students is enrolled in (CR-A04).',
      }),
      metric(
        'attendance.percentage',
        'Attendance',
        attendancePercentage(attended, conducted),
        'percent',
        {
          definition: `Attended ÷ marked classes in the range, counting ${rules.countedStatuses.join(', ')} (CR-A05).`,
        },
      ),
      metric('progress.completion', 'Course completion', completionPct, 'percent', {
        definition: 'Mean progress across every enrolment in scope (CR-A06).',
      }),
      metric('assessments.average', 'Assessment average', assessmentAverage, 'percent', {
        definition: 'Mean score of the test papers submitted in the range (CR-A07).',
      }),
      metric('assignments.completion', 'Assignment completion', assignmentCompletion, 'percent', {
        definition:
          'Answers given as a share of the answers published assignments ask for (CR-A08).',
      }),
      metric('trainers.assigned', 'Trainers assigned', trainerRows.length, 'count', {
        definition: 'Distinct trainers assigned to the batches in the filter.',
      }),
      pending(
        'projects.status',
        'Project status',
        'count',
        'The projects module is not in the demo (CR-A09).',
      ),
      pending(
        'trainers.performance',
        'Trainer performance',
        'percent',
        'Needs student feedback, which is not in the demo (CR-A10).',
      ),
      pending(
        'placements.status',
        'Placement status',
        'count',
        'The placement module is not in the demo (CR-A11).',
      ),
      pending(
        'placements.companies',
        'Company-wise placements',
        'count',
        'The placement module is not in the demo (CR-A12).',
      ),
      pending(
        'certificates.issued',
        'Certificates issued',
        'count',
        'The certificates module is not in the demo (CR-A13).',
      ),
      pending(
        'feedback.rating',
        'Student feedback',
        'percent',
        'The feedback module is not in the demo (CR-A14).',
      ),
    ];

    const courses: DashboardCourseRow[] = [...perCourse.entries()]
      .map(([id, entry]) => ({
        id,
        title: entry.title,
        enrolled: entry.enrolled,
        completed: entry.completed,
        completionPct: entry.enrolled > 0 ? Math.round(entry.sum / entry.enrolled) : null,
      }))
      .sort((a, b) => b.enrolled - a.enrolled)
      .slice(0, 8);

    return {
      asOf: new Date().toISOString(),
      range: { from: dateKey(from), to: dateKey(to) },
      metrics,
      batches: batchRows.slice(0, 8).map((batch) => {
        const entry = perBatch.get(batch.id);
        return {
          id: batch.id,
          code: batch.code,
          name: batch.name,
          status: batch.status,
          studentCount: batch._count.members,
          capacity: batch.capacity,
          startDate: dateKey(batch.startDate),
          attendancePct: entry ? attendancePercentage(entry.attended, entry.conducted) : null,
        };
      }),
      courses,
      recentStudents: recent.map((s) => ({
        id: s.id,
        name: s.user.name,
        studentCode: s.studentCode,
        createdAt: s.createdAt.toISOString(),
      })),
      charts: {
        activeStudents: await this.activeStudentsTrend(batchIds, from, to, org.timezone),
        attendance: fillDays(from, to, org.timezone, (day) => {
          const entry = perDay.get(day);
          return entry ? attendancePercentage(entry.attended, entry.conducted) : null;
        }),
      },
      attention: await this.attention(user, batchIds, rules.thresholdPct),
    };
  }

  /** Answers given as a share of the answers every live publication asks of its batch. */
  private async assignmentCompletion(
    batchIds: string[],
    submissions: { studentId: string; assignmentQuestionId: string; assignmentId: string }[],
  ): Promise<number | null> {
    if (batchIds.length === 0) return null;
    const publications = await this.prisma.assignmentPublication.findMany({
      where: { withdrawnAt: null, batchId: { in: batchIds } },
      include: {
        assignment: {
          select: { id: true, modules: { select: { _count: { select: { questions: true } } } } },
        },
        batch: { select: { _count: { select: { members: { where: { isActive: true } } } } } },
      },
    });
    if (publications.length === 0) return null;

    let possible = 0;
    const assignmentIds = new Set<string>();
    for (const publication of publications) {
      const questions = publication.assignment.modules.reduce((t, m) => t + m._count.questions, 0);
      possible += questions * publication.batch._count.members;
      assignmentIds.add(publication.assignmentId);
    }
    if (possible === 0) return null;

    const answered = new Set(
      submissions
        .filter((s) => assignmentIds.has(s.assignmentId))
        .map((s) => `${s.studentId}:${s.assignmentQuestionId}`),
    ).size;
    return Math.min(100, Math.round((answered / possible) * 100));
  }

  /** Distinct students who did something each day, from the activity feed. */
  private async activeStudentsTrend(
    batchIds: string[],
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<DashboardPoint[]> {
    if (batchIds.length === 0) return fillDays(from, to, timezone, () => null);
    const events = await this.prisma.activityEvent.findMany({
      where: {
        occurredAt: { gte: from, lte: to },
        user: {
          studentProfile: { members: { some: { batchId: { in: batchIds }, isActive: true } } },
        },
      },
      select: { userId: true, occurredAt: true },
    });
    const perDay = new Map<string, Set<string>>();
    for (const event of events) {
      const day = toLocalDateKey(event.occurredAt, timezone);
      const set = perDay.get(day) ?? new Set<string>();
      set.add(event.userId);
      perDay.set(day, set);
    }
    return fillDays(from, to, timezone, (day) => perDay.get(day)?.size ?? 0);
  }

  /** The attention band: counts that each link to the rows behind them. */
  private async attention(
    user: AuthUser,
    batchIds: string[],
    thresholdPct: number,
  ): Promise<DashboardAttentionItem[]> {
    const items: DashboardAttentionItem[] = [];

    const [unmarked, pendingDocs, awaitingMarking] = await Promise.all([
      this.prisma.liveSession.count({
        where: { status: 'completed', attendanceMarkedAt: null, batchId: { in: batchIds } },
      }),
      hasPermission(user, 'students:verify_documents')
        ? this.prisma.document.count({ where: { status: 'pending' } })
        : Promise.resolve(0),
      this.prisma.submission.count({
        where: {
          status: 'awaiting_grading',
          student: { members: { some: { batchId: { in: batchIds }, isActive: true } } },
        },
      }),
    ]);

    if (unmarked > 0) {
      items.push({
        key: 'attendance.unmarked',
        label: 'Classes without a roll call',
        count: unmarked,
        route: '/admin/attendance?state=unmarked',
        tone: 'warning',
        description: 'Classes that finished and have not been marked.',
      });
    }

    const lowAttendance = await this.attendance.lowAttendanceFor({
      batchIds: batchIds.length > 0 ? batchIds : undefined,
      limit: 200,
    });
    if (lowAttendance.length > 0) {
      items.push({
        key: 'attendance.low',
        label: `Students below ${thresholdPct}% attendance`,
        count: lowAttendance.length,
        route: '/admin/reports/attendance',
        tone: 'danger',
        description: 'Attendance is the earliest sign that somebody is drifting away.',
      });
    }
    if (awaitingMarking > 0) {
      items.push({
        key: 'assignments.grading',
        label: 'Answers awaiting marking',
        count: awaitingMarking,
        route: '/admin/assignments',
        tone: 'info',
        description: 'Written answers a person still has to read.',
      });
    }
    if (pendingDocs > 0) {
      items.push({
        key: 'students.documents',
        label: 'Documents to verify',
        count: pendingDocs,
        route: '/admin/students?verification=pending',
        tone: 'info',
        description: 'Uploaded documents waiting for a decision.',
      });
    }

    if (hasPermission(user, 'settings:manage')) {
      const stats = await this.jobs.stats();
      if (stats.failed > 0) {
        items.push({
          key: 'jobs.failed',
          label: 'Failed background jobs',
          count: stats.failed,
          route: '/admin/settings/system-health',
          tone: 'danger',
          description: 'Jobs that gave up; they can be retried from system health.',
        });
      }
    }
    return items;
  }
}

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** One point per day of the range, so a chart has no gaps to interpolate across. */
function fillDays(
  from: Date,
  to: Date,
  timezone: string,
  valueFor: (day: string) => number | null,
): DashboardPoint[] {
  const points: DashboardPoint[] = [];
  const cursor = new Date(from.getTime());
  // A long range as daily points is unreadable and slow; 120 days is about half a programme.
  for (let guard = 0; cursor <= to && guard < 120; guard += 1) {
    const day = toLocalDateKey(cursor, timezone);
    points.push({ date: day, value: valueFor(day) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

function metric(
  key: string,
  label: string,
  value: number | null,
  unit: 'count' | 'percent',
  extra: { definition: string; delta?: number | null },
): DashboardMetric {
  return {
    key,
    label,
    value,
    unit,
    delta: extra.delta ?? null,
    definition: extra.definition,
    pending: null,
  };
}

function pending(
  key: string,
  label: string,
  unit: 'count' | 'percent',
  reason: string,
): DashboardMetric {
  return { key, label, value: null, unit, delta: null, definition: reason, pending: reason };
}
