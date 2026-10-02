import { Injectable } from '@nestjs/common';
import {
  assignmentSettingsSchema,
  countingSubmission,
  DEFAULT_ASSIGNMENT_SETTINGS,
  effectiveDueAt,
  effectivePublication,
  questionProgress,
  type AssessmentProgress,
  type QuestionProgress,
  type ReviewDecision,
  type ScheduleDeadline,
  type StudentDashboard,
} from '@lms/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ACCEPTED_PRACTICE_RUN, LIVE_LAB } from '../execution/index.js';

/** Statuses that mean the learner has handed the question in (an outage is not an answer). */
const NOT_HANDED_IN: readonly QuestionProgress[] = ['not_attempted', 'resubmit', 'error'];

/** One assignment as a learner has it: the publication that applies, and each question's state. */
interface ReachedWork {
  assignmentId: string;
  title: string;
  published: boolean;
  dueAt: Date | null;
  questions: { marks: number; progress: QuestionProgress; countingMarks: number }[];
}

/**
 * The assessment half of a learner's progress. It reads the assignment and test tables directly
 * rather than importing those modules, for the same reason the rest of this module does: the
 * assessment modules depend on nothing here, so nothing can form a cycle.
 *
 * Every figure is computed the same way the assignment and test pages compute it, which is what
 * makes the dashboard, the progress page and the staff view agree.
 */
