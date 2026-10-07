import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EXECUTED_TYPES,
  REVIEWED_TYPES,
  type AttemptAnswersInput,
  type AttemptQuestionView,
  type AttemptResult,
  type AttemptResultQuestion,
  type AttemptState,
  type AttemptStatus,
  type ExecutionLanguage,
  type QuestionType,
  type RunInput,
  type RunOutcome,
  type SubmissionStatus,
  type TestCard,
  type TestGradingItem,
  type TestKind,
  definedFields,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission, scopeFor } from '../../core/auth/auth-user.js';
import {
  ConflictError,
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../core/http/errors.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { ModuleStateService } from '../../core/registry/module-state.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { ExecutionGate, ExecutionService } from '../execution/index.js';
import { NotificationsService } from '../notifications/index.js';
import { TestsService } from './tests.service.js';

export const ATTEMPT_AUTOSUBMIT_JOB = 'tests.autosubmit';

/** How far ahead a test window that has not opened yet counts as coming up (Phase 9C). */
const WINDOW_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * A test window still to sit, as SI Academy AI may be told of it (Phase 9C; ADR-0040): its title
 * and its times, as the learner's tests page shows them — never a question, an instruction, a mark
 * or anybody else's attempt.
 */
export interface AiTestWindow {
  title: string;
  window: 'live' | 'upcoming';
  opensAt: Date;
  closesAt: Date;
}

/**
 * Sitting a test.
 *
 * The deadline belongs to the server: `expiresAt` is written when the attempt starts, every save
 * is refused after it, and a job submits anything still open. A client whose clock is wrong, or
 * whose window was closed, changes nothing (plan AC-07.1).
 */
@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly scope: ScopeService,
    private readonly tests: TestsService,
    private readonly execution: ExecutionService,
    private readonly gate: ExecutionGate,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobsService,
    private readonly modules: ModuleStateService,
  ) {
    this.jobs.register(
      ATTEMPT_AUTOSUBMIT_JOB,
      async () => {
        await this.submitExpired();
      },
      { cron: '* * * * *' },
    );
  }

  // ───────────────────────── the learner's list ─────────────────────────

  /**
   * The learner's test windows open now, or opening within two weeks, that they have not sat yet
   * (`AiTestWindow`), for SI Academy AI's learning agent (Phase 9C; ADR-0040). It asks first, itself,
   * what the learner's tests route asks: `tests:read` and the Tests module on for them, and a
   * learner's profile. At most `limit`, the soonest to close first; nothing is recorded.
   */
  async aiOpenWindows(user: AuthUser, limit = 3, now = new Date()): Promise<AiTestWindow[]> {
    if (!hasPermission(user, 'tests:read') || !(await this.modules.isEnabledFor('tests', user))) {
      throw new ForbiddenError('Tests are not open to you');
    }
    const person = await this.scope.personFor(user.id);
    if (!person.studentId) throw new ForbiddenError('Only a learner has tests to sit');
    if (person.memberBatchIds.length === 0) return [];
    const schedules = await this.prisma.testSchedule.findMany({
      where: {
        batchId: { in: person.memberBatchIds },
        test: { deletedAt: null, status: 'published' },
        closesAt: { gt: now },
        opensAt: { lte: new Date(now.getTime() + WINDOW_HORIZON_MS) },
      },
      orderBy: { closesAt: 'asc' },
      take: 20,
      select: { id: true, opensAt: true, closesAt: true, test: { select: { title: true } } },
    });
    const sat = new Set(
      (
        await this.prisma.testAttempt.findMany({
          where: {
            studentId: person.studentId,
            scheduleId: { in: schedules.map((schedule) => schedule.id) },
            status: { not: 'in_progress' },
          },
          select: { scheduleId: true },
        })
      ).map((attempt) => attempt.scheduleId),
    );
    return schedules
      .filter((schedule) => !sat.has(schedule.id))
      .slice(0, limit)
      .map((schedule) => ({
        title: schedule.test.title,
        window: schedule.opensAt <= now ? ('live' as const) : ('upcoming' as const),
        opensAt: schedule.opensAt,
        closesAt: schedule.closesAt,
      }));
  }

  /**
   * Whether a person has a timed attempt open now: one in progress whose time has not run out. No
   * AI help is given while one is (ADR-0031).
   */
  async hasOpenAttempt(userId: string, now = new Date()): Promise<boolean> {
    const open = await this.prisma.testAttempt.count({
      where: { student: { userId }, status: 'in_progress', expiresAt: { gt: now } },
    });
    return open > 0;
  }

  async mine(user: AuthUser): Promise<TestCard[]> {
    const person = await this.scope.personFor(user.id);
    if (!person.studentId || person.memberBatchIds.length === 0) return [];
    const schedules = await this.prisma.testSchedule.findMany({
      where: {
        batchId: { in: person.memberBatchIds },
        test: { deletedAt: null, status: 'published' },
      },
      include: { test: { include: { sections: { include: { questions: true } } } } },
      orderBy: { opensAt: 'desc' },
    });
    const attempts = await this.prisma.testAttempt.findMany({
      where: { studentId: person.studentId, scheduleId: { in: schedules.map((s) => s.id) } },
      orderBy: { attempt: 'desc' },
    });
    const now = Date.now();

    return schedules.map((schedule) => {
      const settings = this.tests.settingsOf(schedule.test);
      const mine = attempts.filter((a) => a.scheduleId === schedule.id);
      const latest = mine[0] ?? null;
      const maxAttempts = schedule.maxAttempts ?? settings.maxAttempts;
      const questions = schedule.test.sections.flatMap((s) => s.questions);
      const window =
        now < schedule.opensAt.getTime()
          ? ('upcoming' as const)
          : now > schedule.closesAt.getTime()
            ? ('closed' as const)
            : ('live' as const);
      const released = Boolean(schedule.releasedAt) || settings.resultPolicy === 'immediately';
      const finished = latest && latest.status !== 'in_progress';

      return {
        testId: schedule.testId,
        scheduleId: schedule.id,
        title: schedule.test.title,
        description: schedule.test.description,
        instructions: schedule.test.instructions,
        kind: schedule.test.kind as TestKind,
        subject: schedule.test.subject,
        durationMinutes: settings.durationMinutes,
        opensAt: schedule.opensAt.toISOString(),
        closesAt: schedule.closesAt.toISOString(),
        window,
        attemptsUsed: mine.length,
        maxAttempts,
        canStart:
          window === 'live' && (latest?.status === 'in_progress' || mine.length < maxAttempts),
        attemptId: latest?.id ?? null,
        attemptStatus: (latest?.status as AttemptStatus | undefined) ?? null,
        attempts: mine.map((attempt) => ({
          attemptId: attempt.id,
          attempt: attempt.attempt,
          status: attempt.status as AttemptStatus,
          submittedAt: attempt.submittedAt?.toISOString() ?? null,
        })),
        resultAvailable: Boolean(finished && released),
        score: finished && released ? Number(latest.score) : null,
        totalMarks: questions.reduce((n, q) => n + q.marks, 0),
      };
    });
  }

  // ───────────────────────── starting and sitting ─────────────────────────

  /**
   * Starts a sitting, or hands back the one already open. Two tabs cannot become two attempts:
   * the unique index on (schedule, student, attempt) is what makes the second one lose (AC-07.4).
   */
  async start(testId: string, user: AuthUser): Promise<AttemptState> {
    const person = await this.scope.personFor(user.id);
    if (!person.studentId) throw new ForbiddenError('Only a learner sits a test');

    const schedule = await this.prisma.testSchedule.findFirst({
      where: {
        testId,
        batchId: { in: person.memberBatchIds },
        test: { deletedAt: null, status: 'published' },
      },
      include: { test: true },
      orderBy: { opensAt: 'desc' },
    });
    if (!schedule) throw new ForbiddenError('That test has not been opened to you');

    const now = new Date();
    if (now < schedule.opensAt) {
      throw new DomainRuleError('This test has not opened yet', 'test_not_open');
    }
    if (now > schedule.closesAt) {
      throw new DomainRuleError('This test has closed', 'test_closed');
    }

    const open = await this.prisma.testAttempt.findFirst({
      where: { scheduleId: schedule.id, studentId: person.studentId, status: 'in_progress' },
    });
    if (open) return this.state(open.id, user);

    const settings = this.tests.settingsOf(schedule.test);
    const used = await this.prisma.testAttempt.count({
      where: { scheduleId: schedule.id, studentId: person.studentId },
    });
    const maxAttempts = schedule.maxAttempts ?? settings.maxAttempts;
    if (used >= maxAttempts) {
      throw new DomainRuleError(
        `You have used all ${maxAttempts} attempt(s) at this test`,
        'attempts_exhausted',
      );
    }

    const questions = await this.paperQuestions(testId);
    // The window closing is a hard stop, whatever the duration allows.
    const deadline = new Date(
      Math.min(now.getTime() + settings.durationMinutes * 60_000, schedule.closesAt.getTime()),
    );
    const order = settings.shuffleQuestions
      ? shuffle(questions.map((q) => q.id))
      : questions.map((q) => q.id);

    let attempt;
    try {
      attempt = await this.prisma.testAttempt.create({
        data: {
          testId,
          scheduleId: schedule.id,
          studentId: person.studentId,
          attempt: used + 1,
          expiresAt: deadline,
          totalMarks: questions.reduce((n, q) => n + q.marks, 0),
          questionOrder: order,
          answers: {
            create: questions.map((question) => ({ testQuestionId: question.id })),
          },
        },
      });
    } catch {
      // Another tab won the race; hand back the attempt it created.
      const existing = await this.prisma.testAttempt.findFirst({
        where: { scheduleId: schedule.id, studentId: person.studentId, status: 'in_progress' },
      });
      if (existing) return this.state(existing.id, user);
      throw new ConflictError('An attempt is already running', 'attempt_already_active');
    }

    await this.audit.record({
      action: 'attempt.started',
      resourceType: 'test_attempt',
      resourceId: attempt.id,
      summary: `${schedule.test.title}: attempt ${attempt.attempt}`,
      after: { testId, expiresAt: deadline.toISOString() },
    });
    return this.state(attempt.id, user);
  }

  /** The paper, the saved answers and how long is left, as the server sees all three. */
  async state(attemptId: string, user: AuthUser): Promise<AttemptState> {
    const attempt = await this.requireOwnAttempt(attemptId, user);
    const test = await this.prisma.test.findUniqueOrThrow({ where: { id: attempt.testId } });
    const settings = this.tests.settingsOf(test);
    const sections = await this.prisma.testSection.findMany({
      where: { testId: attempt.testId },
      orderBy: { position: 'asc' },
    });
    const questions = await this.prisma.testQuestion.findMany({
      where: { section: { testId: attempt.testId } },
      orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
      include: {
        question: {
          include: {
            options: { orderBy: { position: 'asc' } },
            coding: { include: { testCases: { orderBy: { position: 'asc' } } } },
          },
        },
      },
    });
    const answers = await this.prisma.testAnswer.findMany({ where: { attemptId } });
    const byQuestion = new Map(answers.map((a) => [a.testQuestionId, a]));
    // Once submitted, the paper is not handed back: the result page shows what the policy allows.
    const finished = attempt.status !== 'in_progress';

    const ordered =
      attempt.questionOrder.length > 0
        ? (attempt.questionOrder
            .map((id) => questions.find((q) => q.id === id))
            .filter(Boolean) as typeof questions)
        : questions;

    const now = new Date();
    const view: AttemptQuestionView[] = ordered.map((placement) => {
      const answer = byQuestion.get(placement.id);
      const options = placement.question.options.map((option) => ({
        id: option.id,
        body: option.body,
      }));
      return {
        testQuestionId: placement.id,
        sectionId: placement.sectionId,
        title: placement.question.title,
        body: placement.question.body,
        type: placement.question.type as QuestionType,
        marks: placement.marks,
        negativeMarks: Number(placement.negativeMarks),
        options: settings.shuffleOptions ? shuffle(options) : options,
        coding: placement.question.coding
          ? {
              languages: placement.question.coding.languages,
              starterCode: placement.question.coding.starterCode as Record<string, string>,
              timeLimitMs: placement.question.coding.timeLimitMs,
              // Only the samples; the hidden cases decide the mark but are never shown.
              testCases: placement.question.coding.testCases
                .filter((c) => c.isSample)
                .map((c) => ({ id: c.id, input: c.input, expectedOutput: c.expectedOutput })),
            }
          : null,
        optionIds: answer?.optionIds ?? [],
        text: answer?.text ?? '',
        code: answer?.code ?? '',
        language: answer?.language ?? '',
        flagged: answer?.flagged ?? false,
      };
    });

    return {
      attemptId: attempt.id,
      testId: attempt.testId,
      title: test.title,
      status: attempt.status as AttemptStatus,
      startedAt: attempt.startedAt.toISOString(),
      expiresAt: attempt.expiresAt.toISOString(),
      serverTime: now.toISOString(),
      secondsRemaining: Math.max(
        0,
        Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000),
      ),
      settings: {
        durationMinutes: settings.durationMinutes,
        trackTabSwitches: settings.trackTabSwitches,
        requireFullScreen: settings.requireFullScreen,
        shuffleOptions: settings.shuffleOptions,
      },
      sections: sections.map((s) => ({
        id: s.id,
        title: s.title,
        instructions: s.instructions,
        position: s.position,
      })),
      questions: finished ? [] : view,
      tabSwitches: attempt.tabSwitches,
      savedAt: attempt.lastSavedAt?.toISOString() ?? null,
    };
  }

  /** Autosave. Everything saved survives a dropped connection, which is what AC-07.2 asks for. */
  async saveAnswers(
    attemptId: string,
    input: AttemptAnswersInput,
    user: AuthUser,
  ): Promise<{ savedAt: string; secondsRemaining: number }> {
    const attempt = await this.requireOwnAttempt(attemptId, user);
    if (attempt.status !== 'in_progress') {
      throw new DomainRuleError('This attempt has been submitted', 'attempt_not_open');
    }
    const now = new Date();
    if (now > attempt.expiresAt) {
      await this.finish(attemptId, true);
      throw new DomainRuleError('Time is up; the attempt was submitted', 'attempt_expired');
    }

    const known = await this.prisma.testAnswer.findMany({
      where: { attemptId },
      select: { id: true, testQuestionId: true },
    });
    const byQuestion = new Map(known.map((a) => [a.testQuestionId, a.id]));
    for (const answer of input.answers) {
      const id = byQuestion.get(answer.testQuestionId);
      if (!id) continue; // a question that is not on this paper is ignored, not an error
      // Only the fields sent, and only while the attempt is still open: a save that arrives after
      // the attempt was submitted and marked changes nothing (Phase 6).
      await this.prisma.testAnswer.updateMany({
        where: { id, attempt: { status: 'in_progress', expiresAt: { gt: now } } },
        data: definedFields({
          optionIds: answer.optionIds,
          text: answer.text,
          code: answer.code,
          language: answer.language,
          flagged: answer.flagged,
          timeSpentSeconds: answer.timeSpentSeconds,
        }),
      });
    }
    await this.prisma.testAttempt.update({ where: { id: attemptId }, data: { lastSavedAt: now } });
    return {
      savedAt: now.toISOString(),
      secondsRemaining: Math.max(
        0,
        Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000),
      ),
    };
  }

  /**
   * Tries a coding answer on the question's visible cases, or on the learner's own input, while
   * the attempt is open (TRN-12). Nothing is recorded or marked, and hidden cases never run here:
   * they decide the mark when the attempt is submitted. One run at a time per person (ADR-0021).
   */
  async run(
    attemptId: string,
    testQuestionId: string,
    input: RunInput,
    user: AuthUser,
  ): Promise<RunOutcome> {
    const attempt = await this.requireOwnAttempt(attemptId, user);
    if (attempt.status !== 'in_progress') {
      throw new DomainRuleError('This attempt has been submitted', 'attempt_not_open');
    }
    if (new Date() > attempt.expiresAt) {
      await this.finish(attemptId, true);
      throw new DomainRuleError('Time is up; the attempt was submitted', 'attempt_expired');
    }
    const answer = await this.prisma.testAnswer.findFirst({
      where: { attemptId, testQuestionId },
      select: {
        testQuestion: { select: { questionId: true, question: { select: { type: true } } } },
      },
    });
    if (!answer) throw new NotFoundError('Question');
    if (answer.testQuestion.question.type !== 'coding') {
      throw new DomainRuleError('Only a coding answer can be run', 'not_runnable');
    }
    const problem = await this.execution.loadProblem(answer.testQuestion.questionId);
    if (!problem) throw new NotFoundError('Question');
    return this.gate.run(user.id, () =>
      this.execution.run(problem, input.language, input.code, input.customInput, input.caseIds),
    );
  }

  /** Records a tab switch or a full-screen exit. Counted and shown; never used to block. */
  async recordIntegrityEvent(
    attemptId: string,
    event: { type: string; occurredAt: string },
    user: AuthUser,
  ): Promise<{ tabSwitches: number }> {
    const attempt = await this.requireOwnAttempt(attemptId, user);
    if (attempt.status !== 'in_progress') return { tabSwitches: attempt.tabSwitches };
    // The column is a list; rows written before that was settled hold `{ events: [...] }`.
    const stored = attempt.integrityLog as unknown;
    const previous = Array.isArray(stored)
      ? stored
      : ((stored as { events?: unknown[] } | null)?.events ?? []);
    const log = [...previous, event].slice(-200);
    const updated = await this.prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        integrityLog: asJson(log),
        ...(event.type === 'tab_switch' ? { tabSwitches: { increment: 1 } } : {}),
      },
    });
    return { tabSwitches: updated.tabSwitches };
  }

  async submit(attemptId: string, user: AuthUser): Promise<AttemptResult> {
    const attempt = await this.requireOwnAttempt(attemptId, user);
    if (attempt.status !== 'in_progress') {
      return this.result(attemptId, user);
    }
    await this.finish(attemptId, false);
    return this.result(attemptId, user);
  }

  // ───────────────────────── results ─────────────────────────

  async result(attemptId: string, user: AuthUser): Promise<AttemptResult> {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: true,
        schedule: true,
        answers: {
          include: {
            testQuestion: {
              include: {
                section: { select: { id: true, title: true, position: true } },
                question: {
                  include: { options: { orderBy: { position: 'asc' } } },
                },
              },
            },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundError('Attempt');

    const person = await this.scope.personFor(user.id);
    const isOwner = person.studentId === attempt.studentId;
    // A learner's `tests:read` is scoped to their own work; only a batch- or institute-wide grant
    // reads somebody else's attempt, and then only in a batch that grant reaches.
    const readScope = scopeFor(user, 'tests:read');
    const isStaff = !isOwner && (readScope === 'all' || readScope === 'batch');
    if (!isOwner && !isStaff) throw new ForbiddenError('That attempt is not yours');
    if (isStaff) {
      await this.tests.findForStaff(attempt.testId, user, 'tests:read');
      await this.tests.requireBatchVisible(attempt.schedule.batchId, user, 'tests:read');
    }

    // A paper still being answered has no result for its owner: nothing here may help them answer it.
    if (isOwner && attempt.status === 'in_progress') {
      throw new DomainRuleError(
        'Submit the paper first; its result appears once it has been submitted',
        'attempt_in_progress',
      );
    }

    const settings = this.tests.settingsOf(attempt.test);
    const released =
      Boolean(attempt.schedule.releasedAt) || settings.resultPolicy === 'immediately';
    // Staff see the marks as soon as they exist; a learner waits for the release (AC-07.3).
    const showScore = isStaff || released;
    // The answers themselves, and how each question went, wait until every window of this test has
    // closed, whatever the release policy: a learner who has finished cannot pass the key, or which
    // answers were right, to anyone still sitting it, in their batch or another, or use them on a
    // second attempt. Until then a learner has the total and the section totals only.
    const lastWindow = await this.prisma.testSchedule.aggregate({
      where: { testId: attempt.testId },
      _max: { closesAt: true },
    });
    const closesAt = lastWindow._max.closesAt ?? attempt.schedule.closesAt;
    const windowClosed = closesAt.getTime() <= Date.now();
    const reviewAllowed = isStaff || settings.reviewPolicy === 'full';
    const showReview = showScore && reviewAllowed && (isStaff || windowClosed);
    const showQuestions = showScore && (isStaff || windowClosed);

    const sections = new Map<
      string,
      { id: string; title: string; score: number; totalMarks: number }
    >();
    const questions: AttemptResultQuestion[] = [];
    for (const answer of attempt.answers) {
      const placement = answer.testQuestion;
      const section = sections.get(placement.section.id) ?? {
        id: placement.section.id,
        title: placement.section.title,
        score: 0,
        totalMarks: 0,
      };
      section.totalMarks += placement.marks;
      section.score += Number(answer.marks);
      sections.set(section.id, section);

      questions.push({
        testQuestionId: placement.id,
        title: placement.question.title,
        type: placement.question.type as QuestionType,
        marks: placement.marks,
        awardedMarks: showScore ? Number(answer.marks) : 0,
        status: answer.status as SubmissionStatus,
        timeSpentSeconds: answer.timeSpentSeconds,
        ...(showReview
          ? {
              body: placement.question.body,
              options: placement.question.options.map((o) => ({ id: o.id, body: o.body })),
              explanation: placement.question.explanation,
              yourOptionIds: answer.optionIds,
              correctOptionIds: placement.question.options
                .filter((o) => o.isCorrect)
                .map((o) => o.id),
              yourText: answer.text || answer.code,
              graderComment: answer.graderComment,
            }
          : {}),
      });
    }

    let rank: number | null = null;
    let cohortSize: number | null = null;
    if (showScore && settings.showRank) {
      const peers = await this.prisma.testAttempt.findMany({
        where: { scheduleId: attempt.scheduleId, status: { in: ['submitted', 'graded'] } },
        select: { id: true, score: true },
        orderBy: { score: 'desc' },
      });
      cohortSize = peers.length;
      const index = peers.findIndex((p) => p.id === attemptId);
      rank = index >= 0 ? index + 1 : null;
    }

    return {
      attemptId,
      testId: attempt.testId,
      title: attempt.test.title,
      status: attempt.status as AttemptStatus,
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      released,
      score: showScore ? Number(attempt.score) : 0,
      totalMarks: attempt.totalMarks,
      percentage:
        showScore && attempt.totalMarks > 0
          ? Math.round((Number(attempt.score) / attempt.totalMarks) * 100)
          : 0,
      rank,
      cohortSize,
      // Section marks follow the same rule as the total: nothing before the release.
      sections: [...sections.values()].map((section) => ({
        ...section,
        score: showScore ? section.score : 0,
      })),
      questions: showQuestions ? questions : [],
      reviewPolicy: settings.reviewPolicy,
      reviewOpensAt: showScore && reviewAllowed && !showReview ? closesAt.toISOString() : null,
      pendingGrading: attempt.answers.filter((a) => a.status === 'awaiting_grading').length,
    };
  }

  // ───────────────────────── grading ─────────────────────────

  /** Answers waiting for a person's mark, or (to re-mark) those already marked. */
  async gradingQueue(
    testId: string,
    user: AuthUser,
    state: 'pending' | 'marked' = 'pending',
  ): Promise<TestGradingItem[]> {
    await this.tests.findForStaff(testId, user, 'tests:grade');
    if (!hasPermission(user, 'tests:grade')) {
      throw new ForbiddenError('You do not have access to this resource');
    }
    // A test shared by several batches is marked batch by batch.
    const batches = await this.scope.visibleBatchIds(user, 'tests:grade');
    const rows = await this.prisma.testAnswer.findMany({
      where: {
        attempt: {
          testId,
          ...(batches === null ? {} : { schedule: { batchId: { in: batches } } }),
        },
        ...(state === 'pending' ? { status: 'awaiting_grading' } : { gradedById: { not: null } }),
      },
      orderBy: { updatedAt: state === 'pending' ? 'asc' : 'desc' },
      take: 200,
      include: {
        attempt: {
          include: {
            student: { include: { user: { select: { name: true } } } },
          },
        },
        testQuestion: { include: { question: { select: { title: true, rubric: true } } } },
      },
    });
    return rows.map((row) => ({
      answerId: row.id,
      attemptId: row.attemptId,
      testQuestionId: row.testQuestionId,
      questionTitle: row.testQuestion.question.title,
      rubric: row.testQuestion.question.rubric,
      maxMarks: row.testQuestion.marks,
      studentName: row.attempt.student.user.name,
      studentCode: row.attempt.student.studentCode,
      answer: row.text || row.code,
      language: row.language,
      submittedAt: row.attempt.submittedAt?.toISOString() ?? null,
      marks: row.gradedById ? Number(row.marks) : null,
      graderComment: row.graderComment,
      gradedAt: row.gradedAt?.toISOString() ?? null,
    }));
  }

  async gradeAnswer(
    attemptId: string,
    answerId: string,
    input: { marks: number; comment: string },
    user: AuthUser,
  ): Promise<{ marks: number; attemptScore: number }> {
    const answer = await this.prisma.testAnswer.findFirst({
      where: { id: answerId, attemptId },
      include: { attempt: { include: { schedule: true, test: true } }, testQuestion: true },
    });
    if (!answer) throw new NotFoundError('Answer');
    await this.tests.findForStaff(answer.attempt.testId, user, 'tests:grade');
    if (!hasPermission(user, 'tests:grade')) {
      throw new ForbiddenError('You do not have access to this resource');
    }
    await this.tests.requireBatchVisible(answer.attempt.schedule.batchId, user, 'tests:grade');
    if (answer.attempt.status === 'in_progress') {
      throw new DomainRuleError(
        'The learner is still sitting this test; mark it once it is submitted',
        'attempt_in_progress',
      );
    }
    if (input.marks > answer.testQuestion.marks) {
      throw new DomainRuleError(
        `This question is worth ${answer.testQuestion.marks} marks`,
        'marks_above_maximum',
      );
    }

    await this.prisma.testAnswer.update({
      where: { id: answerId },
      data: {
        marks: input.marks,
        status:
          input.marks >= answer.testQuestion.marks
            ? 'correct'
            : input.marks > 0
              ? 'partial'
              : 'incorrect',
        graderComment: input.comment,
        gradedById: user.id,
        gradedAt: new Date(),
      },
    });
    const score = await this.recomputeScore(attemptId);
    // The last answer marked completes the attempt, as submission does when nothing waits.
    const waiting = await this.prisma.testAnswer.count({
      where: { attemptId, status: 'awaiting_grading' },
    });
    if (waiting === 0 && answer.attempt.status === 'submitted') {
      await this.prisma.testAttempt.update({
        where: { id: attemptId },
        data: { status: 'graded' },
      });
    }
    // A mark changed after the learner could see it is recorded as such, with what it replaced.
    const remark = answer.status !== 'awaiting_grading';
    const released =
      Boolean(answer.attempt.schedule.releasedAt) ||
      this.tests.settingsOf(answer.attempt.test).resultPolicy === 'immediately';
    await this.audit.record({
      action: remark && released ? 'attempt.answer_remarked' : 'attempt.answer_graded',
      resourceType: 'test_attempt',
      resourceId: attemptId,
      summary: remark
        ? `Re-marked from ${Number(answer.marks)} to ${input.marks} of ${answer.testQuestion.marks}${released ? ' after the results were released' : ''}`
        : `${input.marks} of ${answer.testQuestion.marks} marks`,
      before: remark ? { marks: Number(answer.marks), status: answer.status } : undefined,
      after: { answerId, marks: input.marks, released },
    });
    // A learner who already has their result is told that it changed.
    if (remark && released && Number(answer.marks) !== input.marks) {
      const student = await this.prisma.studentProfile.findUnique({
        where: { id: answer.attempt.studentId },
        select: { userId: true },
      });
      if (student) {
        await this.notifications.notifyUser(student.userId, {
          category: 'assessment',
          type: 'test.remarked',
          title: `Your mark for ${answer.attempt.test.title} changed`,
          body: `One answer was re-marked: ${Number(answer.marks)} → ${input.marks} of ${answer.testQuestion.marks}.`,
          link: `/tests/${answer.attempt.testId}/result?attempt=${attemptId}`,
          channels: ['in_app'],
        });
      }
    }
    return { marks: input.marks, attemptScore: score };
  }

  // ───────────────────────── the deadline ─────────────────────────

  /** Submits every attempt whose time has run out. Runs every minute. */
  async submitExpired(now = new Date()): Promise<number> {
    const expired = await this.prisma.testAttempt.findMany({
      where: { status: 'in_progress', expiresAt: { lte: now } },
      select: { id: true },
      take: 200,
    });
    let submitted = 0;
    for (const attempt of expired) {
      try {
        await this.finish(attempt.id, true);
        submitted += 1;
      } catch (error) {
        this.logger.error({ err: error, attemptId: attempt.id }, 'Could not auto-submit');
      }
    }
    if (submitted > 0) this.logger.log(`Auto-submitted ${submitted} attempt(s) whose time ran out`);
    return submitted;
  }

  // ───────────────────────── internals ─────────────────────────

  /** Marks everything that can be marked without a person, then records the score. */
  private async finish(attemptId: string, auto: boolean): Promise<void> {
    const claimed = await this.prisma.testAttempt.updateMany({
      where: { id: attemptId, status: 'in_progress' },
      data: { status: 'submitted', submittedAt: new Date(), autoSubmitted: auto },
    });
    if (claimed.count === 0) return; // somebody else already finished it

    const answers = await this.prisma.testAnswer.findMany({
      where: { attemptId },
      include: {
        testQuestion: {
          include: { question: { include: { options: true, coding: true } } },
        },
      },
    });

    for (const answer of answers) {
      const placement = answer.testQuestion;
      const type = placement.question.type;

      if (REVIEWED_TYPES.includes(type)) continue; // waits for a person

      if (EXECUTED_TYPES.includes(type)) {
        if (!answer.code) {
          await this.prisma.testAnswer.update({
            where: { id: answer.id },
            data: { status: 'incorrect', marks: 0 },
          });
          continue;
        }
        try {
          const problem = await this.execution.loadProblem(placement.questionId);
          if (!problem) throw new Error('No test cases');
          // Every case, hidden ones included, run in the sandbox and judged here (ADR-0016).
          const evaluation = await this.execution.evaluate(
            problem,
            answer.language as ExecutionLanguage,
            answer.code,
          );
          await this.prisma.testAnswer.update({
            where: { id: answer.id },
            data: {
              marks: Math.round(placement.marks * evaluation.ratio * 100) / 100,
              status:
                evaluation.ratio >= 1 ? 'correct' : evaluation.ratio > 0 ? 'partial' : 'incorrect',
            },
          });
        } catch (error) {
          // No sandbox, or it failed: the answer waits for a person rather than being guessed at.
          this.logger.warn({ err: error, answerId: answer.id }, 'A coding answer went to a person');
          await this.prisma.testAnswer.update({
            where: { id: answer.id },
            data: { status: 'awaiting_grading' },
          });
        }
        continue;
      }

      const correct = new Set(
        placement.question.options.filter((o) => o.isCorrect).map((o) => o.id),
      );
      const chosen = new Set(answer.optionIds);
      const right = [...chosen].filter((id) => correct.has(id)).length;
      const allRight = right === correct.size && chosen.size === right;
      const answered = chosen.size > 0;
      await this.prisma.testAnswer.update({
        where: { id: answer.id },
        data: {
          status: allRight ? 'correct' : 'incorrect',
          // Negative marking applies to a wrong answer, never to one left blank.
          marks: allRight ? placement.marks : answered ? -Number(placement.negativeMarks) : 0,
        },
      });
    }

    const score = await this.recomputeScore(attemptId);
    const pending = await this.prisma.testAnswer.count({
      where: { attemptId, status: 'awaiting_grading' },
    });
    if (pending === 0) {
      await this.prisma.testAttempt.update({
        where: { id: attemptId },
        data: { status: 'graded' },
      });
    }

    const attempt = await this.prisma.testAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { test: { select: { title: true } } },
    });
    await this.audit.record({
      action: 'attempt.submitted',
      resourceType: 'test_attempt',
      resourceId: attemptId,
      summary: `${attempt.test.title}: ${score} of ${attempt.totalMarks}${auto ? ' (time ran out)' : ''}`,
      after: { score, auto, pendingGrading: pending },
      actorId: null,
    });
    this.events.emit('attempt.submitted', { attemptId, testId: attempt.testId, auto });
  }

  private async recomputeScore(attemptId: string): Promise<number> {
    const answers = await this.prisma.testAnswer.findMany({
      where: { attemptId },
      select: { marks: true },
    });
    // A paper never scores below zero, however much negative marking applies.
    const total = Math.max(
      0,
      answers.reduce((n, a) => n + Number(a.marks), 0),
    );
    const rounded = Math.round(total * 100) / 100;
    await this.prisma.testAttempt.update({ where: { id: attemptId }, data: { score: rounded } });
    return rounded;
  }

  private async paperQuestions(testId: string) {
    return this.prisma.testQuestion.findMany({
      where: { section: { testId } },
      orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
      select: { id: true, marks: true },
    });
  }

  private async requireOwnAttempt(attemptId: string, user: AuthUser) {
    const attempt = await this.prisma.testAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundError('Attempt');
    const person = await this.scope.personFor(user.id);
    if (person.studentId !== attempt.studentId) {
      throw new ForbiddenError('That attempt is not yours');
    }
    return attempt;
  }
}

/** Fisher–Yates, so a shuffled paper is genuinely shuffled. */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}
