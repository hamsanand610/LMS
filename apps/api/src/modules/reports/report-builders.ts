import type {
  AttendanceStatus,
  ReportChart,
  ReportColumn,
  ReportDefinition,
  ReportDescriptor,
  ReportFilter,
  ReportName,
  ReportRow,
  ReportTile,
} from '@lms/shared';
import { FEEDBACK_MIN_RESPONSES, type PermissionScope, toLocalDateKey } from '@lms/shared';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import { publicationsReaching } from '../../core/scope/publication-reach.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { attendancePercentage } from '../attendance/index.js';

/**
 * Everything a report needs to build its rows. The batch set has already been narrowed by the
 * caller's scope and by the filter bar, so no builder repeats that reasoning.
 */
export interface ReportContext {
  prisma: PrismaService;
  organizationId: string;
  timezone: string;
  /** null means every batch in the institute. */
  batchIds: string[] | null;
  /** Who is asking, for the reports whose rows depend on it (feedback, trainers, placements). */
  viewer: {
    userId: string;
    trainerId: string | null;
    scopeOf(key: string): PermissionScope | null;
  };
  filter: ReportFilter;
  from: Date | null;
  to: Date | null;
  rules: { countedStatuses: AttendanceStatus[]; thresholdPct: number };
}

export interface ReportResult {
  rows: ReportRow[];
  summary: ReportTile[];
  chart: ReportChart | null;
}

export interface ReportBuilder {
  descriptor: ReportDescriptor;
  columns: ReportColumn[];
  definitions: ReportDefinition[];
  /** `-field` sorts descending. The web sends the same syntax. */
  defaultSort: string;
  build(ctx: ReportContext): Promise<ReportResult>;
}

function column(
  key: string,
  label: string,
  type: ReportColumn['type'],
  options: { sortable?: boolean; optional?: boolean } = {},
): ReportColumn {
  return {
    key,
    label,
    type,
    sortable: options.sortable ?? true,
    optional: options.optional ?? false,
  };
}

