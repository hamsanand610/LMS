import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type AttemptAnswersInput,
  type AttemptQuestionView,
  type AttemptResult,
  type AttemptResultQuestion,
  type AttemptState,
  type AttemptStatus,
  type QuestionType,
  type SubmissionStatus,
  type TestCard,
  type TestGradingItem,
  type TestKind,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission } from '../../core/auth/auth-user.js';
import {
  ConflictError,
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../core/http/errors.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { ExecutionService } from '../execution/index.js';
import { NotificationsService } from '../notifications/index.js';
import { TestsService } from './tests.service.js';

export const ATTEMPT_AUTOSUBMIT_JOB = 'tests.autosubmit';

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
    private readonly notifications: NotificationsService,
    private readonly jobs: JobsService,
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

  async mine(user: AuthUser): Promise<TestCard[]> {
    const person = await this.scope.personFor(user.id);
    if (!person.studentId || person.batchIds.length === 0) return [];
    const schedules = await this.prisma.testSchedule.findMany({
      where: { batchId: { in: person.batchIds }, test: { deletedAt: null, status: 'published' } },
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
      where: { testId, batchId: { in: person.batchIds } },
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
      questions: view,
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
      await this.prisma.testAnswer.update({
        where: { id },
        data: {
          optionIds: answer.optionIds,
          text: answer.text,
          code: answer.code,
          language: answer.language,
          flagged: answer.flagged,
          timeSpentSeconds: answer.timeSpentSeconds,
        },
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

  /** Records a tab switch or a full-screen exit. Counted and shown; never used to block. */
  async recordIntegrityEvent(
    attemptId: string,
    event: { type: string; occurredAt: string },
    user: AuthUser,
  ): Promise<{ tabSwitches: number }> {
    const attempt = await this.requireOwnAttempt(attemptId, user);
    if (attempt.status !== 'in_progress') return { tabSwitches: attempt.tabSwitches };
    const log = [...(attempt.integrityLog as unknown[]), event].slice(-200);
    const updated = await this.prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        integrityLog: asJson({ events: log } as Record<string, unknown>),
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
    const isStaff = hasPermission(user, 'tests:read') && !isOwner;
    if (!isOwner && !isStaff) throw new ForbiddenError('That attempt is not yours');
    if (isStaff) await this.tests.findForStaff(attempt.testId, user);

    const settings = this.tests.settingsOf(attempt.test);
    const released =
      Boolean(attempt.schedule.releasedAt) || settings.resultPolicy === 'immediately';
    // Staff see the marks as soon as they exist; a learner waits for the release (AC-07.3).
    const showScore = isStaff || released;
    const showReview = showScore && (isStaff || settings.reviewPolicy === 'full');

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
      sections: [...sections.values()],
      questions: showScore ? questions : [],
      reviewPolicy: settings.reviewPolicy,
      pendingGrading: attempt.answers.filter((a) => a.status === 'awaiting_grading').length,
    };
  }

  // ───────────────────────── grading ─────────────────────────

  async gradingQueue(testId: string, user: AuthUser): Promise<TestGradingItem[]> {
    await this.tests.findForStaff(testId, user);
    if (!hasPermission(user, 'tests:grade')) {
      throw new ForbiddenError('You do not have access to this resource');
    }
    const rows = await this.prisma.testAnswer.findMany({
      where: { attempt: { testId }, status: 'awaiting_grading' },
      orderBy: { updatedAt: 'asc' },
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
      include: { attempt: true, testQuestion: true },
    });
    if (!answer) throw new NotFoundError('Answer');
    await this.tests.findForStaff(answer.attempt.testId, user);
    if (!hasPermission(user, 'tests:grade')) {
      throw new ForbiddenError('You do not have access to this resource');
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
    await this.audit.record({
      action: 'attempt.answer_graded',
      resourceType: 'test_attempt',
      resourceId: attemptId,
      summary: `${input.marks} of ${answer.testQuestion.marks} marks`,
      after: { answerId, marks: input.marks },
    });
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

      if (type === 'descriptive') continue; // waits for a person

      if (type === 'coding') {
        if (!answer.code) {
          await this.prisma.testAnswer.update({
            where: { id: answer.id },
            data: { status: 'incorrect', marks: 0 },
          });
          continue;
        }
        try {
          const grade = await this.execution.gradeSubmission(
            placement.questionId,
            answer.language as never,
            answer.code,
            null,
          );
          await this.prisma.testAnswer.update({
            where: { id: answer.id },
            data: {
              marks: Math.round(placement.marks * grade.ratio * 100) / 100,
              status: grade.ratio >= 1 ? 'correct' : grade.ratio > 0 ? 'partial' : 'incorrect',
            },
          });
        } catch {
          // The browser driver cannot run here, so the answer waits for a person instead.
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
