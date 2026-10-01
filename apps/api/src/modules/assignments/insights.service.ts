import { Injectable } from '@nestjs/common';
import type { AssignmentAnalytics, AssignmentProgressRow, QuestionType } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService, narrowToBatch } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { TaxonomiesService } from '../settings/taxonomies.service.js';
import { AssignmentsService } from './assignments.service.js';
import { effectivePublication, learnerState } from './learner-state.js';
import { learnersReached, STATE_INCLUDE, toStateAssignment } from './reach.js';

/** Failed attempts at which a learner is flagged as worth a conversation. */
const STRUGGLING_FAILED_ATTEMPTS = 3;
const WEEKS_SHOWN = 8;

/**
 * What staff learn from assignments: how each learner is doing on one of them, and how the
 * assignments are doing overall. Scoped like everything else: a trainer sees their own batches.
 */
@Injectable()
export class AssignmentInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
    private readonly assignments: AssignmentsService,
    private readonly taxonomies: TaxonomiesService,
  ) {}

  /** One row per learner the assignment reaches, in the caller's batches, with the same status the learner sees. */
  async progress(
    id: string,
    query: { batchId?: string },
    user: AuthUser,
  ): Promise<AssignmentProgressRow[]> {
    await this.assignments.findForStaff(id, user);
    const batches = narrowToBatch(
      await this.scope.visibleBatchIds(user, 'assignments:manage'),
      query.batchId,
    );
    const publications = await this.prisma.assignmentPublication.findMany({
      where: {
        assignmentId: id,
        withdrawnAt: null,
        ...(batches === null
          ? {}
          : {
              OR: [
                { batchId: { in: batches } },
                { student: { members: { some: { isActive: true, batchId: { in: batches } } } } },
              ],
            }),
      },
    });
    if (publications.length === 0) return [];

    const reached = await learnersReached(this.prisma, publications);
    let studentIds = [...reached.keys()];
    if (batches !== null) {
      const inScope = await this.prisma.batchMember.findMany({
        where: { studentId: { in: studentIds }, isActive: true, batchId: { in: batches } },
        select: { studentId: true },
      });
      const allowed = new Set(inScope.map((m) => m.studentId));
      studentIds = studentIds.filter((s) => allowed.has(s));
    }
    if (studentIds.length === 0) return [];

    const [row, students, submissions] = await Promise.all([
      this.prisma.assignment.findUniqueOrThrow({ where: { id }, include: STATE_INCLUDE }),
      this.prisma.studentProfile.findMany({
        where: { id: { in: studentIds } },
        select: {
          id: true,
          studentCode: true,
          user: { select: { name: true } },
          members: {
            where: { isActive: true, ...(batches ? { batchId: { in: batches } } : {}) },
            select: { batch: { select: { code: true } } },
            take: 1,
          },
        },
      }),
      this.prisma.submission.findMany({
        where: { assignmentId: id, studentId: { in: studentIds } },
        select: {
          id: true,
          studentId: true,
          assignmentQuestionId: true,
          attempt: true,
          status: true,
          marks: true,
          reviewDecision: true,
          submittedAt: true,
        },
      }),
    ]);
    const assignment = toStateAssignment(row);
    const byId = new Map(publications.map((p) => [p.id, p]));
    const now = new Date();

    return students
      .map((student) => {
        const reaching = (reached.get(student.id) ?? [])
          .map((pid) => byId.get(pid)!)
          .filter(Boolean);
        const publication = effectivePublication(reaching)!;
        const mine = submissions.filter((s) => s.studentId === student.id);
        const state = learnerState(assignment, publication, mine, now);
        const failedAttempts = mine.filter((s) => s.status === 'incorrect').length;
        const percentage =
          state.row.totalMarks === 0
            ? 0
            : Math.round((state.row.awardedMarks / state.row.totalMarks) * 100);
        const awaitingReview = [...state.placements.values()].filter(
          (p) => p.progress === 'awaiting_review',
        ).length;
        return {
          studentId: student.id,
          studentCode: student.studentCode,
          name: student.user.name,
          batchCode: student.members[0]?.batch.code ?? '',
          status: state.row.status,
          answered: state.row.answered,
          solved: state.row.solved,
          questionCount: state.row.questionCount,
          awardedMarks: state.row.awardedMarks,
          totalMarks: state.row.totalMarks,
          percentage,
          attempts: mine.length,
          failedAttempts,
          awaitingReview,
          lastActivityAt: state.row.lastActivityAt,
          struggling:
            (failedAttempts >= STRUGGLING_FAILED_ATTEMPTS && percentage < assignment.passPercent) ||
            (state.row.status === 'overdue' && state.row.progressPct < 50) ||
            state.row.status === 'failed',
        };
      })
      .sort((a, b) => Number(b.struggling) - Number(a.struggling) || a.name.localeCompare(b.name));
  }

  /**
   * The overview: how many assignments there are and in what state, how learners are doing with
   * them, how much is being submitted, and where it is hard. Worked out in the database, so it
   * costs the same for ten learners or ten thousand.
   */
  async analytics(
    query: { courseId?: string; batchId?: string; subject?: string },
    user: AuthUser,
  ): Promise<AssignmentAnalytics> {
    const org = await this.tenant.getOrganization();
    const batches = narrowToBatch(
      await this.scope.visibleBatchIds(user, 'assignments:manage'),
      query.batchId,
    );
    const visible = await this.assignments.visibleAssignmentIds(user);
    const assignments = await this.prisma.assignment.findMany({
      where: {
        organizationId: org.id,
        deletedAt: null,
        ...(visible === null ? {} : { id: { in: visible } }),
        ...(query.courseId ? { courseId: query.courseId } : {}),
        ...(query.subject ? { subject: query.subject } : {}),
      },
      select: {
        id: true,
        status: true,
        courseId: true,
        passPercent: true,
        createdById: true,
        course: { select: { title: true } },
        modules: {
          select: {
            topic: true,
            questions: { select: { id: true, marks: true, questionId: true } },
          },
        },
      },
    });
    const ids = assignments.map((a) => a.id);
    const everyone = batches === null;
    const scopedStudents = everyone
      ? []
      : (
          await this.prisma.batchMember.findMany({
            where: { batchId: { in: batches }, isActive: true },
            select: { studentId: true },
          })
        ).map((m) => m.studentId);

    // Who each assignment reaches, and by when it is due for them.
    const publications = await this.prisma.assignmentPublication.findMany({
      where: {
        assignmentId: { in: ids },
        withdrawnAt: null,
        ...(everyone
          ? {}
          : {
              OR: [{ batchId: { in: batches } }, { studentId: { in: scopedStudents } }],
            }),
      },
      select: { id: true, assignmentId: true, batchId: true, studentId: true, dueAt: true },
    });
    const reachedPairs = new Map<string, Date | null>();
    const reached = await learnersReached(this.prisma, publications);
    const pubById = new Map(publications.map((p) => [p.id, p]));
    const allowed = new Set(scopedStudents);
    for (const [studentId, pubIds] of reached) {
      if (!everyone && !allowed.has(studentId)) continue;
      for (const pubId of pubIds) {
        const pub = pubById.get(pubId)!;
        const key = `${pub.assignmentId}:${studentId}`;
        const current = reachedPairs.get(key);
        if (current === undefined || (pub.dueAt && (!current || pub.dueAt < current))) {
          reachedPairs.set(key, pub.dueAt);
        }
      }
    }

    // Per learner and assignment: questions answered, anything waiting, and the best marks.
    const studentFilter = [...new Set([...reachedPairs.keys()].map((k) => k.split(':')[1]!))];
    const perLearner =
      ids.length === 0 || studentFilter.length === 0
        ? []
        : await this.prisma.$queryRaw<
            {
              assignment_id: string;
              student_id: string;
              answered: number;
              pending: number;
              marks: number;
            }[]
          >`
            WITH best AS (
              SELECT assignment_id, student_id, assignment_question_id,
                     MAX(marks) FILTER (WHERE status IN ('correct', 'partial', 'incorrect')) AS marks,
                     BOOL_OR(status IN ('awaiting_grading', 'evaluating')) AS pending
              FROM submissions
              WHERE assignment_id = ANY(${ids}::uuid[]) AND student_id = ANY(${studentFilter}::uuid[])
              GROUP BY assignment_id, student_id, assignment_question_id
            )
            SELECT assignment_id, student_id,
                   COUNT(*)::int AS answered,
                   COUNT(*) FILTER (WHERE pending)::int AS pending,
                   COALESCE(SUM(marks), 0)::float AS marks
            FROM best
            GROUP BY assignment_id, student_id`;
    const facts = new Map(perLearner.map((r) => [`${r.assignment_id}:${r.student_id}`, r]));
    const byAssignment = new Map(assignments.map((a) => [a.id, a]));

    const now = new Date();
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let overdue = 0;
    const scores: number[] = [];
    let passed = 0;
    let finished = 0;
    const courseStats = new Map<
      string,
      {
        title: string;
        assignments: Set<string>;
        pairs: number;
        completed: number;
        scores: number[];
      }
    >();
    for (const [key, dueAt] of reachedPairs) {
      const [assignmentId] = key.split(':') as [string];
      const assignment = byAssignment.get(assignmentId);
      if (!assignment) continue;
      const questions = assignment.modules.reduce((n, m) => n + m.questions.length, 0);
      const total = assignment.modules.reduce(
        (n, m) => n + m.questions.reduce((t, q) => t + q.marks, 0),
        0,
      );
      const fact = facts.get(key);
      const answered = fact?.answered ?? 0;
      const done = questions > 0 && answered >= questions && (fact?.pending ?? 0) === 0;
      if (done) {
        completed += 1;
        const pct = total === 0 ? 0 : ((fact?.marks ?? 0) / total) * 100;
        scores.push(pct);
        finished += 1;
        if (pct >= assignment.passPercent) passed += 1;
      } else if (dueAt && dueAt < now) {
        overdue += 1;
      } else if (answered > 0) {
        inProgress += 1;
      } else {
        notStarted += 1;
      }
      const courseKey = assignment.courseId ?? 'none';
      const stats = courseStats.get(courseKey) ?? {
        title: assignment.course?.title ?? 'Not linked to a course',
        assignments: new Set<string>(),
        pairs: 0,
        completed: 0,
        scores: [],
      };
      stats.assignments.add(assignment.id);
      stats.pairs += 1;
      if (done) {
        stats.completed += 1;
        stats.scores.push(total === 0 ? 0 : ((fact?.marks ?? 0) / total) * 100);
      }
      courseStats.set(courseKey, stats);
    }

    // Submission volume, and the questions that are hardest.
    const since = new Date(now.getTime() - WEEKS_SHOWN * 7 * 86_400_000);
    const scopeSql = everyone ? [] : scopedStudents;
    const [counts, weekly, questionRows, awaitingByAuthor] = await Promise.all([
      ids.length === 0
        ? [{ total: 0, recent: 0, evaluating: 0, awaiting: 0 }]
        : this.prisma.$queryRaw<
            { total: number; recent: number; evaluating: number; awaiting: number }[]
          >`
            SELECT COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE submitted_at >= ${new Date(now.getTime() - 7 * 86_400_000)})::int AS recent,
                   COUNT(*) FILTER (WHERE status = 'evaluating')::int AS evaluating,
                   COUNT(*) FILTER (WHERE status = 'awaiting_grading')::int AS awaiting
            FROM submissions
            WHERE assignment_id = ANY(${ids}::uuid[])
              AND (${everyone} OR student_id = ANY(${scopeSql}::uuid[]))`,
      ids.length === 0
        ? []
        : this.prisma.$queryRaw<{ week: Date; submissions: number }[]>`
            SELECT date_trunc('week', submitted_at) AS week, COUNT(*)::int AS submissions
            FROM submissions
            WHERE assignment_id = ANY(${ids}::uuid[]) AND submitted_at >= ${since}
              AND (${everyone} OR student_id = ANY(${scopeSql}::uuid[]))
            GROUP BY 1 ORDER BY 1`,
      ids.length === 0
        ? []
        : this.prisma.$queryRaw<
            { question_id: string; attempts: number; correct: number; marked: number }[]
          >`
            SELECT question_id,
                   COUNT(*)::int AS attempts,
                   COUNT(*) FILTER (WHERE status = 'correct')::int AS correct,
                   COUNT(*) FILTER (WHERE status IN ('correct', 'partial', 'incorrect'))::int AS marked
            FROM submissions
            WHERE assignment_id = ANY(${ids}::uuid[])
              AND (${everyone} OR student_id = ANY(${scopeSql}::uuid[]))
            GROUP BY question_id`,
      ids.length === 0
        ? []
        : this.prisma.submission.groupBy({
            by: ['assignmentId'],
            where: {
              assignmentId: { in: ids },
              status: 'awaiting_grading',
              ...(everyone ? {} : { studentId: { in: scopedStudents } }),
            },
            _count: { _all: true },
          }),
    ]);

    const questionIds = questionRows.map((q) => q.question_id);
    const questionInfo =
      questionIds.length === 0
        ? []
        : await this.prisma.question.findMany({
            where: { id: { in: questionIds } },
            select: { id: true, title: true, type: true },
          });
    const info = new Map(questionInfo.map((q) => [q.id, q]));
    const topicByQuestion = new Map<string, string>();
    for (const assignment of assignments) {
      for (const module of assignment.modules) {
        for (const q of module.questions)
          if (module.topic) topicByQuestion.set(q.questionId, module.topic);
      }
    }
    const topicLabels = new Map((await this.taxonomies.list('topic')).map((t) => [t.key, t.label]));
    const topics = new Map<
      string,
      { questions: Set<string>; attempts: number; correct: number; marked: number }
    >();
    for (const row of questionRows) {
      const topic = topicByQuestion.get(row.question_id);
      if (!topic) continue;
      const stats = topics.get(topic) ?? {
        questions: new Set<string>(),
        attempts: 0,
        correct: 0,
        marked: 0,
      };
      stats.questions.add(row.question_id);
      stats.attempts += row.attempts;
      stats.correct += row.correct;
      stats.marked += row.marked;
      topics.set(topic, stats);
    }

    const authors = new Map<string, { assignments: number; awaiting: number }>();
    const awaitingMap = new Map(awaitingByAuthor.map((r) => [r.assignmentId, r._count._all]));
    for (const assignment of assignments) {
      const key = assignment.createdById ?? 'unknown';
      const stats = authors.get(key) ?? { assignments: 0, awaiting: 0 };
      stats.assignments += 1;
      stats.awaiting += awaitingMap.get(assignment.id) ?? 0;
      authors.set(key, stats);
    }
    const authorNames = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: [...authors.keys()].filter((k) => k !== 'unknown') } },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );

    const average = (values: number[]) =>
      values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const weeks: { weekStart: string; submissions: number }[] = [];
    const weekMap = new Map(weekly.map((w) => [w.week.toISOString().slice(0, 10), w.submissions]));
    const firstWeek = startOfWeek(since);
    for (let i = 0; i <= WEEKS_SHOWN; i += 1) {
      const start = new Date(firstWeek.getTime() + i * 7 * 86_400_000);
      if (start > now) break;
      const key = start.toISOString().slice(0, 10);
      weeks.push({ weekStart: key, submissions: weekMap.get(key) ?? 0 });
    }
    const count = counts[0] ?? { total: 0, recent: 0, evaluating: 0, awaiting: 0 };

    return {
      asOf: now.toISOString(),
      totals: {
        assignments: assignments.length,
        published: assignments.filter((a) => a.status === 'published').length,
        draft: assignments.filter((a) => a.status === 'draft').length,
        archived: assignments.filter((a) => a.status === 'archived').length,
      },
      learners: { reached: reachedPairs.size, completed, inProgress, notStarted, overdue },
      submissions: {
        total: count.total,
        last7Days: count.recent,
        evaluating: count.evaluating,
        awaitingReview: count.awaiting,
      },
      averageScorePct: average(scores),
      passRatePct: finished === 0 ? null : Math.round((passed / finished) * 100),
      weekly: weeks,
      byCourse: [...courseStats.entries()]
        .map(([courseId, stats]) => ({
          courseId: courseId === 'none' ? null : courseId,
          title: stats.title,
          assignments: stats.assignments.size,
          completionPct:
            stats.pairs === 0 ? null : Math.round((stats.completed / stats.pairs) * 100),
          averageScorePct: average(stats.scores),
        }))
        .sort((a, b) => a.title.localeCompare(b.title)),
      byTopic: [...topics.entries()]
        .map(([topic, stats]) => ({
          topic: topicLabels.get(topic) ?? topic,
          questions: stats.questions.size,
          attempts: stats.attempts,
          passRatePct: stats.marked === 0 ? null : Math.round((stats.correct / stats.marked) * 100),
        }))
        .sort((a, b) => (a.passRatePct ?? 101) - (b.passRatePct ?? 101)),
      byTrainer: [...authors.entries()]
        .map(([id, stats]) => ({
          name: authorNames.get(id) ?? 'Former staff',
          assignments: stats.assignments,
          awaitingReview: stats.awaiting,
        }))
        .sort((a, b) => b.awaitingReview - a.awaitingReview || a.name.localeCompare(b.name)),
      hardestQuestions: questionRows
        .filter((q) => q.marked >= 3 && info.has(q.question_id))
        .map((q) => ({
          questionId: q.question_id,
          title: info.get(q.question_id)!.title,
          type: info.get(q.question_id)!.type as QuestionType,
          attempts: q.attempts,
          passRatePct: Math.round((q.correct / q.marked) * 100),
        }))
        .sort((a, b) => a.passRatePct - b.passRatePct || b.attempts - a.attempts)
        .slice(0, 8),
    };
  }
}

/** Monday 00:00 UTC of the week a date falls in, as PostgreSQL's date_trunc('week') counts. */
function startOfWeek(date: Date): Date {
  const day = (date.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day));
}