function tile(
  key: string,
  label: string,
  value: number | null,
  unit: ReportTile['unit'],
  definition: string,
): ReportTile {
  return { key, label, value, unit, definition };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

/** A Prisma filter for the batches in scope, or `{}` when every batch is in scope. */
function batchIn(ctx: ReportContext): { in: string[] } | undefined {
  return ctx.batchIds === null ? undefined : { in: ctx.batchIds };
}

/**
 * For a report limited to some batches: the enrolments in courses those batches were given, so a
 * learner's other batches stay out of it (D6). Every enrolment when the report covers every batch.
 */
async function enrolmentsWithin(ctx: ReportContext): Promise<Prisma.EnrollmentWhereInput> {
  if (ctx.batchIds === null) return {};
  return {
    course: { publications: { some: await publicationsReaching(ctx.prisma, ctx.batchIds) } },
  };
}

function dateRange(ctx: ReportContext): { gte?: Date; lte?: Date } | undefined {
  if (!ctx.from && !ctx.to) return undefined;
  return { ...(ctx.from ? { gte: ctx.from } : {}), ...(ctx.to ? { lte: ctx.to } : {}) };
}

const RANGE_NOTE =
  'With no dates the report covers everything recorded; with dates it covers that window only.';

// ───────────────────────── students ─────────────────────────

const studentsReport: ReportBuilder = {
  descriptor: {
    name: 'students',
    title: 'Students',
    description: 'Everybody in the batches you can see, with how they are getting on.',
    filters: ['programId', 'batchId', 'from', 'to', 'q'],
    route: '/admin/reports/students',
  },
  columns: [
    column('studentCode', 'Code', 'text'),
    column('name', 'Name', 'text'),
    column('email', 'Email', 'text', { optional: true }),
    column('batchCode', 'Batch', 'text'),
    column('status', 'Status', 'status'),
    column('joinedAt', 'Joined', 'date'),
    column('lastActiveAt', 'Last active', 'date'),
    column('attendancePct', 'Attendance', 'percent'),
    column('coursesEnrolled', 'Courses', 'number', { optional: true }),
    column('completionPct', 'Completion', 'percent'),
  ],
  definitions: [
    { term: 'Attendance', text: 'Classes attended as a share of the classes that were marked.' },
    {
      term: 'Completion',
      text: 'The mean progress across the courses the student is enrolled in.',
    },
    { term: 'Last active', text: 'The most recent sign-in.' },
    { term: 'Date range', text: RANGE_NOTE },
  ],
  defaultSort: 'name',

  async build(ctx) {
    const members = await ctx.prisma.batchMember.findMany({
      where: {
        isActive: true,
        batchId: batchIn(ctx),
        batch: { organizationId: ctx.organizationId, deletedAt: null },
      },
      include: {
        batch: { select: { id: true, code: true } },
        student: {
          include: {
            user: { select: { name: true, email: true, lastLoginAt: true } },
            enrollments: {
              where: await enrolmentsWithin(ctx),
              select: { progressPct: true, status: true },
            },
          },
        },
      },
    });

    const studentIds = members.map((m) => m.studentId);
    const attendance = await attendanceByStudent(ctx, studentIds);

    const rows: ReportRow[] = members.map((member) => {
      const enrolments = member.student.enrollments;
      const completion = average(enrolments.map((e) => e.progressPct));
      return {
        studentId: member.studentId,
        studentCode: member.student.studentCode,
        name: member.student.user.name,
        email: member.student.user.email,
        batchCode: member.batch.code,
        status: member.student.status,
        joinedAt: member.joinedAt.toISOString().slice(0, 10),
        lastActiveAt: member.student.user.lastLoginAt?.toISOString().slice(0, 10) ?? null,
        attendancePct: attendance.get(member.studentId)?.percentage ?? null,
        coursesEnrolled: enrolments.length,
        completionPct: completion,
      };
    });

    const filtered = applyText(rows, ctx.filter.q, ['name', 'studentCode', 'email', 'batchCode']);
    const withAttendance = filtered
      .map((row) => row.attendancePct)
      .filter((value): value is number => typeof value === 'number');
    const below = withAttendance.filter((value) => value < ctx.rules.thresholdPct).length;
    const activeFrom = ctx.from ?? new Date(Date.now() - 7 * 86_400_000);
    const active = filtered.filter(
      (row) => typeof row.lastActiveAt === 'string' && new Date(row.lastActiveAt) >= activeFrom,
    ).length;

    const perBatch = new Map<string, number>();
    for (const row of filtered) {
      const code = String(row.batchCode);
      perBatch.set(code, (perBatch.get(code) ?? 0) + 1);
    }

    return {
      rows: filtered,
      summary: [
        tile('total', 'Students', filtered.length, 'count', 'Active memberships in these batches.'),
        tile(
          'active',
          'Active in range',
          active,
          'count',
          'Signed in since the start of the range.',
        ),
        tile(
          'below',
          `Below ${ctx.rules.thresholdPct}%`,
          below,
          'count',
          'Students under the attendance threshold.',
        ),
        tile(
          'completion',
          'Mean completion',
          average(
            filtered
              .map((r) => r.completionPct)
              .filter((value): value is number => typeof value === 'number'),
          ),
          'percent',
          'Mean course progress across these students.',
        ),
      ],
      chart: {
        kind: 'bar',
        title: 'Students per batch',
        xKey: 'batchCode',
        series: [{ key: 'students', label: 'Students' }],
        data: [...perBatch.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([batchCode, students]) => ({ batchCode, students })),
        note: 'Counts the rows in the table, grouped by batch.',
      },
    };
  },
};

// ───────────────────────── attendance ─────────────────────────

const attendanceReport: ReportBuilder = {
  descriptor: {
    name: 'attendance',
    title: 'Attendance',
    description: 'How much of the timetable each student has actually attended.',
    filters: ['programId', 'batchId', 'trainerId', 'from', 'to', 'q'],
    route: '/admin/reports/attendance',
  },
  columns: [
    column('studentCode', 'Code', 'text'),
    column('name', 'Name', 'text'),
    column('batchCode', 'Batch', 'text'),
    column('conducted', 'Classes', 'number'),
    column('present', 'Present', 'number'),
    column('late', 'Late', 'number', { optional: true }),
    column('excused', 'Excused', 'number', { optional: true }),
    column('absent', 'Absent', 'number'),
    column('percentage', 'Attendance', 'percent'),
  ],
  definitions: [
    {
      term: 'Classes',
      text: 'Classes that were marked. A class nobody marked counts towards nobody.',
    },
    {
      term: 'Attendance',
      text: 'Attended ÷ marked classes, where "attended" is the statuses the institute counts.',
    },
    { term: 'Date range', text: RANGE_NOTE },
  ],
  defaultSort: 'percentage',

  async build(ctx) {
    const range = dateRange(ctx);
    const [records, members, sessions] = await Promise.all([
      ctx.prisma.attendanceRecord.findMany({
        where: {
          batchId: batchIn(ctx),
          ...(range || ctx.filter.trainerId
            ? {
                session: {
                  ...(range ? { startsAt: range } : {}),
                  ...(ctx.filter.trainerId ? { trainerId: ctx.filter.trainerId } : {}),
                },
              }
            : {}),
        },
        select: {
          studentId: true,
          status: true,
          batch: { select: { code: true } },
          student: { select: { studentCode: true, user: { select: { name: true } } } },
          session: { select: { startsAt: true } },
        },
      }),
      ctx.prisma.batchMember.findMany({
        where: {
          isActive: true,
          batchId: batchIn(ctx),
          batch: { organizationId: ctx.organizationId, deletedAt: null },
        },
        include: {
          batch: { select: { code: true } },
          student: { select: { studentCode: true, user: { select: { name: true } } } },
        },
      }),
      ctx.prisma.liveSession.findMany({
        where: {
          batchId: batchIn(ctx),
          status: { in: ['live', 'completed'] },
          ...(range ? { startsAt: range } : {}),
          ...(ctx.filter.trainerId ? { trainerId: ctx.filter.trainerId } : {}),
        },
        select: { id: true, attendanceMarkedAt: true },
      }),
    ]);

    const tally = new Map<
      string,
      { counts: Record<AttendanceStatus, number>; name: string; code: string; batchCode: string }
    >();
    for (const member of members) {
      tally.set(member.studentId, {
        counts: { present: 0, absent: 0, late: 0, excused: 0 },
        name: member.student.user.name,
        code: member.student.studentCode,
        batchCode: member.batch.code,
      });
    }
    const perDay = new Map<string, { attended: number; conducted: number }>();

    for (const record of records) {
      const entry =
        tally.get(record.studentId) ??
        (() => {
          const created = {
            counts: { present: 0, absent: 0, late: 0, excused: 0 } as Record<
              AttendanceStatus,
              number
            >,
            name: record.student.user.name,
            code: record.student.studentCode,
            batchCode: record.batch.code,
          };
          tally.set(record.studentId, created);
          return created;
        })();
      entry.counts[record.status] += 1;

      const day = toLocalDateKey(record.session.startsAt, ctx.timezone);
      const dayEntry = perDay.get(day) ?? { attended: 0, conducted: 0 };
      dayEntry.conducted += 1;
      if (ctx.rules.countedStatuses.includes(record.status)) dayEntry.attended += 1;
      perDay.set(day, dayEntry);
    }

    const rows: ReportRow[] = [...tally.entries()].map(([studentId, entry]) => {
      const conducted =
        entry.counts.present + entry.counts.absent + entry.counts.late + entry.counts.excused;
      const attended = ctx.rules.countedStatuses.reduce(
        (total, status) => total + entry.counts[status],
        0,
      );
      return {
        studentId,
        studentCode: entry.code,
        name: entry.name,
        batchCode: entry.batchCode,
        conducted,
        present: entry.counts.present,
        late: entry.counts.late,
        excused: entry.counts.excused,
        absent: entry.counts.absent,
        percentage: attendancePercentage(attended, conducted),
      };
    });

    const filtered = applyText(rows, ctx.filter.q, ['name', 'studentCode', 'batchCode']);
    const totalConducted = filtered.reduce((total, row) => total + Number(row.conducted ?? 0), 0);
    const totalAttended = filtered.reduce(
      (total, row) =>
        total +
        ctx.rules.countedStatuses.reduce((sum, status) => sum + Number(row[status] ?? 0), 0),
      0,
    );
    const below = filtered.filter(
      (row) => typeof row.percentage === 'number' && row.percentage < ctx.rules.thresholdPct,
    ).length;
    const unmarked = sessions.filter((s) => s.attendanceMarkedAt === null).length;

    return {
      rows: filtered,
      summary: [
        tile(
          'overall',
          'Overall attendance',
          attendancePercentage(totalAttended, totalConducted),
          'percent',
          'Every mark in the table, taken together.',
        ),
        tile(
          'classes',
          'Classes held',
          sessions.length,
          'count',
          'Classes that started or finished.',
        ),
        tile(
          'unmarked',
          'Not marked',
          unmarked,
          'count',
          'Classes that happened and are still waiting for a roll call.',
        ),
        tile(
          'below',
          `Below ${ctx.rules.thresholdPct}%`,
          below,
          'count',
          'Students under the attendance threshold.',
        ),
      ],
      chart: {
        kind: 'line',
        title: 'Attendance by day',
        xKey: 'date',
        series: [{ key: 'percentage', label: 'Attendance %' }],
        data: [...perDay.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, entry]) => ({
            date,
            percentage: attendancePercentage(entry.attended, entry.conducted),
          })),
        note: 'Each point is every mark taken that day, across the batches in the filter.',
      },
    };
  },
};

