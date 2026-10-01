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
import { toLocalDateKey } from '@lms/shared';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
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
            enrollments: { select: { progressPct: true, status: true } },
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

export const REPORT_BUILDERS: Record<ReportName, ReportBuilder> = {
  students: studentsReport,
  attendance: attendanceReport,
  progress: progressReport,
  assessments: assessmentsReport,
  assignments: assignmentsReport,
};

/** Reports the plan names whose module is not in this build, so the catalogue says what is coming. */
export const PENDING_REPORTS = [
  {
    name: 'projects',
    title: 'Project status',
    reason: 'Needs a projects module, which this installation does not have.',
  },
  {
    name: 'trainers',
    title: 'Trainer performance',
    reason: 'Needs student feedback, which this installation does not collect.',
  },
  {
    name: 'placements',
    title: 'Placement status',
    reason:
      'Applications and selections are on the Drives page; a placement report is not built yet.',
  },
  {
    name: 'certificates',
    title: 'Certificates issued',
    reason: 'Needs a certificates module, which this installation does not have.',
  },
  {
    name: 'feedback',
    title: 'Student feedback',
    reason: 'Needs a feedback module, which this installation does not have.',
  },
];
