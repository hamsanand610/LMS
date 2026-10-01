import { Injectable } from '@nestjs/common';
import type { AssessmentProgress, StudentDashboard } from '@lms/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ACCEPTED_PRACTICE_RUN } from '../execution/index.js';

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

  /** Assignments published to the learner's batches, and how far through them they are. */
  private async assignments(
    studentId: string,
    batchIds: string[],
  ): Promise<AssessmentProgress['assignments']> {
    const empty = {
      total: 0,
      questions: 0,
      solved: 0,
      awardedMarks: 0,
      totalMarks: 0,
      progressPct: 0,
    };
    // Given to one of the learner's batches, or to the learner personally.
    const publications = await this.prisma.assignmentPublication.findMany({
      where: {
        OR: [{ batchId: { in: batchIds } }, { studentId }],
        withdrawnAt: null,
        assignment: { deletedAt: null, status: { not: 'archived' } },
      },
      select: { assignmentId: true },
    });
    const assignmentIds = [...new Set(publications.map((p) => p.assignmentId))];
    if (assignmentIds.length === 0) return empty;

    const placements = await this.prisma.assignmentQuestion.findMany({
      where: { module: { assignmentId: { in: assignmentIds } } },
      select: { id: true, marks: true },
    });
    const submissions = await this.prisma.submission.findMany({
      where: { studentId, assignmentId: { in: assignmentIds } },
      select: { assignmentQuestionId: true, marks: true, status: true },
    });

    // The best attempt at each question is the one that counts, as it does on the assignment page.
    const best = new Map<string, { marks: number; status: string }>();
    for (const submission of submissions) {
      const current = best.get(submission.assignmentQuestionId);
      const marks = Number(submission.marks);
      if (!current || marks > current.marks) {
        best.set(submission.assignmentQuestionId, { marks, status: submission.status });
      }
    }
    const solved = [...best.values()].filter(
      (s) => s.status === 'correct' || s.status === 'partial',
    ).length;

    return {
      total: assignmentIds.length,
      questions: placements.length,
      solved,
      awardedMarks: Math.round([...best.values()].reduce((n, s) => n + s.marks, 0) * 100) / 100,
      totalMarks: placements.reduce((n, p) => n + p.marks, 0),
      progressPct: placements.length === 0 ? 0 : Math.round((solved / placements.length) * 100),
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
      taken: attempts.length,
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

    const rows = await this.prisma.executionRun.groupBy({
      by: ['questionId', 'verdict', 'trust'],
      where: { userId: student.userId, context: 'practice' },
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

  /** What is due soon, for the dashboard's task list. */
  async tasksFor(studentId: string, batchIds: string[]): Promise<StudentDashboard['tasks']> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [publications, schedules] = await Promise.all([
      this.prisma.assignmentPublication.findMany({
        where: {
          AND: [
            // Given to one of the learner's batches, or to the learner personally…
            { OR: [{ batchId: { in: batchIds } }, { studentId }] },
            // …and not long past its date.
            { OR: [{ dueAt: null }, { dueAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } }] },
          ],
          withdrawnAt: null,
          assignment: { deletedAt: null, status: 'published' },
        },
        include: {
          assignment: {
            include: { modules: { include: { questions: { select: { id: true } } } } },
          },
        },
        orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }],
        take: 20,
      }),
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

    const submissions = await this.prisma.submission.findMany({
      where: {
        studentId,
        assignmentId: { in: publications.map((p) => p.assignmentId) },
      },
      select: { assignmentQuestionId: true, status: true },
    });
    const solved = new Set(
      submissions
        .filter((s) => s.status === 'correct' || s.status === 'partial')
        .map((s) => s.assignmentQuestionId),
    );
    const attempts = await this.prisma.testAttempt.findMany({
      where: { studentId, scheduleId: { in: schedules.map((s) => s.id) } },
      select: { scheduleId: true, status: true },
    });

    const tasks: StudentDashboard['tasks'] = [];
    const seen = new Set<string>();
    for (const publication of publications) {
      if (seen.has(publication.assignmentId)) continue;
      seen.add(publication.assignmentId);
      const questions = publication.assignment.modules.flatMap((m) => m.questions);
      const done = questions.filter((q) => solved.has(q.id)).length;
      if (questions.length > 0 && done >= questions.length) continue; // nothing left to do
      tasks.push({
        kind: 'assignment',
        id: publication.assignmentId,
        title: publication.assignment.title,
        dueAt: publication.dueAt?.toISOString() ?? null,
        link: `/assignments/${publication.assignmentId}`,
        status:
          questions.length === 0
            ? 'empty'
            : done === 0
              ? 'not started'
              : `${done} of ${questions.length} done`,
      });
    }
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