// ───────────────────────── progress ─────────────────────────

const progressReport: ReportBuilder = {
  descriptor: {
    name: 'progress',
    title: 'Course progress',
    description: 'One row per learner per course, and how far through it they are.',
    filters: ['programId', 'batchId', 'courseId', 'q'],
    route: '/admin/reports/progress',
  },
  columns: [
    column('studentCode', 'Code', 'text'),
    column('name', 'Name', 'text'),
    column('batchCode', 'Batch', 'text'),
    column('course', 'Course', 'text'),
    column('status', 'Status', 'status'),
    column('progressPct', 'Progress', 'percent'),
    column('lastAccessedAt', 'Last opened', 'date'),
  ],
  definitions: [
    {
      term: 'Progress',
      text: 'The share of the mandatory lessons the learner has completed, as the player computes it.',
    },
    { term: 'Status', text: 'Active until every mandatory lesson is done, then completed.' },
  ],
  defaultSort: '-progressPct',

  async build(ctx) {
    const members = await ctx.prisma.batchMember.findMany({
      where: {
        isActive: true,
        batchId: batchIn(ctx),
        batch: { organizationId: ctx.organizationId, deletedAt: null },
      },
      include: {
        batch: { select: { code: true } },
        student: { select: { id: true, studentCode: true, user: { select: { name: true } } } },
      },
    });
    const batchByStudent = new Map(members.map((m) => [m.studentId, m.batch.code]));

    const enrolments = await ctx.prisma.enrollment.findMany({
      where: {
        studentId: { in: members.map((m) => m.studentId) },
        ...(ctx.filter.courseId ? { courseId: ctx.filter.courseId } : {}),
        ...(await enrolmentsWithin(ctx)),
      },
      include: {
        course: { select: { id: true, title: true } },
        student: { select: { studentCode: true, user: { select: { name: true } } } },
      },
    });

    const rows: ReportRow[] = enrolments.map((enrolment) => ({
      studentId: enrolment.studentId,
      studentCode: enrolment.student.studentCode,
      name: enrolment.student.user.name,
      batchCode: batchByStudent.get(enrolment.studentId) ?? '',
      course: enrolment.course.title,
      status: enrolment.status,
      progressPct: enrolment.progressPct,
      lastAccessedAt: enrolment.lastAccessedAt?.toISOString().slice(0, 10) ?? null,
    }));

    const filtered = applyText(rows, ctx.filter.q, ['name', 'studentCode', 'course', 'batchCode']);
    const completed = filtered.filter((row) => row.status === 'completed').length;
    const started = filtered.filter((row) => Number(row.progressPct ?? 0) > 0).length;

    const perCourse = new Map<string, number[]>();
    for (const row of filtered) {
      const title = String(row.course);
      const list = perCourse.get(title) ?? [];
      list.push(Number(row.progressPct ?? 0));
      perCourse.set(title, list);
    }

    return {
      rows: filtered,
      summary: [
        tile(
          'enrolments',
          'Enrolments',
          filtered.length,
          'count',
          'Learner–course pairs in scope.',
        ),
        tile('started', 'Started', started, 'count', 'Enrolments with any progress at all.'),
        tile('completed', 'Completed', completed, 'count', 'Every mandatory lesson finished.'),
        tile(
          'mean',
          'Mean progress',
          average(filtered.map((row) => Number(row.progressPct ?? 0))),
          'percent',
          'The mean of the progress column.',
        ),
      ],
      chart: {
        kind: 'bar',
        title: 'Mean progress per course',
        xKey: 'course',
        series: [{ key: 'progress', label: 'Mean progress %' }],
        data: [...perCourse.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([course, values]) => ({ course, progress: average(values) })),
        note: 'The mean of every enrolment in the table, grouped by course.',
      },
    };
  },
};

// ───────────────────────── assessments ─────────────────────────