@Injectable()
export class AssessmentProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async forStudent(studentId: string, batchIds: string[]): Promise<AssessmentProgress> {
    const [assignments, tests, practice] = await Promise.all([
      this.assignments(studentId, batchIds),
      this.tests(studentId, batchIds),
      this.practice(studentId),
    ]);
    return { assignments, tests, practice };
  }

  /**
   * The assignments that reach a learner, through a batch or personally, each with the publication
   * that applies to them and every question's state by the assignment's own grading method: the
   * same shared rules the assignment pages use, so the figures cannot disagree.
   */
  private async reached(studentId: string, batchIds: string[]): Promise<ReachedWork[]> {
    const publications = await this.prisma.assignmentPublication.findMany({
      where: {
        OR: [{ batchId: { in: batchIds } }, { studentId }],
        withdrawnAt: null,
        assignment: { deletedAt: null, status: { not: 'archived' } },
      },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            status: true,
            settings: true,
            modules: {
              select: { dueAfterDays: true, questions: { select: { id: true, marks: true } } },
            },
          },
        },
      },
    });
    const byAssignment = new Map<string, typeof publications>();
    for (const publication of publications) {
      byAssignment.set(publication.assignmentId, [
        ...(byAssignment.get(publication.assignmentId) ?? []),
        publication,
      ]);
    }
    if (byAssignment.size === 0) return [];

    const submissions = await this.prisma.submission.findMany({
      where: { studentId, assignmentId: { in: [...byAssignment.keys()] } },
      select: {
        assignmentQuestionId: true,
        attempt: true,
        status: true,
        marks: true,
        reviewDecision: true,
      },
    });
    const history = new Map<
      string,
      { attempt: number; status: string; marks: number; reviewDecision: ReviewDecision | null }[]
    >();
    for (const submission of submissions) {
      history.set(submission.assignmentQuestionId, [
        ...(history.get(submission.assignmentQuestionId) ?? []),
        {
          attempt: submission.attempt,
          status: submission.status,
          marks: Number(submission.marks),
          reviewDecision: submission.reviewDecision as ReviewDecision | null,
        },
      ]);
    }

    const out: ReachedWork[] = [];
    for (const list of byAssignment.values()) {
      const publication = effectivePublication(list)!;
      const assignment = publication.assignment;
      const parsed = assignmentSettingsSchema.safeParse(assignment.settings ?? {});
      const method = (parsed.success ? parsed.data : DEFAULT_ASSIGNMENT_SETTINGS).gradingMethod;
      out.push({
        assignmentId: assignment.id,
        title: assignment.title,
        published: assignment.status === 'published',
        dueAt: effectiveDueAt(publication, assignment.modules),
        questions: assignment.modules
          .flatMap((m) => m.questions)
          .map((question) => {
            const answers = history.get(question.id) ?? [];
            return {
              marks: question.marks,
              progress: questionProgress(answers, method),
              countingMarks: countingSubmission(answers, method)?.marks ?? 0,
            };
          }),
      });
    }
    return out;
  }

  /** Assignments given to the learner, and how far through them they are. */
  private async assignments(
    studentId: string,
    batchIds: string[],
  ): Promise<AssessmentProgress['assignments']> {
    const work = await this.reached(studentId, batchIds);
    const questions = work.flatMap((w) => w.questions);
    const solved = questions.filter(
      (q) => q.progress === 'correct' || q.progress === 'partial',
    ).length;
    return {
      total: work.length,
      questions: questions.length,
      solved,
      awardedMarks: Math.round(questions.reduce((n, q) => n + q.countingMarks, 0) * 100) / 100,
      totalMarks: questions.reduce((n, q) => n + q.marks, 0),
      progressPct: questions.length === 0 ? 0 : Math.round((solved / questions.length) * 100),
    };
  }

  /** Every test the learner has sat. A score stays hidden until its results are released. */
  private async tests(studentId: string, batchIds: string[]): Promise<AssessmentProgress['tests']> {
    if (batchIds.length === 0) return { taken: 0, averagePercentage: 0, history: [] };
    const attempts = await this.prisma.testAttempt.findMany({
      where: { studentId, status: { in: ['submitted', 'graded'] } },
      orderBy: { submittedAt: 'desc' },
      take: 50,
      include: {
        test: { select: { title: true, settings: true } },
        schedule: { select: { releasedAt: true } },
      },
    });

    const history = attempts.map((attempt) => {
      const settings = attempt.test.settings as { resultPolicy?: string } | null;
      const released =
        Boolean(attempt.schedule.releasedAt) || settings?.resultPolicy === 'immediately';
      const score = released ? Number(attempt.score) : 0;
      return {
        testId: attempt.testId,
        attemptId: attempt.id,
        title: attempt.test.title,
        score,
        totalMarks: attempt.totalMarks,
        percentage:
          released && attempt.totalMarks > 0 ? Math.round((score / attempt.totalMarks) * 100) : 0,
        released,
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
      };
    });
    const scored = history.filter((h) => h.released && h.totalMarks > 0);
    return {
      // Tests sat, each counted once however many attempts it took.
      taken: new Set(attempts.map((attempt) => attempt.testId)).size,
      averagePercentage:
        scored.length === 0
          ? 0
          : Math.round(scored.reduce((n, h) => n + h.percentage, 0) / scored.length),
      history,
    };
  }

  private async practice(studentId: string): Promise<AssessmentProgress['practice']> {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { userId: true },
    });
    if (!student) return { solved: 0, attempted: 0, points: 0 };

    // The live catalogue, as the Labs hub counts it: a retired or lesson-only lab is not counted.
    const rows = await this.prisma.executionRun.groupBy({
      by: ['questionId', 'verdict', 'trust'],
      where: {
        userId: student.userId,
        context: 'practice',
        question: { inPractice: true, ...LIVE_LAB },
      },
      _count: { _all: true },
    });
    const byQuestion = new Map<string, { accepted: number }>();
    for (const row of rows) {
      if (!row.questionId) continue;
      const current = byQuestion.get(row.questionId) ?? { accepted: 0 };
      if (
        row.verdict === ACCEPTED_PRACTICE_RUN.verdict &&
        row.trust === ACCEPTED_PRACTICE_RUN.trust
      ) {
        current.accepted += row._count._all;
      }
      byQuestion.set(row.questionId, current);
    }
    const solvedIds = [...byQuestion.entries()].filter(([, v]) => v.accepted > 0).map(([id]) => id);
    const points =
      solvedIds.length === 0
        ? 0
        : (
            await this.prisma.question.findMany({
              where: { id: { in: solvedIds } },
              select: { practicePoints: true },
            })
          ).reduce((n, q) => n + q.practicePoints, 0);

    return {
      solved: solvedIds.length,
      attempted: byQuestion.size - solvedIds.length,
      points,
    };
  }

  /**
   * The learner's deadlines between two instants, for the schedule (Phase 2, LRN-04): each
   * assignment at its own due date, each test window at its close. Work already handed in, or a
   * test already sat, stays on the calendar marked done.
   */
  async deadlinesFor(
    studentId: string,
    batchIds: string[],
    from: Date,
    to: Date,
  ): Promise<ScheduleDeadline[]> {
    const [work, schedules] = await Promise.all([
      this.reached(studentId, batchIds),
      batchIds.length === 0
        ? Promise.resolve([])
        : this.prisma.testSchedule.findMany({
            where: {
              batchId: { in: batchIds },
              test: { deletedAt: null, status: 'published' },
              closesAt: { gte: from, lt: to },
            },
            include: { test: { select: { title: true } } },
          }),
    ]);
    const out: ScheduleDeadline[] = [];
    for (const item of work) {
      if (!item.published || !item.dueAt || item.dueAt < from || item.dueAt >= to) continue;
      const handedIn = item.questions.filter((q) => !NOT_HANDED_IN.includes(q.progress)).length;
      out.push({
        kind: 'assignment',
        id: item.assignmentId,
        title: item.title,
        at: item.dueAt.toISOString(),
        link: `/assignments/${item.assignmentId}`,
        done: item.questions.length > 0 && handedIn >= item.questions.length,
      });
    }
    const sat = new Set(
      (
        await this.prisma.testAttempt.findMany({
          where: {
            studentId,
            scheduleId: { in: schedules.map((s) => s.id) },
            status: { not: 'in_progress' },
          },
          select: { scheduleId: true },
        })
      ).map((a) => a.scheduleId),
    );
    for (const schedule of schedules) {
      out.push({
        kind: 'test',
        id: schedule.testId,
        title: schedule.test.title,
        at: schedule.closesAt.toISOString(),
        link: `/tests/${schedule.testId}`,
        done: sat.has(schedule.id),
      });
    }
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }

  /**
   * What is due, for the dashboard's task list: assignments the learner has not handed in in full
   * (by their own due date), and test windows open or opening soon that they have not sat.
   */
  async tasksFor(studentId: string, batchIds: string[]): Promise<StudentDashboard['tasks']> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const recent = new Date(now.getTime() - 7 * 86_400_000);

    const [work, schedules] = await Promise.all([
      this.reached(studentId, batchIds),
      this.prisma.testSchedule.findMany({
        where: {
          batchId: { in: batchIds },
          test: { deletedAt: null, status: 'published' },
          closesAt: { gte: now },
          opensAt: { lte: horizon },
        },
        include: { test: { select: { title: true } } },
        orderBy: { opensAt: 'asc' },
        take: 20,
      }),
    ]);

    const tasks: StudentDashboard['tasks'] = [];
    for (const item of work) {
      if (!item.published) continue;
      if (item.dueAt && item.dueAt < recent) continue; // long past its date
      const handedIn = item.questions.filter((q) => !NOT_HANDED_IN.includes(q.progress)).length;
      if (item.questions.length > 0 && handedIn >= item.questions.length) continue; // all in
      tasks.push({
        kind: 'assignment',
        id: item.assignmentId,
        title: item.title,
        dueAt: item.dueAt?.toISOString() ?? null,
        link: `/assignments/${item.assignmentId}`,
        status:
          item.questions.length === 0
            ? 'empty'
            : handedIn === 0
              ? 'not started'
              : `${handedIn} of ${item.questions.length} handed in`,
      });
    }

    const attempts = await this.prisma.testAttempt.findMany({
      where: { studentId, scheduleId: { in: schedules.map((s) => s.id) } },
      select: { scheduleId: true, status: true },
    });
    for (const schedule of schedules) {
      const mine = attempts.filter((a) => a.scheduleId === schedule.id);
      if (mine.some((a) => a.status !== 'in_progress')) continue; // already sat
      tasks.push({
        kind: 'test',
        id: schedule.testId,
        title: schedule.test.title,
        dueAt: schedule.closesAt.toISOString(),
        link: `/tests/${schedule.testId}`,
        status: schedule.opensAt > now ? 'upcoming' : 'open now',
      });
    }
    return tasks.sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')).slice(0, 8);
  }
}
