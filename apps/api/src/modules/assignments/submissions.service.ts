import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ANSWER_FILE_KIND_MIMES,
  EXECUTED_TYPES,
  OBJECTIVE_TYPES,
  questionSpecSchema,
  type ExecutionLanguage,
  type Paginated,
  type ReviewInput,
  type ReviewQueueItem,
  type RunInput,
  type RunOutcome,
  type SubmissionInput,
  type SubmissionStatus,
  type SubmissionView,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission } from '../../core/auth/auth-user.js';
import {
  AppError,
  ConflictError,
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { ScopeService, narrowToBatch } from '../../core/scope/scope.service.js';
import { signedDownload } from '../../core/storage/signed-download.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { ExecutionGate, ExecutionService, ExecutionUnavailableError } from '../execution/index.js';
import { requireAttachableFile } from '../files/index.js';
import { NotificationsService } from '../notifications/index.js';
import {
  LearnerAssignmentsService,
  revealAnswers,
  type AnswerContext,
} from './learner-assignments.service.js';
import {
  SUBMISSION_VIEW_INCLUDE,
  SubmissionViewsService,
  submissionProgress,
} from './submission-views.service.js';

export const EVALUATE_JOB = 'assignments.evaluate';
export const EVALUATION_SWEEP_JOB = 'assignments.evaluation-sweep';
/** How many times a sandbox outage is retried before the answer is marked as not checked. */
const EVALUATION_RETRIES = 3;
/** What a learner sees of one case's output, stored with the result. */
const STORED_OUTPUT_CHARS = 8_000;

/**
 * Answering an assignment question, and everything that happens to the answer afterwards.
 *
 * - An objective answer is marked the moment it arrives.
 * - A coding or SQL answer is stored as it was sent and queued; the evaluation job runs it in the
 *   sandbox against every case, hidden ones included, and writes the result once (ADR-0016).
 * - A written, file, practical or project answer waits for a person.
 *
 * A submission never changes after it is made. A reviewer's decision is a new review row; the
 * marks it gives are cached on the submission so lists stay cheap.
 */
@Injectable()
export class SubmissionsService implements OnModuleInit {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly learner: LearnerAssignmentsService,
    private readonly views: SubmissionViewsService,
    private readonly execution: ExecutionService,
    private readonly gate: ExecutionGate,
    private readonly jobs: JobsService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  onModuleInit(): void {
    this.jobs.register<{ submissionId: string }>(
      EVALUATE_JOB,
      (payload, meta) => this.evaluateSubmission(payload.submissionId, meta.final),
      { concurrency: 2 },
    );
    this.jobs.register(
      EVALUATION_SWEEP_JOB,
      async () => {
        await this.sweep();
      },
      { cron: '*/5 * * * *' },
    );
  }

  // ───────────────────────── the learner ─────────────────────────

  /**
   * Tries code on the visible cases or the learner's own input. Nothing is recorded. One run at a
   * time per person, as in the Labs (ADR-0021).
   */
  async run(
    user: AuthUser,
    assignmentId: string,
    placementId: string,
    input: RunInput,
  ): Promise<RunOutcome> {
    const context = await this.learner.answerContext(user, assignmentId, placementId);
    if (!EXECUTED_TYPES.includes(context.question.type)) {
      throw new DomainRuleError('Only a coding or SQL answer can be run', 'not_runnable');
    }
    const problem = await this.execution.loadProblem(context.question.id);
    if (!problem) throw new NotFoundError('Question');
    return this.gate.run(user.id, () =>
      this.execution.run(problem, input.language, input.code, input.customInput, input.caseIds),
    );
  }

  async submit(
    user: AuthUser,
    assignmentId: string,
    placementId: string,
    input: SubmissionInput,
  ): Promise<SubmissionView> {
    const reach = await this.learner.reach(user);

    // The same key twice (a retry after a dropped connection) returns the first submission.
    if (input.idempotencyKey) {
      const earlier = await this.prisma.submission.findUnique({
        where: {
          studentId_idempotencyKey: {
            studentId: reach.studentId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (earlier) {
        if (earlier.assignmentQuestionId !== placementId) {
          throw new ConflictError(
            'That submission key was already used for another question',
            'idempotency_key_reused',
          );
        }
        return this.mine(user, earlier.id);
      }
    }

    const context = await this.learner.answerContext(user, assignmentId, placementId);
    const block = this.learner.submitBlock(context.state, context.placementState);
    if (block) {
      throw block.status === 409
        ? new ConflictError(block.message, block.code)
        : new DomainRuleError(block.message, block.code);
    }
    const answer = await this.checkAnswer(context, input, user);

    const submission = await this.create(context, reach.studentId, input, answer);
    await this.audit.record({
      action: 'submission.created',
      resourceType: 'submission',
      resourceId: submission.id,
      summary: `Attempt ${submission.attempt} at "${context.question.title}"`,
      after: { assignmentId, placementId, status: submission.status },
    });
    this.events.emit('submission.created', {
      submissionId: submission.id,
      assignmentId,
      studentId: reach.studentId,
      status: submission.status,
    });
    if (submission.status === 'evaluating') {
      await this.jobs.enqueue(
        EVALUATE_JOB,
        { submissionId: submission.id },
        { singletonKey: submission.id, retryLimit: EVALUATION_RETRIES, retryDelaySeconds: 15 },
      );
    }
    return this.mine(user, submission.id);
  }

  /** One of the learner's own submissions. */
  async mine(user: AuthUser, submissionId: string): Promise<SubmissionView> {
    const reach = await this.learner.reach(user);
    const row = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: SUBMISSION_VIEW_INCLUDE,
    });
    // Somebody else's submission reads the same as one that does not exist.
    if (!row || row.studentId !== reach.studentId) throw new NotFoundError('Submission');
    const context = await this.learner.answerContext(
      user,
      row.assignmentId,
      row.assignmentQuestionId,
    );
    return this.views.toView(row, {
      staff: false,
      revealAnswers: revealAnswers(
        context.reached.assignment.settings,
        context.placementState,
        context.state,
        new Date(),
      ),
    });
  }

  /** A signed link to a file handed in with a submission, for its owner or a reviewer. */
  async fileLink(user: AuthUser, submissionId: string, fileId: string): Promise<{ url: string }> {
    const row = await this.prisma.submission.findUnique({ where: { id: submissionId } });
    if (!row || !row.fileIds.includes(fileId)) throw new NotFoundError('File');
    const student = await this.prisma.studentProfile.findUnique({ where: { userId: user.id } });
    if (student?.id !== row.studentId) await this.requireReviewAccess(user, row);
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.status !== 'ready') throw new NotFoundError('File');
    return {
      url: await signedDownload(this.storage, 'private', file.key, 'File', 900, file.originalName),
    };
  }

  // ───────────────────────── staff ─────────────────────────

  /** A submission as a reviewer sees it: everything, hidden cases included. */
  async staffView(user: AuthUser, submissionId: string): Promise<SubmissionView> {
    const row = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: SUBMISSION_VIEW_INCLUDE,
    });
    if (!row) throw new NotFoundError('Submission');
    await this.requireReviewAccess(user, row);
    const [view, reviewContext] = await Promise.all([
      this.views.toView(row, { staff: true, revealAnswers: true }),
      this.views.reviewContext(row),
    ]);
    return { ...view, reviewContext };
  }

  /** Answers waiting for a person, or already decided, in the reviewer's batches. */
  async reviewQueue(
    user: AuthUser,
    query: {
      page: number;
      pageSize: number;
      q?: string;
      assignmentId?: string;
      batchId?: string;
      state: 'pending' | 'reviewed' | 'all';
      type?: string;
    },
  ): Promise<Paginated<ReviewQueueItem>> {
    const batches = narrowToBatch(
      await this.scope.visibleBatchIds(user, 'assignments:grade'),
      query.batchId,
    );
    const where = {
      assignment: { deletedAt: null, ...(query.assignmentId ? { id: query.assignmentId } : {}) },
      ...(query.state === 'pending'
        ? { status: 'awaiting_grading' as const, reviewDecision: null }
        : query.state === 'reviewed'
          ? { reviewDecision: { not: null } }
          : {}),
      ...(query.type ? { question: { type: query.type as never } } : {}),
      ...(query.q
        ? {
            OR: [
              { student: { user: { name: { contains: query.q, mode: 'insensitive' as const } } } },
              { student: { studentCode: { contains: query.q, mode: 'insensitive' as const } } },
              { question: { title: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
      ...(batches === null
        ? {}
        : {
            student: { members: { some: { isActive: true, batchId: { in: batches } } } },
            AND: [
              {
                assignment: {
                  publications: {
                    some: {
                      OR: [
                        { batchId: { in: batches } },
                        {
                          student: {
                            members: { some: { isActive: true, batchId: { in: batches } } },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.submission.findMany({
        where,
        orderBy: { submittedAt: query.state === 'pending' ? 'asc' : 'desc' },
        ...skipTake(query),
        include: {
          assignment: { select: { title: true } },
          question: { select: { title: true, type: true } },
          student: {
            select: {
              id: true,
              studentCode: true,
              user: { select: { name: true } },
              members: {
                where: { isActive: true },
                select: { batch: { select: { code: true } } },
                take: 1,
              },
            },
          },
        },
      }),
      this.prisma.submission.count({ where }),
    ]);
    return paginate(
      rows.map((row) => ({
        submissionId: row.id,
        assignmentId: row.assignmentId,
        assignmentTitle: row.assignment.title,
        placementId: row.assignmentQuestionId,
        questionTitle: row.question.title,
        questionType: row.question.type as ReviewQueueItem['questionType'],
        studentId: row.student.id,
        studentName: row.student.user.name,
        studentCode: row.student.studentCode,
        batchCode: row.student.members[0]?.batch.code ?? '',
        attempt: row.attempt,
        status: submissionProgress(row),
        marks: Number(row.marks),
        maxMarks: row.maxMarks,
        reviewDecision: (row.reviewDecision as ReviewQueueItem['reviewDecision']) ?? null,
        submittedAt: row.submittedAt.toISOString(),
      })),
      total,
      query,
    );
  }

  /**
   * A reviewer's decision. It is added, never written over: the review list keeps every decision
   * and who made it, and the submission's own content is never touched.
   */
  async review(user: AuthUser, submissionId: string, input: ReviewInput): Promise<SubmissionView> {
    const row = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { question: { select: { title: true } }, student: { select: { userId: true } } },
    });
    if (!row) throw new NotFoundError('Submission');
    await this.requireReviewAccess(user, row);
    if (row.status === 'evaluating') {
      throw new ConflictError('This answer is still being checked', 'evaluation_in_progress');
    }
    if (input.marks !== null && input.marks > row.maxMarks) {
      throw new DomainRuleError(
        `This question is worth ${row.maxMarks} marks`,
        'marks_above_maximum',
      );
    }

    const current = Number(row.marks);
    const marks =
      input.marks ??
      (input.decision === 'approved' && row.status === 'awaiting_grading' ? row.maxMarks : current);
    const status: SubmissionStatus =
      marks >= row.maxMarks ? 'correct' : marks > 0 ? 'partial' : 'incorrect';
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.submissionReview.create({
        data: {
          submissionId,
          reviewerId: user.id,
          decision: input.decision,
          marks: input.marks,
          comment: input.comment,
        },
      }),
      this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          marks,
          status,
          reviewDecision: input.decision,
          reviewedAt: now,
          graderComment: input.comment.slice(0, 2000),
          gradedById: user.id,
          gradedAt: now,
        },
      }),
    ]);

    await this.audit.record({
      action: 'submission.reviewed',
      resourceType: 'submission',
      resourceId: submissionId,
      summary: `${input.decision}: ${marks} of ${row.maxMarks} marks`,
      before: { marks: current, status: row.status },
      after: { marks, status, decision: input.decision },
    });
    await this.notifications.notifyUser(row.student.userId, {
      category: 'assessment',
      type: 'submission.reviewed',
      title:
        input.decision === 'resubmission_requested'
          ? `Try "${row.question.title}" again`
          : `"${row.question.title}" has been marked`,
      body:
        input.decision === 'resubmission_requested'
          ? 'Your reviewer asked for another attempt; their comment says what to change.'
          : `You scored ${marks} of ${row.maxMarks}.`,
      link: `/assignments/${row.assignmentId}/q/${row.assignmentQuestionId}`,
      channels: ['in_app'],
    });
    this.events.emit('submission.graded', { submissionId, studentId: row.studentId });
    return this.staffView(user, submissionId);
  }

  /** Runs again an answer the sandbox could not check (it was down or timed out). */
  async reEvaluate(user: AuthUser, submissionId: string): Promise<SubmissionView> {
    const row = await this.prisma.submission.findUnique({ where: { id: submissionId } });
    if (!row) throw new NotFoundError('Submission');
    await this.requireReviewAccess(user, row);
    if (row.status !== 'error') {
      throw new DomainRuleError(
        'Only an answer that could not be checked is run again',
        'not_in_error',
      );
    }
    await this.prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'evaluating', evaluationError: '' },
    });
    await this.audit.record({
      action: 'submission.re_evaluated',
      resourceType: 'submission',
      resourceId: submissionId,
      summary: 'Sent to the sandbox again',
    });
    await this.jobs.enqueue(
      EVALUATE_JOB,
      { submissionId },
      { singletonKey: submissionId, retryLimit: EVALUATION_RETRIES, retryDelaySeconds: 15 },
    );
    return this.staffView(user, submissionId);
  }

  // ───────────────────────── evaluation ─────────────────────────

  /**
   * The evaluation job. Safe to run twice: only a submission still marked `evaluating` is taken,
   * and the result is written by whichever run claims it first.
   */
  async evaluateSubmission(submissionId: string, final: boolean): Promise<void> {
    const row = await this.prisma.submission.findUnique({ where: { id: submissionId } });
    if (!row || row.status !== 'evaluating') return;
    const problem = await this.execution.loadProblem(row.questionId);
    if (!problem) {
      await this.markNotChecked(
        submissionId,
        'This question has no test cases to check the answer against.',
      );
      return;
    }

    let evaluation;
    try {
      evaluation = await this.execution.evaluate(
        problem,
        row.language as ExecutionLanguage,
        row.code,
      );
    } catch (error) {
      // An outage is retried by the queue; on the last try the answer is marked as not checked.
      if (error instanceof ExecutionUnavailableError && !final) throw error;
      this.logger.warn({ err: error, submissionId }, 'A submission could not be evaluated');
      await this.markNotChecked(
        submissionId,
        'The answer could not be checked just now. It does not count against your attempts; submit it again.',
      );
      return;
    }

    const marks = Math.round(row.maxMarks * evaluation.ratio * 100) / 100;
    const status: SubmissionStatus =
      evaluation.ratio >= 1 ? 'correct' : evaluation.ratio > 0 ? 'partial' : 'incorrect';
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.submission.updateMany({
        where: { id: submissionId, status: 'evaluating' },
        data: {
          status,
          marks,
          autoMarks: marks,
          passedCount: evaluation.passed,
          totalCount: evaluation.total,
          durationMs: evaluation.durationMs,
          memoryKb: evaluation.memoryKb,
          compileOutput: evaluation.compileOutput.slice(0, 16_384),
          driver: evaluation.driver,
          trust: evaluation.trust,
          evaluatedAt: new Date(),
        },
      });
      if (claimed.count === 0) return;
      await tx.submissionResult.createMany({
        data: evaluation.cases.map((c, position) => ({
          submissionId,
          testCaseId: c.case.id,
          passed: c.passed,
          verdict: c.verdict,
          actualOutput: c.stdout.slice(0, STORED_OUTPUT_CHARS),
          stderr: c.stderr.slice(0, STORED_OUTPUT_CHARS),
          durationMs: c.durationMs,
          memoryKb: c.memoryKb,
          isSample: c.case.isSample,
          weight: c.case.weight,
          position,
        })),
      });
    });
    this.events.emit('submission.evaluated', { submissionId, status, marks });
  }

  /** Every few minutes: answers stuck in the queue go back to it, or are marked not checked. */
  async sweep(now = new Date()): Promise<number> {
    const stuck = await this.prisma.submission.findMany({
      where: { status: 'evaluating', submittedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
      select: { id: true, submittedAt: true },
      take: 100,
    });
    for (const row of stuck) {
      if (row.submittedAt < new Date(now.getTime() - 60 * 60_000)) {
        await this.markNotChecked(
          row.id,
          'The answer could not be checked in time. Submit it again.',
        );
      } else {
        await this.jobs.enqueue(EVALUATE_JOB, { submissionId: row.id }, { singletonKey: row.id });
      }
    }
    return stuck.length;
  }

  // ───────────────────────── internals ─────────────────────────

  private async markNotChecked(submissionId: string, message: string): Promise<void> {
    await this.prisma.submission.updateMany({
      where: { id: submissionId, status: 'evaluating' },
      data: { status: 'error', evaluationError: message.slice(0, 500), evaluatedAt: new Date() },
    });
  }

  /**
   * Checks an answer against what its question asks for and works out what can be decided at
   * once. Nothing here trusts the client beyond the answer itself.
   */
  private async checkAnswer(
    context: AnswerContext,
    input: SubmissionInput,
    user: AuthUser,
  ): Promise<{
    status: SubmissionStatus;
    marks: number;
    evaluationError: string;
    optionIds: string[];
    language: string;
    code: string;
    text: string;
    fileIds: string[];
    payload: Record<string, unknown>;
  }> {
    const { question } = context;
    const empty = {
      optionIds: [],
      language: '',
      code: '',
      text: '',
      fileIds: [],
      payload: {},
      evaluationError: '',
    };

    if (OBJECTIVE_TYPES.includes(question.type)) {
      const chosen = [...new Set(input.optionIds)];
      const known = new Set(question.options.map((o) => o.id));
      if (chosen.length === 0) {
        throw new ValidationError([{ path: 'optionIds', message: 'Choose an answer' }]);
      }
      if (chosen.some((id) => !known.has(id))) {
        throw new ValidationError([
          { path: 'optionIds', message: 'That is not one of the options' },
        ]);
      }
      if (question.type !== 'mcq_multi' && chosen.length > 1) {
        throw new ValidationError([{ path: 'optionIds', message: 'Choose one answer' }]);
      }
      const correct = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
      const right = chosen.length === correct.size && chosen.every((id) => correct.has(id));
      return {
        ...empty,
        optionIds: chosen,
        status: right ? 'correct' : 'incorrect',
        marks: right ? context.placement.marks : 0,
      };
    }

    if (EXECUTED_TYPES.includes(question.type)) {
      if (!input.language) {
        throw new ValidationError([{ path: 'language', message: 'Choose a language' }]);
      }
      if (!input.code.trim()) {
        throw new ValidationError([{ path: 'code', message: 'Write your answer first' }]);
      }
      const problem = await this.prisma.codingProblem.findUnique({
        where: { questionId: question.id },
        select: { languages: true },
      });
      if (!problem?.languages.includes(input.language)) {
        throw new DomainRuleError(
          `This question is answered in ${problem?.languages.join(', ') ?? 'another language'}`,
          'language_not_offered',
        );
      }
      // Without a sandbox the answer still counts: it waits for a person instead.
      return {
        ...empty,
        language: input.language,
        code: input.code,
        status: this.execution.available ? 'evaluating' : 'awaiting_grading',
        marks: 0,
        evaluationError: this.execution.available
          ? ''
          : 'Code is not run automatically on this installation; a reviewer will mark this answer.',
      };
    }

    if (question.type === 'descriptive') {
      if (!input.text.trim()) {
        throw new ValidationError([{ path: 'text', message: 'Write your answer first' }]);
      }
      return { ...empty, text: input.text, status: 'awaiting_grading', marks: 0 };
    }

    // File upload, practical and project: files, links and a checklist, as the question asks.
    const spec = questionSpecSchema.parse(question.spec ?? {});
    const issues: { path: string; message: string }[] = [];
    if (spec.linkRequired && input.links.length === 0) {
      issues.push({ path: 'links', message: `Add the ${spec.linkLabel || 'link'}` });
    }
    if (spec.maxFiles > 0 && !spec.linkRequired && input.fileIds.length === 0) {
      issues.push({ path: 'fileIds', message: 'Attach your file' });
    }
    if (input.fileIds.length > spec.maxFiles) {
      issues.push({ path: 'fileIds', message: `Attach at most ${spec.maxFiles} file(s)` });
    }
    const confirmed = new Set(input.checklist);
    if (spec.checklist.some((_, index) => !confirmed.has(index))) {
      issues.push({ path: 'checklist', message: 'Confirm every point on the checklist' });
    }
    if (issues.length > 0) throw new ValidationError(issues);

    const allowed = new Set(spec.fileKinds.flatMap((kind) => ANSWER_FILE_KIND_MIMES[kind]));
    for (const fileId of new Set(input.fileIds)) {
      const file = await requireAttachableFile(this.prisma, fileId, {
        contexts: ['assignment-submission'],
        uploadedBy: user.id,
        unattached: true,
      });
      if (allowed.size > 0 && !allowed.has(file.mime)) {
        throw new DomainRuleError(
          'That kind of file is not accepted for this question',
          'file_kind_not_allowed',
        );
      }
    }
    return {
      ...empty,
      text: input.text,
      fileIds: [...new Set(input.fileIds)],
      payload: { links: input.links, checklist: [...confirmed].sort((a, b) => a - b) },
      status: 'awaiting_grading',
      marks: 0,
    };
  }

  /** Writes the submission with the next attempt number, claiming any files it hands in. */
  private async create(
    context: AnswerContext,
    studentId: string,
    input: SubmissionInput,
    answer: Awaited<ReturnType<SubmissionsService['checkAnswer']>>,
  ) {
    // The allowance as the learner's state saw it: attempts used plus attempts left (null: no limit).
    const { attempts, attemptsLeft } = context.placementState;
    const allowance = attemptsLeft === null ? null : attempts + attemptsLeft;
    const now = new Date();
    for (let tries = 0; ; tries += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const last = await tx.submission.findFirst({
            where: { assignmentQuestionId: context.placement.id, studentId },
            orderBy: { attempt: 'desc' },
            select: { attempt: true },
          });
          // Counted again inside the transaction: parallel submits collide on the attempt number,
          // and the one that retries finds the attempts already used, so none slips past the limit.
          if (allowance !== null) {
            const used = await tx.submission.count({
              where: {
                assignmentQuestionId: context.placement.id,
                studentId,
                status: { not: 'error' },
              },
            });
            if (used >= allowance) {
              throw new DomainRuleError(
                'You have used every attempt at this question',
                'attempts_exhausted',
              );
            }
          }
          const created = await tx.submission.create({
            data: {
              assignmentId: context.reached.assignment.id,
              assignmentQuestionId: context.placement.id,
              questionId: context.question.id,
              studentId,
              attempt: (last?.attempt ?? 0) + 1,
              status: answer.status,
              marks: answer.marks,
              autoMarks: OBJECTIVE_TYPES.includes(context.question.type) ? answer.marks : null,
              maxMarks: context.placement.marks,
              optionIds: answer.optionIds,
              text: answer.text,
              code: answer.code,
              language: answer.language,
              fileIds: answer.fileIds,
              payload: asJson(answer.payload),
              timeSpentSeconds: input.timeSpentSeconds,
              questionVersion: context.question.version,
              evaluationError: answer.evaluationError,
              idempotencyKey: input.idempotencyKey ?? null,
              // Accepted after the learner's due date (the publication still takes late answers).
              isLate: Boolean(context.state.dueAt && now > context.state.dueAt),
              ...(OBJECTIVE_TYPES.includes(context.question.type)
                ? { evaluatedAt: new Date() }
                : {}),
            },
          });
          if (answer.fileIds.length > 0) {
            const claimed = await tx.file.updateMany({
              where: { id: { in: answer.fileIds }, ownerId: null },
              data: { ownerId: created.id },
            });
            if (claimed.count !== answer.fileIds.length) {
              throw new ConflictError(
                'A file was attached somewhere else meanwhile',
                'file_in_use',
              );
            }
          }
          return created;
        });
      } catch (error) {
        // Two submits at the same moment race for the same attempt number; the loser tries again.
        const duplicate = (error as { code?: string }).code === 'P2002';
        if (!duplicate || tries >= 2 || error instanceof AppError) throw error;
      }
    }
  }

  /**
   * Whether a member of staff may see and review a learner's answer: they mark assignments, the
   * learner is in a batch they teach, and the assignment reached the learner through that batch
   * or personally. Sharing a batch with the learner is not enough on its own.
   */
  private async requireReviewAccess(
    user: AuthUser,
    submission: { assignmentId: string; studentId: string },
  ): Promise<void> {
    if (!hasPermission(user, 'assignments:grade')) {
      throw new ForbiddenError('You do not have access to this resource');
    }
    const visible = await this.scope.visibleBatchIds(user, 'assignments:grade');
    if (visible === null) return;
    const memberships = await this.prisma.batchMember.findMany({
      where: { studentId: submission.studentId, isActive: true, batchId: { in: visible } },
      select: { batchId: true },
    });
    const shared = memberships.map((m) => m.batchId);
    if (shared.length === 0) throw new ForbiddenError('That learner is not in your batches');
    const reaching = await this.prisma.assignmentPublication.count({
      where: {
        assignmentId: submission.assignmentId,
        OR: [{ batchId: { in: shared } }, { studentId: submission.studentId }],
      },
    });
    if (reaching === 0) {
      throw new ForbiddenError('That assignment was not given through a batch you teach');
    }
  }
}