const assessmentsReport: ReportBuilder = {
  descriptor: {
    name: 'assessments',
    title: 'Test results',
    description: 'Every scheduled test, who sat it and how the batch scored.',
    filters: ['programId', 'batchId', 'from', 'to', 'q'],
    route: '/admin/reports/assessments',
  },
  columns: [
    column('test', 'Test', 'text'),
    column('batchCode', 'Batch', 'text'),
    column('kind', 'Type', 'status', { optional: true }),
    column('opensAt', 'Window opens', 'date'),
    column('expected', 'Roster', 'number'),
    column('sat', 'Sat', 'number'),
    column('averagePct', 'Average', 'percent'),
    column('highestPct', 'Highest', 'percent', { optional: true }),
    column('lowestPct', 'Lowest', 'percent', { optional: true }),
    column('released', 'Released', 'status'),
  ],
  definitions: [
    {
      term: 'Sat',
      text: 'Attempts that were submitted, including the ones the deadline submitted.',
    },
    {
      term: 'Average',
      text: 'The mean score of the submitted attempts, as a share of the total marks.',
    },
    { term: 'Released', text: 'Whether the learners can see their results yet.' },
    { term: 'Date range', text: 'Filters the windows by when they open.' },
  ],
  defaultSort: '-opensAt',

  async build(ctx) {
    const range = dateRange(ctx);
    const schedules = await ctx.prisma.testSchedule.findMany({
      where: {
        batchId: batchIn(ctx),
        batch: { organizationId: ctx.organizationId, deletedAt: null },
        ...(range ? { opensAt: range } : {}),
      },
      include: {
        test: { select: { title: true, kind: true } },
        batch: {
          select: { code: true, _count: { select: { members: { where: { isActive: true } } } } },
        },
        attempts: {
          where: { status: { in: ['submitted', 'graded'] } },
          select: { score: true, totalMarks: true },
        },
      },
    });

    const rows: ReportRow[] = schedules.map((schedule) => {
      const percentages = schedule.attempts
        .filter((attempt) => attempt.totalMarks > 0)
        .map((attempt) => Math.round((Number(attempt.score) / attempt.totalMarks) * 100));
      return {
        scheduleId: schedule.id,
        test: schedule.test.title,
        batchCode: schedule.batch.code,
        kind: schedule.test.kind,
        opensAt: schedule.opensAt.toISOString().slice(0, 10),
        expected: schedule.batch._count.members,
        sat: schedule.attempts.length,
        averagePct: average(percentages),
        highestPct: percentages.length ? Math.max(...percentages) : null,
        lowestPct: percentages.length ? Math.min(...percentages) : null,
        released: schedule.releasedAt ? 'released' : 'held',
      };
    });

    const filtered = applyText(rows, ctx.filter.q, ['test', 'batchCode']);
    const pending = await ctx.prisma.testAnswer.count({
      where: {
        status: 'awaiting_grading',
        attempt: {
          status: { in: ['submitted', 'graded'] },
          schedule: { batchId: batchIn(ctx) },
        },
      },
    });

    return {
      rows: filtered,
      summary: [
        tile('scheduled', 'Test windows', filtered.length, 'count', 'Tests opened to a batch.'),
        tile(
          'sat',
          'Papers submitted',
          filtered.reduce((total, row) => total + Number(row.sat ?? 0), 0),
          'count',
          'Attempts that were handed in.',
        ),
        tile(
          'average',
          'Mean score',
          average(
            filtered
              .map((row) => row.averagePct)
              .filter((value): value is number => typeof value === 'number'),
          ),
          'percent',
          'The mean of the average column.',
        ),
        tile(
          'pending',
          'Awaiting marking',
          pending,
          'count',
          'Written answers still waiting for a person to read them.',
        ),
      ],
      chart: {
        kind: 'bar',
        title: 'Mean score per test',
        xKey: 'label',
        series: [{ key: 'average', label: 'Mean %' }],
        data: filtered
          .filter((row) => typeof row.averagePct === 'number')
          .map((row) => ({ label: `${row.test} · ${row.batchCode}`, average: row.averagePct })),
        note: 'One bar per window in the table, for the windows anybody has sat.',
      },
    };
  },
};

// ───────────────────────── assignments ─────────────────────────

