import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type AssignmentDetail,
  type AssignmentModuleView,
  type AssignmentProgressCard,
  type AssignmentQuestionView,
  type GradeInput,
  type GradingQueueItem,
  type QuestionDetail,
  type QuestionDifficulty,
  type QuestionType,
  type SubmissionInput,
  type SubmissionResult,
  type SubmissionStatus,
  type UnlockRule,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission } from '../../core/auth/auth-user.js';
import { DomainRuleError, ForbiddenError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { ExecutionService } from '../execution/index.js';
import { NotificationsService } from '../notifications/index.js';
import { QuestionsService } from '../questions/index.js';
import { AssignmentsService, bestPerQuestion } from './assignments.service.js';

/**
 * Everything a learner does with an assignment, and the marking that follows.
 *
 * Objective answers are marked the moment they arrive. A written answer waits in a queue for a
 * person. A coding answer is marked from the test cases the question carries, with the weights
 * stored against them, never from anything the client claims a case is worth (ADR-0007).
 */
@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly scope: ScopeService,
    private readonly assignments: AssignmentsService,
    private readonly questions: QuestionsService,
    private readonly execution: ExecutionService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────────────────── the learner's own list ─────────────────────────

  async mine(user: AuthUser): Promise<AssignmentProgressCard[]> {
    const person = await this.scope.personFor(user.id);
    if (!person.studentId || person.batchIds.length === 0) return [];
    const publications = await this.prisma.assignmentPublication.findMany({
      where: { batchId: { in: person.batchIds }, withdrawnAt: null },
      include: {
        assignment: {
          include: { modules: { include: { questions: { select: { id: true, marks: true } } } } },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });
    if (publications.length === 0) return [];

    const submissions = await this.prisma.submission.findMany({
      where: {
        studentId: person.studentId,
        assignmentId: { in: publications.map((p) => p.assignmentId) },
      },
    });
    const now = Date.now();

    // One card per assignment; the earliest due date wins if two batches got the same one.
    const seen = new Map<string, AssignmentProgressCard>();
    for (const publication of publications) {
      const assignment = publication.assignment;
      if (assignment.deletedAt) continue;
      const placements = assignment.modules.flatMap((m) => m.questions);
      const mine = submissions.filter((s) => s.assignmentId === assignment.id);
      const best = bestPerQuestion(mine);
      const card: AssignmentProgressCard = {
        assignmentId: assignment.id,
        title: assignment.title,
        subject: assignment.subject,
        difficulty: assignment.difficulty,
        moduleCount: assignment.modules.length,
        questionCount: placements.length,
        totalMarks: placements.reduce((n, p) => n + p.marks, 0),
        solved: [...best.values()].filter((s) => s.status === 'correct' || s.status === 'partial')
          .length,
        awardedMarks: [...best.values()].reduce((n, s) => n + Number(s.marks), 0),
        progressPct:
          placements.length === 0
            ? 0
            : Math.round(
                ([...best.values()].filter((s) => s.status === 'correct' || s.status === 'partial')
                  .length /
                  placements.length) *
                  100,
              ),
        dueAt: publication.dueAt?.toISOString() ?? null,
        overdue: publication.dueAt ? publication.dueAt.getTime() < now : false,
      };
      const existing = seen.get(assignment.id);
      if (!existing || (card.dueAt && (!existing.dueAt || card.dueAt < existing.dueAt))) {
        seen.set(assignment.id, card);
      }
    }
    return [...seen.values()];
  }

  /** The assignment as the learner sees it: locks, ticks, attempts and what they scored. */
  async detailForLearner(assignmentId: string, user: AuthUser): Promise<AssignmentDetail> {
    const { studentId, publication } = await this.requireAccess(assignmentId, user);
    const assignment = await this.prisma.assignment.findFirstOrThrow({
      where: { id: assignmentId, deletedAt: null },
    });
    const modules = await this.assignments.loadModules(assignmentId);
    const submissions = await this.prisma.submission.findMany({
      where: { assignmentId, studentId },
    });
    const best = bestPerQuestion(submissions);
    const attemptsByPlacement = new Map<string, number>();
    for (const submission of submissions) {
      attemptsByPlacement.set(
        submission.assignmentQuestionId,
        Math.max(attemptsByPlacement.get(submission.assignmentQuestionId) ?? 0, submission.attempt),
      );
    }

    const rendered: AssignmentModuleView[] = [];
    let previousPercent = 100;
    for (const [index, module] of modules.entries()) {
      const rule = module.unlockRule as UnlockRule;
      const required = rule.type === 'after_previous' ? rule.minPercent : 0;
      const unlocked = index === 0 || rule.type === 'always' || previousPercent >= required;
      const questions = module.questions.map<AssignmentQuestionView>((placement) => {
        const submission = best.get(placement.id);
        return {
          id: placement.id,
          questionId: placement.questionId,
          title: placement.question.title,
          type: placement.question.type as QuestionType,
          difficulty: placement.question.difficulty as QuestionDifficulty,
          marks: placement.marks,
          position: placement.position,
          status: (submission?.status ?? 'not_attempted') as AssignmentQuestionView['status'],
          attempts: attemptsByPlacement.get(placement.id) ?? 0,
          awardedMarks: Number(submission?.marks ?? 0),
          timeSpentSeconds: submission?.timeSpentSeconds ?? 0,
        };
      });
      const solved = questions.filter(
        (q) => q.status === 'correct' || q.status === 'partial',
      ).length;
      rendered.push({
        id: module.id,
        title: module.title,
        position: module.position,
        unlockRule: rule,
        questions,
        unlocked,
        ...(unlocked ? {} : { lockReason: lockReason(required) }),
        solved,
      });
      previousPercent =
        module.questions.length === 0 ? 100 : Math.round((solved / module.questions.length) * 100);
    }

    const placements = modules.flatMap((m) => m.questions);
    const solved = rendered.reduce((n, m) => n + (m.solved ?? 0), 0);
    const settings = this.assignments.settingsOf(assignment);
    return {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      subject: assignment.subject,
      difficulty: assignment.difficulty,
      status: assignment.status,
      moduleCount: modules.length,
      questionCount: placements.length,
      totalMarks: placements.reduce((n, p) => n + p.marks, 0),
      publicationCount: 1,
      settings,
      createdAt: assignment.createdAt.toISOString(),
      modules: rendered,
      dueAt: publication.dueAt?.toISOString() ?? null,
      overdue: publication.dueAt ? publication.dueAt.getTime() < Date.now() : false,
      solved,
      awardedMarks: [...best.values()].reduce((n, s) => n + Number(s.marks), 0),
      progressPct: placements.length === 0 ? 0 : Math.round((solved / placements.length) * 100),
    };
  }

  /** One question as the workspace shows it, with nothing that would give the answer away. */
  async questionForLearner(
    assignmentId: string,
    placementId: string,
    user: AuthUser,
  ): Promise<{
    placement: AssignmentQuestionView;
    question: QuestionDetail;
    previousId: string | null;
    nextId: string | null;
    lastSubmission: SubmissionResult | null;
  }> {
    const { studentId } = await this.requireAccess(assignmentId, user);
    const placement = await this.prisma.assignmentQuestion.findFirst({
      where: { id: placementId, module: { assignmentId } },
      include: { module: true, question: true },
    });
    if (!placement) throw new NotFoundError('Question');
    await this.requireUnlocked(assignmentId, placement.module.position, studentId);

    const ordered = await this.prisma.assignmentQuestion.findMany({
      where: { module: { assignmentId } },
      orderBy: [{ module: { position: 'asc' } }, { position: 'asc' }],
      select: { id: true },
    });
    const index = ordered.findIndex((p) => p.id === placementId);
    const question = await this.questions.get(placement.questionId, user, true);
    const submissions = await this.prisma.submission.findMany({
      where: { assignmentQuestionId: placementId, studentId },
      orderBy: { attempt: 'desc' },
      include: { results: true },
    });
    const last = submissions[0] ?? null;
    const assignment = await this.prisma.assignment.findFirstOrThrow({
      where: { id: assignmentId },
    });
    const settings = this.assignments.settingsOf(assignment);

    return {
      placement: {
        id: placement.id,
        questionId: placement.questionId,
        title: placement.question.title,
        type: placement.question.type as QuestionType,
        difficulty: placement.question.difficulty as QuestionDifficulty,
        marks: placement.marks,
        position: placement.position,
        status: (last?.status ?? 'not_attempted') as AssignmentQuestionView['status'],
        attempts: submissions.length,
        awardedMarks: Number(last?.marks ?? 0),
      },
      question,
      previousId: index > 0 ? (ordered[index - 1]?.id ?? null) : null,
      nextId: index >= 0 && index < ordered.length - 1 ? (ordered[index + 1]?.id ?? null) : null,
      lastSubmission: last
        ? await this.toResult(
            last,
            placement.marks,
            settings.explanationPolicy,
            placement.questionId,
          )
        : null,
    };
  }

  /**
   * Every case a coding answer is marked against. With the browser driver that includes the
   * hidden ones, because a driver running in the learner's browser has to be given whatever it
   * runs; that is why its verdicts are untrusted. A Judge0 host runs them server-side instead,
   * and this hands back only the samples.
   */
  async gradingCases(
    assignmentId: string,
    placementId: string,
    user: AuthUser,
  ): Promise<{
    clientRuns: boolean;
    cases: { id: string; input: string; expectedOutput: string }[];
  }> {
    const { studentId } = await this.requireAccess(assignmentId, user);
    const placement = await this.prisma.assignmentQuestion.findFirst({
      where: { id: placementId, module: { assignmentId } },
      include: { module: true },
    });
    if (!placement) throw new NotFoundError('Question');
    await this.requireUnlocked(assignmentId, placement.module.position, studentId);
    const cases = await this.execution.casesFor(placement.questionId);
    const usable = this.execution.clientRuns ? cases : cases.filter((c) => c.isSample);
    return {
      clientRuns: this.execution.clientRuns,
      cases: usable.map((c) => ({ id: c.id, input: c.input, expectedOutput: c.expectedOutput })),
    };
  }

  // ───────────────────────── answering ─────────────────────────

  async submit(
    assignmentId: string,
    placementId: string,
    input: SubmissionInput,
    user: AuthUser,
  ): Promise<SubmissionResult> {
    const { studentId, publication } = await this.requireAccess(assignmentId, user);
    const placement = await this.prisma.assignmentQuestion.findFirst({
      where: { id: placementId, module: { assignmentId } },
      include: { module: true, question: { include: { options: true } } },
    });
    if (!placement) throw new NotFoundError('Question');
    await this.requireUnlocked(assignmentId, placement.module.position, studentId);

    const assignment = await this.prisma.assignment.findFirstOrThrow({
      where: { id: assignmentId },
    });
    const settings = this.assignments.settingsOf(assignment);
    if (
      settings.duePolicy === 'block_late' &&
      publication.dueAt &&
      publication.dueAt.getTime() < Date.now()
    ) {
      throw new DomainRuleError('This assignment closed on its due date', 'assignment_overdue');
    }

    const previous = await this.prisma.submission.findMany({
      where: { assignmentQuestionId: placementId, studentId },
      orderBy: { attempt: 'desc' },
    });
    const used = previous.length;
    if (settings.attemptsPerQuestion > 0 && used >= settings.attemptsPerQuestion) {
      throw new DomainRuleError(
        `You have used all ${settings.attemptsPerQuestion} attempts at this question`,
        'attempts_exhausted',
      );
    }

    const marked = await this.mark(placement, input);
    const submission = await this.prisma.submission.create({
      data: {
        assignmentId,
        assignmentQuestionId: placementId,
        questionId: placement.questionId,
        studentId,
        attempt: used + 1,
        status: marked.status,
        marks: marked.marks,
        maxMarks: placement.marks,
        optionIds: input.optionIds,
        text: input.text,
        code: input.code,
        language: input.language,
        ...(marked.results.length > 0
          ? {
              results: {
                create: marked.results.map((result) => ({
                  testCaseId: result.testCaseId,
                  passed: result.passed,
                  actualOutput: result.actualOutput,
                  stderr: result.stderr,
                  durationMs: result.durationMs,
                })),
              },
            }
          : {}),
      },
      include: { results: true },
    });

    if (marked.runId) {
      await this.prisma.executionRun.update({
        where: { id: marked.runId },
        data: { context: 'assignment' },
      });
    }
    this.events.emit('submission.created', {
      submissionId: submission.id,
      assignmentId,
      studentId,
      status: marked.status,
    });

    return this.toResult(
      submission,
      placement.marks,
      settings.explanationPolicy,
      placement.questionId,
    );
  }

  // ───────────────────────── grading ─────────────────────────

  async queue(user: AuthUser, query: { assignmentId?: string }): Promise<GradingQueueItem[]> {
    const visible = await this.scope.visibleBatchIds(user, 'assignments:grade');
    const studentFilter =
      visible === null
        ? {}
        : { student: { members: { some: { batchId: { in: visible }, isActive: true } } } };
    const rows = await this.prisma.submission.findMany({
      where: {
        status: 'awaiting_grading',
        ...(query.assignmentId ? { assignmentId: query.assignmentId } : {}),
        ...studentFilter,
      },
      orderBy: { submittedAt: 'asc' },
      take: 100,
      include: {
        assignment: { select: { title: true } },
        question: { select: { title: true, rubric: true } },
        student: {
          include: {
            user: { select: { name: true } },
            members: { where: { isActive: true }, include: { batch: { select: { code: true } } } },
          },
        },
      },
    });
    return rows.map((row) => ({
      submissionId: row.id,
      assignmentId: row.assignmentId,
      assignmentTitle: row.assignment.title,
      questionId: row.questionId,
      questionTitle: row.question.title,
      rubric: row.question.rubric,
      maxMarks: row.maxMarks,
      studentName: row.student.user.name,
      studentCode: row.student.studentCode,
      batchCode: row.student.members[0]?.batch.code ?? '',
      answer: row.text || row.code,
      submittedAt: row.submittedAt.toISOString(),
    }));
  }

  async grade(submissionId: string, input: GradeInput, user: AuthUser): Promise<SubmissionResult> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { student: { include: { user: { select: { id: true } } } }, results: true },
    });
    if (!submission) throw new NotFoundError('Submission');
    if (!hasPermission(user, 'assignments:grade')) {
      throw new ForbiddenError('You do not have access to this resource');
    }
    const visible = await this.scope.visibleBatchIds(user, 'assignments:grade');
    if (visible !== null) {
      const shared = await this.prisma.batchMember.count({
        where: { studentId: submission.studentId, isActive: true, batchId: { in: visible } },
      });
      if (shared === 0) throw new ForbiddenError('That learner is not in your batches');
    }
    if (input.marks > submission.maxMarks) {
      throw new DomainRuleError(
        `This question is worth ${submission.maxMarks} marks`,
        'marks_above_maximum',
      );
    }

    const updated = await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        marks: input.marks,
        status:
          input.marks >= submission.maxMarks
            ? 'correct'
            : input.marks > 0
              ? 'partial'
              : 'incorrect',
        graderComment: input.comment,
        gradedById: user.id,
        gradedAt: new Date(),
      },
      include: { results: true },
    });

    await this.audit.record({
      action: 'submission.graded',
      resourceType: 'submission',
      resourceId: submissionId,
      summary: `${input.marks} of ${submission.maxMarks} marks`,
      after: { marks: input.marks, comment: input.comment },
    });
    await this.notifications.notifyUser(submission.student.userId, {
      category: 'assessment',
      type: 'submission.graded',
      title: 'An answer of yours has been marked',
      body: `You scored ${input.marks} of ${submission.maxMarks}.`,
      link: `/assignments/${submission.assignmentId}`,
      channels: ['in_app'],
    });
    this.events.emit('submission.graded', { submissionId, studentId: submission.studentId });

    const assignment = await this.prisma.assignment.findFirstOrThrow({
      where: { id: submission.assignmentId },
    });
    return this.toResult(
      updated,
      submission.maxMarks,
      this.assignments.settingsOf(assignment).explanationPolicy,
      submission.questionId,
    );
  }

  // ───────────────────────── internals ─────────────────────────

  /** Works out what an answer is worth. */
  private async mark(
    placement: {
      id: string;
      marks: number;
      questionId: string;
      question: { type: string; options: { id: string; isCorrect: boolean }[] };
    },
    input: SubmissionInput,
  ): Promise<{
    status: SubmissionStatus;
    marks: number;
    results: {
      testCaseId: string | null;
      passed: boolean;
      actualOutput: string;
      stderr: string;
      durationMs: number;
    }[];
    runId: string | null;
  }> {
    const type = placement.question.type;

    if (type === 'descriptive') {
      return { status: 'awaiting_grading', marks: 0, results: [], runId: null };
    }

    if (type === 'coding') {
      const grade = await this.execution.gradeSubmission(
        placement.questionId,
        input.language as never,
        input.code,
        input.execution
          ? {
              language: input.language as never,
              verdict: input.execution.verdict as never,
              driver: input.execution.driver,
              durationMs: input.execution.durationMs,
              compileError: '',
              results: input.execution.results,
            }
          : null,
      );
      const runId = await this.execution.record({
        questionId: placement.questionId,
        userId: null,
        context: 'assignment',
        language: input.language,
        code: input.code,
        grade,
      });
      const marks = Math.round(placement.marks * grade.ratio * 100) / 100;
      return {
        status: grade.ratio >= 1 ? 'correct' : grade.ratio > 0 ? 'partial' : 'incorrect',
        marks,
        results: grade.results.map((r) => ({
          testCaseId: r.testCaseId,
          passed: r.passed,
          actualOutput: r.actualOutput,
          stderr: r.stderr,
          durationMs: r.durationMs,
        })),
        runId,
      };
    }

    // Objective: every correct option chosen and nothing else.
    const correct = new Set(placement.question.options.filter((o) => o.isCorrect).map((o) => o.id));
    const chosen = new Set(input.optionIds);
    const right = [...chosen].filter((id) => correct.has(id)).length;
    const wrong = chosen.size - right;
    const allRight = right === correct.size && wrong === 0;
    return {
      status: allRight ? 'correct' : 'incorrect',
      marks: allRight ? placement.marks : 0,
      results: [],
      runId: null,
    };
  }

  private async toResult(
    submission: {
      id: string;
      questionId: string;
      status: string;
      marks: unknown;
      maxMarks: number;
      attempt: number;
      submittedAt: Date;
      results?: {
        testCaseId: string | null;
        passed: boolean;
        actualOutput: string;
        stderr: string;
      }[];
    },
    maxMarks: number,
    explanationPolicy: string,
    questionId: string,
  ): Promise<SubmissionResult> {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true, coding: { include: { testCases: true } } },
    });
    const solved = submission.status === 'correct' || submission.status === 'partial';
    const reveal = explanationPolicy === 'after_solve' ? solved : explanationPolicy !== 'never';
    const assignment = await this.prisma.submission.findUnique({
      where: { id: submission.id },
      select: { assignment: { select: { settings: true } } },
    });
    const attemptsPerQuestion = this.assignments.settingsOf({
      settings: assignment?.assignment.settings ?? {},
    }).attemptsPerQuestion;

    const sampleIds = new Set(
      (question?.coding?.testCases ?? []).filter((c) => c.isSample).map((c) => c.id),
    );
    const byId = new Map((question?.coding?.testCases ?? []).map((c) => [c.id, c]));

    return {
      id: submission.id,
      questionId,
      status: submission.status as SubmissionStatus,
      marks: Number(submission.marks),
      maxMarks,
      attempts: submission.attempt,
      attemptsLeft:
        attemptsPerQuestion === 0 ? null : Math.max(0, attemptsPerQuestion - submission.attempt),
      ...(reveal
        ? {
            explanation: question?.explanation ?? '',
            correctOptionIds: (question?.options ?? []).filter((o) => o.isCorrect).map((o) => o.id),
          }
        : {}),
      ...(question?.coding
        ? {
            trust: this.execution.trust,
            passedTests: (submission.results ?? []).filter((r) => r.passed).length,
            totalTests: question.coding.testCases.length,
            sampleResults: (submission.results ?? [])
              .filter((r) => r.testCaseId && sampleIds.has(r.testCaseId))
              .map((r) => ({
                testCaseId: r.testCaseId as string,
                passed: r.passed,
                input: byId.get(r.testCaseId as string)?.input,
                expectedOutput: byId.get(r.testCaseId as string)?.expectedOutput,
                actualOutput: r.actualOutput,
                stderr: r.stderr,
              })),
          }
        : {}),
      submittedAt: submission.submittedAt.toISOString(),
    };
  }

  /** Establishes that the caller is a learner this assignment was published to. */
  private async requireAccess(assignmentId: string, user: AuthUser) {
    const person = await this.scope.personFor(user.id);
    if (!person.studentId) {
      throw new ForbiddenError('Only a learner answers an assignment');
    }
    const publication = await this.prisma.assignmentPublication.findFirst({
      where: {
        assignmentId,
        withdrawnAt: null,
        batchId: { in: person.batchIds },
      },
      orderBy: { dueAt: 'asc' },
    });
    if (!publication) {
      throw new ForbiddenError('That assignment has not been published to you');
    }
    return { studentId: person.studentId, publication };
  }

  /** Walks the modules in order, so a locked module cannot be skipped by opening a question in it. */
  private async requireUnlocked(
    assignmentId: string,
    position: number,
    studentId: string,
  ): Promise<void> {
    if (position === 0) return;
    const modules = await this.prisma.assignmentModule.findMany({
      where: { assignmentId, position: { lte: position } },
      orderBy: { position: 'asc' },
      include: { questions: { select: { id: true } } },
    });
    const submissions = await this.prisma.submission.findMany({
      where: { assignmentId, studentId },
    });
    const best = bestPerQuestion(submissions);

    let previousPercent = 100;
    for (const module of modules) {
      const rule = module.unlockRule as UnlockRule;
      if (module.position === position && rule.type === 'after_previous') {
        if (previousPercent < rule.minPercent) {
          throw new ForbiddenError(lockReason(rule.minPercent), 'module_locked');
        }
      }
      const solved = module.questions.filter((placement) => {
        const submission = best.get(placement.id);
        return submission?.status === 'correct' || submission?.status === 'partial';
      }).length;
      previousPercent =
        module.questions.length === 0 ? 100 : Math.round((solved / module.questions.length) * 100);
    }
  }
}

function lockReason(required: number): string {
  return required >= 100
    ? 'Finish the previous module to open this one'
    : `Reach ${required}% of the previous module to open this one`;
}