const assignmentsReport: ReportBuilder = {
  descriptor: {
    name: 'assignments',
    title: 'Assignment status',
    description: 'What has been given to each batch, and how far through it they are.',
    filters: ['programId', 'batchId', 'from', 'to', 'q'],
    route: '/admin/reports/assignments',
  },
  columns: [
    column('assignment', 'Assignment', 'text'),
    column('batchCode', 'Batch', 'text'),
    column('publishedAt', 'Published', 'date'),
    column('dueAt', 'Due', 'date'),
    column('questions', 'Questions', 'number', { optional: true }),
    column('students', 'Students', 'number'),
    column('started', 'Started', 'number'),
    column('completed', 'Completed', 'number'),
    column('completionPct', 'Completion', 'percent'),
    column('overdue', 'Overdue', 'status'),
  ],
  definitions: [
    { term: 'Started', text: 'Students who have answered at least one question.' },
    { term: 'Completed', text: 'Students who have answered every question in the assignment.' },
    { term: 'Completion', text: 'Answers given as a share of answers possible across the batch.' },
    { term: 'Date range', text: 'Filters the publications by when they were published.' },
  ],
  defaultSort: '-publishedAt',

  async build(ctx) {
    const range = dateRange(ctx);
    const publications = await ctx.prisma.assignmentPublication.findMany({
      where: {
        withdrawnAt: null,
        // A batch's publication, or one given to a learner of a batch in the report's reach.
        OR: [
          {
            batchId: batchIn(ctx),
            batch: { organizationId: ctx.organizationId, deletedAt: null },
          },
          {
            student: {
              members: {
                some: {
                  isActive: true,
                  batchId: batchIn(ctx),
                  batch: { organizationId: ctx.organizationId, deletedAt: null },
                },
              },
            },
          },
        ],
        ...(range ? { publishedAt: range } : {}),
      },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            modules: { select: { _count: { select: { questions: true } } } },
          },
        },
        batch: {
          select: {
            id: true,
            code: true,
            members: { where: { isActive: true }, select: { studentId: true } },
          },
        },
        student: {
          select: {
            members: {
              where: { isActive: true },
              select: { batch: { select: { code: true } } },
              take: 1,
            },
          },
        },
      },
    });

    const now = new Date();
    const rows: ReportRow[] = [];
    for (const publication of publications) {
      const questionCount = publication.assignment.modules.reduce(
        (total, module) => total + module._count.questions,
        0,
      );
      const studentIds = publication.batch
        ? publication.batch.members.map((m) => m.studentId)
        : publication.studentId
          ? [publication.studentId]
          : [];
      const submissions =
        studentIds.length === 0
          ? []
          : await ctx.prisma.submission.findMany({
              where: {
                assignmentId: publication.assignmentId,
                studentId: { in: studentIds },
              },
              select: { studentId: true, assignmentQuestionId: true },
            });

      const answeredByStudent = new Map<string, Set<string>>();
      for (const submission of submissions) {
        const set = answeredByStudent.get(submission.studentId) ?? new Set<string>();
        set.add(submission.assignmentQuestionId);
        answeredByStudent.set(submission.studentId, set);
      }
      const started = answeredByStudent.size;
      const completed =
        questionCount === 0
          ? 0
          : [...answeredByStudent.values()].filter((set) => set.size >= questionCount).length;
      const possible = questionCount * studentIds.length;
      const answered = [...answeredByStudent.values()].reduce((total, set) => total + set.size, 0);

      rows.push({
        publicationId: publication.id,
        assignmentId: publication.assignmentId,
        assignment: publication.assignment.title,
        batchCode:
          publication.batch?.code ??
          `${publication.student?.members[0]?.batch.code ?? 'Learner'} (one learner)`,
        publishedAt: publication.publishedAt.toISOString().slice(0, 10),
        dueAt: publication.dueAt?.toISOString().slice(0, 10) ?? null,
        questions: questionCount,
        students: studentIds.length,
        started,
        completed,
        completionPct: possible > 0 ? Math.round((answered / possible) * 100) : null,
        overdue: publication.dueAt && publication.dueAt < now ? 'overdue' : 'open',
      });
    }

    const filtered = applyText(rows, ctx.filter.q, ['assignment', 'batchCode']);
    return {
      rows: filtered,
      summary: [
        tile(
          'published',
          'Publications',
          filtered.length,
          'count',
          'Assignments given to a batch.',
        ),
        tile(
          'started',
          'Students started',
          filtered.reduce((total, row) => total + Number(row.started ?? 0), 0),
          'count',
          'Counted once per publication.',
        ),
        tile(
          'completed',
          'Students finished',
          filtered.reduce((total, row) => total + Number(row.completed ?? 0), 0),
          'count',
          'Every question answered at least once.',
        ),
        tile(
          'completion',
          'Mean completion',
          average(
            filtered
              .map((row) => row.completionPct)
              .filter((value): value is number => typeof value === 'number'),
          ),
          'percent',
          'The mean of the completion column.',
        ),
      ],
      chart: {
        kind: 'bar',
        title: 'Completion per assignment',
        xKey: 'label',
        series: [{ key: 'completion', label: 'Completion %' }],
        data: filtered
          .filter((row) => typeof row.completionPct === 'number')
          .map((row) => ({
            label: `${row.assignment} · ${row.batchCode}`,
            completion: row.completionPct,
          })),
        note: 'One bar per publication in the table.',
      },
    };
  },
};

// ───────────────────────── shared helpers ─────────────────────────

/** Attendance figures per student, honouring the report's date range. */
async function attendanceByStudent(
  ctx: ReportContext,
  studentIds: string[],
): Promise<Map<string, { conducted: number; attended: number; percentage: number | null }>> {
  const result = new Map<
    string,
    { conducted: number; attended: number; percentage: number | null }
  >();
  if (studentIds.length === 0) return result;
  const range = dateRange(ctx);
  const records = await ctx.prisma.attendanceRecord.findMany({
    where: {
      studentId: { in: studentIds },
      batchId: batchIn(ctx),
      ...(range ? { session: { startsAt: range } } : {}),
    },
    select: { studentId: true, status: true },
  });
  for (const record of records) {
    const entry = result.get(record.studentId) ?? { conducted: 0, attended: 0, percentage: null };
    entry.conducted += 1;
    if (ctx.rules.countedStatuses.includes(record.status)) entry.attended += 1;
    result.set(record.studentId, entry);
  }
  for (const entry of result.values()) {
    entry.percentage = attendancePercentage(entry.attended, entry.conducted);
  }
  return result;
}

/** The free-text box, applied to the columns a report says it searches. */
function applyText(rows: ReportRow[], q: string | undefined, keys: string[]): ReportRow[] {
  if (!q) return rows;
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    keys.some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(needle),
    ),
  );
}

// ───────────────────────── certificates ─────────────────────────

const certificatesReport: ReportBuilder = {
  descriptor: {
    name: 'certificates',
    title: 'Certificates issued',
    description: 'Every certificate of completion, who earned it and whether it stands.',
    filters: ['programId', 'batchId', 'courseId', 'from', 'to', 'q'],
    route: '/admin/reports/certificates',
    requires: 'certificates:read',
  },
  columns: [
    column('studentCode', 'Code', 'text'),
    column('name', 'Name', 'text'),
    column('batchCode', 'Batch', 'text'),
    column('course', 'Course', 'text'),
    column('issuedAt', 'Issued', 'date'),
    column('status', 'Status', 'status'),
    column('certificateCode', 'Certificate', 'text', { optional: true }),
  ],
  definitions: [
    {
      term: 'Issued',
      text: 'When the certificate was issued, on completing every counted lesson of the course.',
    },
    { term: 'Status', text: 'Issued, or revoked by an administrator with a reason.' },
    { term: 'Date range', text: 'Filters by the day of issue.' },
  ],
  defaultSort: '-issuedAt',

  async build(ctx) {
    const range = dateRange(ctx);
    const rows = await ctx.prisma.certificate.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(ctx.filter.courseId ? { courseId: ctx.filter.courseId } : {}),
        ...(range ? { issuedAt: range } : {}),
        ...(ctx.batchIds === null
          ? {}
          : { student: { members: { some: { batchId: { in: ctx.batchIds }, isActive: true } } } }),
      },
      include: {
        student: {
          select: {
            studentCode: true,
            members: {
              where: { isActive: true, batchId: batchIn(ctx) },
              select: { batch: { select: { code: true } } },
              take: 1,
            },
          },
        },
      },
    });
    const table: ReportRow[] = rows.map((row) => ({
      studentId: row.studentId,
      studentCode: row.student.studentCode,
      name: row.learnerName,
      batchCode: row.student.members[0]?.batch.code ?? '',
      course: row.courseTitle,
      issuedAt: row.issuedAt.toISOString().slice(0, 10),
      status: row.status,
      certificateCode: row.code,
    }));
    const filtered = applyText(table, ctx.filter.q, [
      'name',
      'studentCode',
      'course',
      'batchCode',
      'certificateCode',
    ]);
    const perCourse = new Map<string, number>();
    for (const row of filtered) {
      if (row.status !== 'issued') continue;
      perCourse.set(String(row.course), (perCourse.get(String(row.course)) ?? 0) + 1);
    }
    return {
      rows: filtered,
      summary: [
        tile(
          'issued',
          'In force',
          filtered.filter((r) => r.status === 'issued').length,
          'count',
          'Certificates issued and not revoked.',
        ),
        tile(
          'revoked',
          'Revoked',
          filtered.filter((r) => r.status === 'revoked').length,
          'count',
          'Certificates an administrator revoked.',
        ),
        tile(
          'learners',
          'Learners',
          new Set(filtered.map((r) => r.studentId)).size,
          'count',
          'Learners holding at least one of these certificates.',
        ),
      ],
      chart: {
        kind: 'bar',
        title: 'Certificates in force per course',
        xKey: 'course',
        series: [{ key: 'certificates', label: 'Certificates' }],
        data: [...perCourse.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([course, certificates]) => ({ course, certificates })),
        note: 'Revoked certificates are left out of the chart.',
      },
    };
  },
};

// ───────────────────────── placements ─────────────────────────

const PLACEMENT_STAGES = ['applied', 'shortlisted', 'selected', 'rejected', 'withdrawn'] as const;

const placementsReport: ReportBuilder = {
  descriptor: {
    name: 'placements',
    title: 'Placement status',
    description: 'Every application to a placement drive, by learner, and how far it went.',
    filters: ['programId', 'batchId', 'from', 'to', 'q'],
    route: '/admin/reports/placements',
    requires: 'placements:read',
  },
  columns: [
    column('studentCode', 'Code', 'text'),
    column('name', 'Name', 'text'),
    column('batchCode', 'Batch', 'text'),
    column('company', 'Company', 'text'),
    column('role', 'Role', 'text'),
    column('status', 'Stage', 'status'),
    column('appliedAt', 'Applied', 'date'),
  ],
  definitions: [
    {
      term: 'Stage',
      text: 'Applied, shortlisted, selected, rejected, or withdrawn by the learner.',
    },
    { term: 'Selection rate', text: 'Selected applications as a share of all applications.' },
    { term: 'Date range', text: 'Filters by the day of application.' },
  ],
  defaultSort: '-appliedAt',

  async build(ctx) {
    // Placement records are for those who handle placements, whatever else a report reaches.
    if (ctx.viewer.scopeOf('placements:read') !== 'all')
      return emptyResult('Placements are read by placement staff.');
    const range = dateRange(ctx);
    const rows = await ctx.prisma.driveApplication.findMany({
      where: {
        drive: { organizationId: ctx.organizationId },
        ...(range ? { appliedAt: range } : {}),
        ...(ctx.batchIds === null
          ? {}
          : { student: { members: { some: { batchId: { in: ctx.batchIds }, isActive: true } } } }),
      },
      include: {
        drive: { select: { role: true, company: { select: { name: true } } } },
        student: {
          select: {
            studentCode: true,
            user: { select: { name: true } },
            members: {
              where: { isActive: true, batchId: batchIn(ctx) },
              select: { batch: { select: { code: true } } },
              take: 1,
            },
          },
        },
      },
    });
    const table: ReportRow[] = rows.map((row) => ({
      studentId: row.studentId,
      studentCode: row.student.studentCode,
      name: row.student.user.name,
      batchCode: row.student.members[0]?.batch.code ?? '',
      company: row.drive.company.name,
      role: row.drive.role,
      status: row.status,
      appliedAt: row.appliedAt.toISOString().slice(0, 10),
    }));
    const filtered = applyText(table, ctx.filter.q, ['name', 'studentCode', 'company', 'role']);
    const count = (status: string) => filtered.filter((r) => r.status === status).length;
    return {
      rows: filtered,
      summary: [
        tile(
          'applications',
          'Applications',
          filtered.length,
          'count',
          'Applications in the table.',
        ),
        tile(
          'shortlisted',
          'Shortlisted',
          count('shortlisted') + count('selected'),
          'count',
          'Applications that reached the shortlist, including those selected.',
        ),
        tile(
          'selected',
          'Selected',
          count('selected'),
          'count',
          'Applications that ended in an offer.',
        ),
        tile(
          'rate',
          'Selection rate',
          filtered.length === 0 ? null : Math.round((count('selected') / filtered.length) * 100),
          'percent',
          'Selected applications as a share of all applications.',
        ),
      ],
      chart: {
        kind: 'bar',
        title: 'Applications by stage',
        xKey: 'stage',
        series: [{ key: 'applications', label: 'Applications' }],
        data: PLACEMENT_STAGES.map((stage) => ({ stage, applications: count(stage) })),
        note: 'Counts the rows in the table, grouped by their stage.',
      },
    };
  },
};

// ───────────────────────── feedback ─────────────────────────

const feedbackReport: ReportBuilder = {
  descriptor: {
    name: 'feedback',
    title: 'Student feedback',
    description:
      'Each feedback round: how many answered and the average rating, once five learners have.',
    filters: ['programId', 'batchId', 'trainerId', 'courseId', 'from', 'to', 'q'],
    route: '/admin/reports/feedback',
    requires: 'feedback:read',
  },
  columns: [
    column('form', 'Form', 'text'),
    column('batchCode', 'Batch', 'text'),
    column('trainer', 'About', 'text'),
    column('course', 'Course', 'text', { optional: true }),
    column('period', 'Round', 'text'),
    column('responses', 'Answers', 'number'),
    column('audience', 'Learners', 'number', { optional: true }),
    column('responseRate', 'Answered', 'percent'),
    column('averageRating', 'Average rating', 'number'),
  ],
  definitions: [
    { term: 'Round', text: 'The week (named by its Friday) for a weekly form; "once" otherwise.' },
    {
      term: 'Average rating',
      text: 'The mean of every rating answer in the round, out of 5. Hidden below five answers, so nobody can be picked out.',
    },
    { term: 'Answered', text: 'Answers as a share of the batch’s active learners.' },
  ],
  defaultSort: '-period',

  async build(ctx) {
    const scope = ctx.viewer.scopeOf('feedback:read');
    if (!scope) return emptyResult('Feedback figures are read with the feedback permission.');
    const forms = await ctx.prisma.feedbackForm.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        batchId: batchIn(ctx),
        ...(ctx.filter.trainerId ? { trainerId: ctx.filter.trainerId } : {}),
        ...(ctx.filter.courseId ? { courseId: ctx.filter.courseId } : {}),
        // A trainer's own scope is the forms about them.
        ...(scope === 'own'
          ? { trainerId: ctx.viewer.trainerId ?? '00000000-0000-0000-0000-000000000000' }
          : {}),
      },
      include: {
        batch: {
          select: { code: true, _count: { select: { members: { where: { isActive: true } } } } },
        },
        trainer: { select: { user: { select: { name: true } } } },
        course: { select: { title: true } },
        responses: { select: { period: true, answers: true, submittedOn: true } },
      },
    });
    const range = dateRange(ctx);
    const table: ReportRow[] = [];
    for (const form of forms) {
      const ratingIds = (form.questions as { id: string; kind: string }[])
        .filter((q) => q.kind === 'rating')
        .map((q) => q.id);
      const byPeriod = new Map<string, { answers: Record<string, unknown>[] }>();
      for (const response of form.responses) {
        if (range?.gte && response.submittedOn < startOfDayUtc(range.gte)) continue;
        if (range?.lte && response.submittedOn > range.lte) continue;
        const entry = byPeriod.get(response.period) ?? { answers: [] };
        entry.answers.push(response.answers as Record<string, unknown>);
        byPeriod.set(response.period, entry);
      }
      for (const [period, entry] of byPeriod) {
        const ratings = entry.answers.flatMap((answers) =>
          ratingIds.map((id) => answers[id]).filter((v): v is number => typeof v === 'number'),
        );
        const shown = entry.answers.length >= FEEDBACK_MIN_RESPONSES && ratings.length > 0;
        const audience = form.batch._count.members;
        table.push({
          form: form.title,
          batchCode: form.batch.code,
          trainer: form.trainer?.user.name ?? '',
          course: form.course?.title ?? '',
          period,
          responses: entry.answers.length,
          audience,
          responseRate: audience === 0 ? null : Math.round((entry.answers.length / audience) * 100),
          averageRating: shown
            ? Math.round((ratings.reduce((n, v) => n + v, 0) / ratings.length) * 10) / 10
            : null,
        });
      }
    }
    const filtered = applyText(table, ctx.filter.q, ['form', 'batchCode', 'trainer', 'course']);
    const rated = filtered.filter((r) => typeof r.averageRating === 'number');
    return {
      rows: filtered,
      summary: [
        tile('rounds', 'Rounds', filtered.length, 'count', 'Form rounds with at least one answer.'),
        tile(
          'answers',
          'Answers',
          filtered.reduce((n, r) => n + Number(r.responses ?? 0), 0),
          'count',
          'Answers given across these rounds.',
        ),
        tile(
          'rate',
          'Answered',
          average(
            filtered.map((r) => r.responseRate).filter((v): v is number => typeof v === 'number'),
          ),
          'percent',
          'The mean share of each batch that answered a round.',
        ),
      ],
      chart: {
        kind: 'bar',
        title: 'Average rating per round',
        xKey: 'label',
        series: [{ key: 'rating', label: 'Average rating (of 5)' }],
        data: rated.map((r) => ({
          label: `${String(r.form)} · ${String(r.period)}`,
          rating: r.averageRating,
        })),
        note: 'Only rounds with five answers or more are drawn.',
      },
    };
  },
};

// ───────────────────────── trainer performance ─────────────────────────

const trainersReport: ReportBuilder = {
  descriptor: {
    name: 'trainers',
    title: 'Trainer performance',
    description:
      'Each trainer’s classes, their batches’ attendance and test results, and the feedback about them, side by side. No single score is computed: that formula is the institute’s to agree (Q-16).',
    filters: ['programId', 'batchId', 'trainerId', 'from', 'to'],
    route: '/admin/reports/trainers',
  },
  columns: [
    column('trainer', 'Trainer', 'text'),
    column('batches', 'Batches', 'number'),
    column('classes', 'Classes held', 'number'),
    column('markedPct', 'Roll calls taken', 'percent'),
    column('attendancePct', 'Attendance', 'percent'),
    column('testAveragePct', 'Test average', 'percent'),
    column('feedbackRating', 'Feedback rating', 'number'),
    column('feedbackAnswers', 'Feedback answers', 'number', { optional: true }),
  ],
  definitions: [
    { term: 'Classes held', text: 'Their classes marked completed in the range.' },
    { term: 'Roll calls taken', text: 'The share of those classes whose attendance was marked.' },
    { term: 'Attendance', text: 'Attended marks as a share of every mark in their classes.' },
    {
      term: 'Test average',
      text: 'The mean score of the tests their batches sat in the range, as a share of the marks.',
    },
    {
      term: 'Feedback rating',
      text: 'The mean rating in the forms about them, out of 5; hidden below five answers.',
    },
    {
      term: 'Who sees it',
      text: 'Administrators see every trainer; a trainer sees their own row only.',
    },
  ],
  defaultSort: 'trainer',

  async build(ctx) {
    const seesAll = ctx.viewer.scopeOf('reports:read') === 'all';
    if (!seesAll && !ctx.viewer.trainerId) return emptyResult('This report lists trainers.');
    const range = dateRange(ctx);
    const trainers = await ctx.prisma.trainerProfile.findMany({
      where: {
        user: { organizationId: ctx.organizationId, deletedAt: null },
        ...(seesAll ? {} : { id: ctx.viewer.trainerId! }),
        ...(ctx.filter.trainerId ? { id: ctx.filter.trainerId } : {}),
        ...(ctx.batchIds === null
          ? {}
          : { assignments: { some: { batchId: { in: ctx.batchIds } } } }),
      },
      select: {
        id: true,
        user: { select: { name: true } },
        assignments: { where: { batchId: batchIn(ctx) }, select: { batchId: true } },
      },
    });
    const table: ReportRow[] = [];
    for (const trainer of trainers) {
      const batchIds = [...new Set(trainer.assignments.map((a) => a.batchId))];
      const [classes, marked, records, attempts, responses] = await Promise.all([
        ctx.prisma.liveSession.count({
          where: {
            trainerId: trainer.id,
            status: 'completed',
            batchId: { in: batchIds },
            ...(range ? { startsAt: range } : {}),
          },
        }),
        ctx.prisma.liveSession.count({
          where: {
            trainerId: trainer.id,
            status: 'completed',
            batchId: { in: batchIds },
            attendanceMarkedAt: { not: null },
            ...(range ? { startsAt: range } : {}),
          },
        }),
        ctx.prisma.attendanceRecord.findMany({
          where: {
            session: { trainerId: trainer.id, ...(range ? { startsAt: range } : {}) },
            batchId: { in: batchIds },
          },
          select: { status: true },
        }),
        ctx.prisma.testAttempt.findMany({
          where: {
            status: { in: ['submitted', 'graded'] },
            schedule: { batchId: { in: batchIds } },
            ...(range ? { submittedAt: range } : {}),
            totalMarks: { gt: 0 },
          },
          select: { score: true, totalMarks: true },
        }),
        ctx.prisma.feedbackResponse.findMany({
          where: {
            form: { trainerId: trainer.id, deletedAt: null },
            ...(range ? { submittedOn: range } : {}),
          },
          select: { answers: true, form: { select: { questions: true } } },
        }),
      ]);
      const attended = records.filter((r) => ctx.rules.countedStatuses.includes(r.status)).length;
      const ratings = responses.flatMap((response) => {
        const ids = (response.form.questions as { id: string; kind: string }[])
          .filter((q) => q.kind === 'rating')
          .map((q) => q.id);
        const answers = response.answers as Record<string, unknown>;
        return ids.map((id) => answers[id]).filter((v): v is number => typeof v === 'number');
      });
      table.push({
        trainerId: trainer.id,
        trainer: trainer.user.name,
        batches: batchIds.length,
        classes,
        markedPct: classes === 0 ? null : Math.round((marked / classes) * 100),
        attendancePct: attendancePercentage(attended, records.length),
        testAveragePct: average(attempts.map((a) => (Number(a.score) / a.totalMarks) * 100)),
        feedbackRating:
          responses.length >= FEEDBACK_MIN_RESPONSES && ratings.length > 0
            ? Math.round((ratings.reduce((n, v) => n + v, 0) / ratings.length) * 10) / 10
            : null,
        feedbackAnswers: responses.length,
      });
    }
    return {
      rows: table,
      summary: [
        tile('trainers', 'Trainers', table.length, 'count', 'Trainers in the table.'),
        tile(
          'classes',
          'Classes held',
          table.reduce((n, r) => n + Number(r.classes ?? 0), 0),
          'count',
          'Completed classes of these trainers in the range.',
        ),
        tile(
          'attendance',
          'Mean attendance',
          average(
            table.map((r) => r.attendancePct).filter((v): v is number => typeof v === 'number'),
          ),
          'percent',
          'The mean of the trainers’ attendance figures.',
        ),
      ],
      chart: {
        kind: 'bar',
        title: 'Attendance and test average per trainer',
        xKey: 'trainer',
        series: [
          { key: 'attendance', label: 'Attendance %' },
          { key: 'tests', label: 'Test average %' },
        ],
        data: table.map((r) => ({
          trainer: r.trainer,
          attendance: r.attendancePct,
          tests: r.testAveragePct,
        })),
        note: 'Each measure is shown on its own; the report does not combine them into a score.',
      },
    };
  },
};

/** A report the viewer may open but whose rows are not theirs to read: empty, saying why. */
function emptyResult(reason: string): ReportResult {
  return {
    rows: [],
    summary: [tile('note', 'Not shown here', null, 'count', reason)],
    chart: null,
  };
}

/** The UTC midnight of a date-range bound, for comparing with a stored day. */
function startOfDayUtc(at: Date): Date {
  return new Date(`${at.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export const REPORT_BUILDERS: Record<ReportName, ReportBuilder> = {
  students: studentsReport,
  attendance: attendanceReport,
  progress: progressReport,
  assessments: assessmentsReport,
  assignments: assignmentsReport,
  certificates: certificatesReport,
  placements: placementsReport,
  feedback: feedbackReport,
  trainers: trainersReport,
};

/** Reports the plan names whose module is not in this build, so the catalogue says what is coming. */
export const PENDING_REPORTS = [
  {
    name: 'projects',
    title: 'Project status',
    reason: 'Needs the projects module (F-15), which a later phase of the roadmap adds.',
  },
];
