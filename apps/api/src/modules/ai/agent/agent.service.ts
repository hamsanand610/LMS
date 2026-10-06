import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  AI_ERROR_CODES,
  type AiAgentCitation,
  type AiAgentNotice,
  type AiAgentRun,
  type AiAgentRunRequest,
  type AiAgentRunStatus,
  type AiAnswerEnding,
  aiAgentRunSchema,
  aiAgentStreamEventSchemas,
} from '@lms/shared';
import { AuditService } from '../../../core/audit/audit.service.js';
import { AuthContextService } from '../../../core/auth/auth-context.service.js';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { APP_CONFIG, type AppConfig } from '../../../core/config/env.js';
import { AppError, ForbiddenError, NotFoundError } from '../../../core/http/errors.js';
import { getRequestContext } from '../../../core/http/request-context.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { ScopeService } from '../../../core/scope/scope.service.js';
import { CoursesService, LessonsService } from '../../courses/index.js';
import {
  AiConversationKindError,
  AiDataNotApprovedError,
  AiGenerationBusyError,
  AiRestrictedContentError,
} from '../ai-errors.js';
import {
  AiConversationsService,
  type AiTurn,
  type ConversationRow,
} from '../conversations/conversations.service.js';
import { ANSWER_WORDS } from '../knowledge/answers/answer.service.js';
import { KnowledgeReachService } from '../knowledge/knowledge-reach.service.js';
import { AiPolicyService } from '../policy/ai-policy.service.js';
import { type AiClassification, classifyAiRequest } from '../policy/data-class.js';
import { AiProviderError, AiUnavailableError } from '../providers/ai-provider.js';
import { type AiRouteRequest, ModelRouter } from '../routing/model-router.js';
import { AiSettingsService } from '../settings/ai-settings.service.js';
import { AnswerStream, HEARTBEAT_MS } from '../streaming/answer-stream.js';
import { toMicros } from '../usage/cost.js';
import { AI_AGENT_USAGE_FEATURE, AiUsageService } from '../usage/usage.service.js';
import { AgentBusyError } from './agent-errors.js';
import { AGENT_LIMITS } from './agent-limits.js';
import { AGENT_PROMPT_VERSION, type HistoryTurn } from './agent-prompts.js';
import { AgentRun, type AgentRunOutcome } from './agent-run.js';
import { agentCredentialsIn } from './protected-content.js';
import { AgentLimitError, type AgentLimitReason } from './run-budget.js';
import type { AgentToolContext } from './tools/agent-tool.js';
import { AgentToolRegistry } from './tools/tool-registry.js';

/** What a run that gives no answer says instead: the platform's own words, never a model's. */
export const AGENT_WORDS = {
  insufficient: ANSWER_WORDS.insufficient,
  notGrounded: ANSWER_WORDS.notGrounded,
  unsupported:
    "I can explain the lesson you have open, or help with a doubt about what you're studying, from SI Academy's own material. I can't help with that request.",
  refused: "SI Academy AI can't give an answer to this one. Try asking it another way.",
  limit:
    'This question needs more steps than one answer can take. Try asking about one thing at a time.',
  quotaTokens: 'You have used the SI Academy AI allowance for today. Ask again tomorrow.',
  quotaRequests:
    'You have asked SI Academy AI as many questions as a day allows. Ask again tomorrow.',
  quotaBudget: 'Your institute’s SI Academy AI budget for this month is spent.',
} as const;

type Stream = AnswerStream<typeof aiAgentStreamEventSchemas>;

/** The conversation's subject, pinned for the run: checked for the learner when it began. */
interface PinnedSubject {
  courseId: string;
  lessonId: string | null;
  courseTitle: string | null;
  moduleTitle: string | null;
  lessonTitle: string | null;
  topic: string | null;
}

/** Everything settled before the turn begins. */
interface Prepared {
  conversation: ConversationRow;
  studentId: string;
  classification: AiClassification;
  subject: PinnedSubject | null;
  history: HistoryTurn[];
}

/**
 * The SI Academy learning agent (Roadmap Phase 9B; ADR-0039): one run per learner's message, in one
 * of their own `agent` conversations, as an ordinary turn of it.
 *
 * ENTRY → POLICY GATE → PIN CONTEXT, refused as ordinary problem responses (nothing stored, nothing
 * called): the conversation is the learner's own and the agent's; `ai:agent`, `module.ai` and
 * `ai.agent`, and no timed test (the policy's); a learner's profile; a model service that answers;
 * no credential in the message (never sent or stored); data the provider is approved for; the
 * conversation's course or lesson still open to them, as the lesson player decides; the allowance
 * and the budget; one run at a time each, and eight in this process. Then the TURN begins (the
 * question stored; the database's one answer at a time per person), and the RUN (`AgentRun`) is
 * executed whole — routing, the read-only tools, at most one follow-up, the draft and its
 * verification, the learner's authorization once more — before anything of an answer is given:
 * with `stream`, server-sent events carry `meta` and `step`s while it works, and only then the
 * verified answer's `delta`s and `sources`; else one JSON result. The turn is closed once, its calls
 * in the usage ledger; one audit entry (`ai.agent.run`) and one log line record the run in names,
 * counts and codes — never the question, a prompt, the evidence, a tool's arguments or the answer.
 * The client going away cancels the run, and with it whatever call is in flight.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  /** Learners with a run in this process now: one each, and `concurrentRuns` in all. */
  private readonly running = new Set<string>();

  constructor(
    private readonly policy: AiPolicyService,
    private readonly router: ModelRouter,
    private readonly settings: AiSettingsService,
    private readonly conversations: AiConversationsService,
    private readonly usage: AiUsageService,
    private readonly tools: AgentToolRegistry,
    private readonly lessons: LessonsService,
    private readonly courses: CoursesService,
    private readonly reach: KnowledgeReachService,
    private readonly scope: ScopeService,
    private readonly authContext: AuthContextService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async respond(
    user: AuthUser,
    conversationId: string,
    input: AiAgentRunRequest,
    stream: boolean,
    res: Response,
  ): Promise<void> {
    const started = performance.now();
    // The run's deadline counts from the request.
    const deadline = AbortSignal.timeout(AGENT_LIMITS.runMs);
    const reader = new AbortController();
    const gone = () => {
      if (!res.writableFinished) reader.abort(new Error('The client went away'));
    };
    res.on('close', gone);
    let release: (() => void) | null = null;
    try {
      let prepared: Prepared;
      let turn: AiTurn;
      try {
        prepared = await this.prepare(user, conversationId, input);
        release = this.acquire(user.id);
        turn = await this.conversations.beginTurn(
          user,
          prepared.conversation,
          input.content,
          prepared.classification,
          refsOf(prepared.subject),
          AGENT_PROMPT_VERSION,
        );
      } catch (error) {
        await this.recordRefusal(user, conversationId, error, started);
        throw error;
      }
      // A reader who left while the run was being checked gets no run at all.
      if (res.destroyed || res.socket?.destroyed) gone();
      await this.runTurn(
        user,
        prepared,
        turn,
        input,
        stream,
        res,
        reader.signal,
        deadline,
        started,
      );
    } finally {
      res.off('close', gone);
      release?.();
    }
  }

  /** ENTRY, POLICY GATE, PIN CONTEXT: everything refused before a turn begins. */
  private async prepare(
    user: AuthUser,
    conversationId: string,
    input: AiAgentRunRequest,
  ): Promise<Prepared> {
    const conversation = await this.conversations.owned(user, conversationId);
    if (conversation.purpose !== 'agent') throw new AiConversationKindError(false);
    // `ai:agent`, `module.ai` and `ai.agent`, and no timed test open (ADR-0031).
    await this.policy.assertMayAsk(user, 'agent');
    const studentId = (await this.scope.personFor(user.id)).studentId;
    if (!studentId) throw new ForbiddenError('The learning agent is for learners.');
    // The institute's settings decide the routing and the allowances below.
    await this.settings.current();
    const service = this.router.serviceState();
    if (service === 'off') throw new AiUnavailableError();
    if (service === 'unavailable') throw new AiProviderError('circuit_open');
    const classification = classifyAiRequest({
      purpose: 'agent',
      subject: {
        courseId: conversation.courseId,
        lessonId: conversation.lessonId,
        questionId: null,
      },
      message: input.content,
    });
    // A credential is never sent anywhere, nor stored (ADR-0024): the platform's patterns, the agent's.
    if (classification.dataClass === 'restricted' || agentCredentialsIn(input.content).length > 0) {
      throw new AiRestrictedContentError();
    }
    const refusal = this.router.refusalFor(
      this.routeOf(user, 'classify', classification.dataClass),
    );
    if (refusal === 'data_class_not_approved') {
      throw new AiDataNotApprovedError(classification.dataClass);
    }
    if (refusal) throw new AiUnavailableError();
    const subject = await this.pin(user, conversation);
    await this.usage.assertWithinQuota(user, conversation.id);
    return {
      conversation,
      studentId,
      classification,
      subject,
      history: await this.historyOf(conversation),
    };
  }

  /**
   * The conversation's course or lesson, checked for the learner now as the lesson player and the
   * course page check it — `courses:read`, the Courses module, the institute's published course, an
   * enrolment, the module unlocked — or refused. A lesson brings its course.
   */
  private async pin(user: AuthUser, conversation: ConversationRow): Promise<PinnedSubject | null> {
    if (conversation.lessonId) {
      const lesson = await this.lessons.aiContextFor(conversation.lessonId, user);
      if (conversation.courseId && lesson.courseId !== conversation.courseId) {
        throw new NotFoundError('Lesson');
      }
      return titled({
        courseId: lesson.courseId,
        lessonId: lesson.lessonId,
        courseTitle: lesson.courseTitle,
        moduleTitle: lesson.moduleTitle,
        lessonTitle: lesson.title,
        topic: lesson.topic || null,
      });
    }
    if (conversation.courseId) {
      const course = await this.courses.aiContextFor(conversation.courseId, user);
      return titled({
        courseId: course.courseId,
        lessonId: null,
        courseTitle: course.title,
        moduleTitle: null,
        lessonTitle: null,
        topic: null,
      });
    }
    return null;
  }

  /** The conversation's own completed messages, most recent first within the run's bounds. */
  private async historyOf(conversation: ConversationRow): Promise<HistoryTurn[]> {
    const { history } = await this.conversations.memoryOf(conversation);
    const kept: HistoryTurn[] = [];
    let characters = 0;
    for (const turn of history.slice(-AGENT_LIMITS.historyMessages).reverse()) {
      if (characters + turn.content.length > AGENT_LIMITS.historyCharacters) break;
      characters += turn.content.length;
      kept.push({ role: turn.role === 'user' ? 'user' : 'assistant', content: turn.content });
    }
    return kept.reverse();
  }

  /** One run at a time for each learner, and a bound on this process's runs at once. */
  private acquire(userId: string): () => void {
    if (this.running.has(userId)) throw new AiGenerationBusyError();
    if (this.running.size >= AGENT_LIMITS.concurrentRuns) throw new AgentBusyError();
    this.running.add(userId);
    return () => {
      this.running.delete(userId);
    };
  }

  /** The run, the turn closed once, then what the learner is given — verified, or the platform's words. */
  private async runTurn(
    user: AuthUser,
    prepared: Prepared,
    turn: AiTurn,
    input: AiAgentRunRequest,
    stream: boolean,
    res: Response,
    signal: AbortSignal,
    deadline: AbortSignal,
    started: number,
  ): Promise<void> {
    const { conversation, subject } = prepared;
    let sse: Stream | null = null;
    if (stream) {
      sse = new AnswerStream(res, HEARTBEAT_MS, aiAgentStreamEventSchemas);
      sse.open();
      sse.send('meta', {
        conversationId: conversation.id,
        userMessageId: turn.questionId,
        assistantMessageId: turn.answerId,
      });
    }
    const context: AgentToolContext = Object.freeze({
      user,
      studentId: prepared.studentId,
      conversationId: conversation.id,
      courseId: subject?.courseId ?? null,
      lessonId: subject?.lessonId ?? null,
    });
    const run = new AgentRun(
      {
        model: this.router,
        tools: this.tools,
        quota: {
          check: async (spent) => {
            const blocked = await this.usage.runBlockedBy(user, spent);
            if (blocked) throw new AgentLimitError(`quota_${blocked}`);
          },
        },
        delivery: {
          mayDeliver: (pinned, citations, aborted) => this.mayDeliver(pinned, citations, aborted),
        },
        limits: AGENT_LIMITS,
        route: (task, dataClass) => this.routeOf(user, task, dataClass),
        maxOutputTokens: this.config.AI_MAX_OUTPUT_TOKENS,
        onStep: (step) => sse?.send('step', { step }),
      },
      {
        context,
        subject: subject
          ? {
              courseTitle: subject.courseTitle,
              moduleTitle: subject.moduleTitle,
              lessonTitle: subject.lessonTitle,
              topic: subject.topic,
            }
          : null,
        question: input.content,
        history: prepared.history,
        identifiers: [
          user.id,
          user.organizationId,
          user.email,
          prepared.studentId,
          conversation.id,
          turn.questionId,
          turn.answerId,
          ...(subject ? [subject.courseId] : []),
          ...(subject?.lessonId ? [subject.lessonId] : []),
        ],
        signal,
      },
      deadline,
    );
    let outcome: AgentRunOutcome;
    try {
      outcome = await run.execute();
    } catch (error) {
      // `execute` ends every run with an outcome; anything else is a fault of ours.
      outcome = { status: 'failed', reason: 'internal', error };
    }
    if (outcome.status === 'failed' && !(outcome.error instanceof AppError)) {
      this.logger.error(
        { ai: { agent: { messageId: turn.answerId } }, err: outcome.error },
        'A learning agent run failed unexpectedly',
      );
    }

    const result = resultOf(outcome);
    const calls = run.attempts.map(({ task, attempt }) => ({
      task,
      provider: attempt.provider,
      model: attempt.model,
      fallback: attempt.fallback,
      outcome: attempt.outcome,
      latencyMs: attempt.latencyMs,
      inputTokens: attempt.usage?.inputTokens ?? 0,
      outputTokens: attempt.usage?.outputTokens ?? 0,
      estimated: attempt.usage?.estimated === true,
      costMicros: toMicros(attempt.estimatedCostUsd),
    }));
    const inputTokens = calls.reduce((sum, call) => sum + call.inputTokens, 0);
    const outputTokens = calls.reduce((sum, call) => sum + call.outputTokens, 0);
    const ending: AiAnswerEnding =
      outcome.status === 'failed'
        ? 'failed'
        : outcome.status === 'cancelled'
          ? 'cancelled'
          : 'complete';
    let closed = false;
    try {
      closed = await this.conversations.finishTurn({
        answerId: turn.answerId,
        conversationId: conversation.id,
        ending,
        content: result.answer,
        provider: run.trace.provider,
        model: run.trace.model,
        inputTokens,
        outputTokens,
        tokensEstimated: calls.some((call) => call.estimated),
        latencyMs: Math.round(performance.now() - started),
        finishReason: outcome.status === 'answered' ? 'stop' : null,
        errorCode: result.code,
        ledger: {
          organizationId: user.organizationId,
          userId: user.id,
          conversationId: conversation.id,
          messageId: turn.answerId,
          feature: AI_AGENT_USAGE_FEATURE,
          task: 'chat',
          dataClass: run.trace.dataClass ?? prepared.classification.dataClass,
          requestId: getRequestContext()?.requestId ?? null,
          question: true,
          calls,
        },
      });
    } catch (error) {
      this.logger.error(
        { ai: { agent: { messageId: turn.answerId } }, err: error },
        'A learning agent run could not be closed',
      );
    }
    const status: AiAgentRunStatus = closed ? outcome.status : 'failed';
    const usage =
      calls.length > 0
        ? await this.usage.allowance(user.id).then(
            (left) => ({
              inputTokens,
              outputTokens,
              estimated: calls.some((call) => call.estimated),
              requestsLeftToday: left.requestsLeft,
              tokensLeftToday: left.tokensLeft,
            }),
            () => null,
          )
        : null;
    const given: AiAgentRun = aiAgentRunSchema.parse({
      conversationId: conversation.id,
      userMessageId: turn.questionId,
      assistantMessageId: turn.answerId,
      status,
      capability: run.trace.capability,
      answer: closed ? result.answer : '',
      citations: closed ? result.citations : [],
      notice: closed ? result.notice : null,
      error: closed
        ? result.error
        : {
            code: AI_ERROR_CODES.UNAVAILABLE,
            message: 'SI Academy AI could not finish this answer. Try again.',
          },
      usage,
    });

    // Recorded before it is given, as Phase 8E's answers are: whoever reads the result can find it.
    const durationMs = Math.round(performance.now() - started);
    await this.recordRun(
      user,
      conversation.id,
      turn.answerId,
      run,
      given,
      result.reason,
      durationMs,
      {
        inputTokens,
        outputTokens,
      },
    );
    this.logger.log(
      {
        ai: {
          agent: {
            status: given.status,
            capability: given.capability,
            steps: run.budget.steps,
            modelCalls: run.budget.modelCalls,
            toolCalls: run.budget.toolCalls,
            searches: run.budget.searches,
            passages: run.trace.passages,
            citations: given.citations.length,
            tokens: inputTokens + outputTokens,
            ms: durationMs,
          },
        },
      },
      'Learning agent run',
    );

    if (sse) {
      write(sse, given, turn.answerId);
    } else if (!res.destroyed && outcome.status !== 'cancelled') {
      res.status(200).json(given);
    }
  }

  /**
   * The learner's authorization, once more, before an answer is given (the run's last step): their
   * permissions read afresh, the policy (`ai:agent`, the flags, no timed test), still the learner
   * the run was pinned for, every lesson the answer cites still open to them, every knowledge
   * passage it cites still within their reach — a published source open to them, an active
   * document, the current version — now.
   */
  private async mayDeliver(
    context: AgentToolContext,
    citations: readonly AiAgentCitation[],
    signal: AbortSignal,
  ): Promise<boolean> {
    const loaded = await this.authContext.load(context.user.id);
    if (!loaded || loaded.status !== 'active') return false;
    const user: AuthUser = { ...loaded, sessionId: context.user.sessionId };
    try {
      await this.policy.assertMayAsk(user, 'agent');
    } catch {
      return false;
    }
    if ((await this.scope.personFor(user.id)).studentId !== context.studentId) return false;
    const lessonIds = new Set(
      citations.flatMap((citation) => (citation.kind === 'lesson' ? [citation.lessonId] : [])),
    );
    for (const lessonId of lessonIds) {
      try {
        await this.lessons.aiContextFor(lessonId, user);
      } catch {
        return false;
      }
    }
    const knowledge = citations.flatMap((citation) =>
      citation.kind === 'knowledge' ? [citation] : [],
    );
    if (knowledge.length > 0) {
      const reach = await this.reach.reachOf(user);
      const sources = new Set(reach.sourceIds);
      const closed = new Set(reach.closedDocumentIds);
      if (knowledge.some((c) => !sources.has(c.sourceId) || closed.has(c.documentId))) return false;
      const chunkIds = [...new Set(knowledge.map((citation) => citation.chunkId))];
      const current = await this.prisma.knowledgeChunk.count({
        where: {
          id: { in: chunkIds },
          organizationId: user.organizationId,
          version: { isCurrent: true, document: { status: 'active' } },
        },
      });
      if (current !== chunkIds.length) return false;
    }
    return !signal.aborted;
  }

  private routeOf(
    user: AuthUser,
    task: 'classify' | 'chat',
    dataClass: AiRouteRequest['dataClass'],
  ): AiRouteRequest {
    return {
      task,
      feature: 'agent',
      dataClass,
      userId: user.id,
      organizationId: user.organizationId,
    };
  }

  /**
   * The run's audit entry (ADR-0028's metadata only, as ADR-0036 and ADR-0037 kept it): how it ended
   * and why, the capability, the tools by name with how each call ended, the counts, the provider
   * and model, the stand-in, the tokens and the time — never the question, a prompt, the evidence,
   * a tool's arguments or output, or the answer.
   */
  private async recordRun(
    user: AuthUser,
    conversationId: string,
    messageId: string,
    run: AgentRun,
    given: AiAgentRun,
    reason: string | null,
    durationMs: number,
    tokens: { inputTokens: number; outputTokens: number },
  ): Promise<void> {
    try {
      await this.audit.record({
        action: 'ai.agent.run',
        resourceType: 'ai_conversation',
        resourceId: conversationId,
        summary: `A learning agent run: ${given.status}${reason ? ` (${reason})` : ''}`,
        after: {
          status: given.status,
          reason,
          messageId,
          route: run.trace.route,
          capability: run.trace.capability,
          tools: [...new Set(run.trace.tools.map((call) => call.tool))],
          toolCalls: run.trace.tools,
          toolCallCount: run.budget.toolCalls,
          modelCalls: run.budget.modelCalls,
          steps: run.budget.steps,
          searches: run.budget.searches,
          followUps: run.budget.followUps,
          faults: run.trace.faults,
          provider: run.trace.provider,
          model: run.trace.model,
          fallback: run.trace.fallback,
          dataClass: run.trace.dataClass,
          passages: run.trace.passages,
          evidenceCharacters: run.trace.evidenceCharacters,
          citations: given.citations.length,
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          promptVersion: AGENT_PROMPT_VERSION,
          durationMs,
        },
        actorId: user.id,
      });
    } catch (error) {
      this.logger.error({ err: error }, 'A learning agent run could not be audited');
    }
  }

  /** A run refused before its turn began: audited by its code (a conversation not found is not). */
  private async recordRefusal(
    user: AuthUser,
    conversationId: string,
    error: unknown,
    started: number,
  ): Promise<void> {
    if (error instanceof NotFoundError) return;
    const reason = error instanceof AppError ? error.code : 'internal';
    try {
      await this.audit.record({
        action: 'ai.agent.run',
        resourceType: 'ai_conversation',
        resourceId: conversationId,
        summary: `A learning agent run was refused (${reason})`,
        after: {
          status: 'refused',
          reason,
          promptVersion: AGENT_PROMPT_VERSION,
          durationMs: Math.round(performance.now() - started),
        },
        actorId: user.id,
      });
    } catch (recordError) {
      this.logger.error({ err: recordError }, 'A learning agent refusal could not be audited');
    }
  }
}

/** A subject's titles, unless one holds a credential: then no title of it goes to a model. */
function titled(subject: PinnedSubject): PinnedSubject {
  const titles = [subject.courseTitle, subject.moduleTitle, subject.lessonTitle, subject.topic];
  if (agentCredentialsIn(titles.filter(Boolean).join('\n')).length === 0) return subject;
  return { ...subject, courseTitle: null, moduleTitle: null, lessonTitle: null, topic: null };
}

/** What a turn is answered from, as its answer records it: the course and the lesson. */
function refsOf(subject: PinnedSubject | null): string[] {
  if (!subject) return [];
  return [
    `course:${subject.courseId}`,
    ...(subject.lessonId ? [`lesson:${subject.lessonId}`] : []),
  ];
}

/** What a run's outcome gives the learner: the verified answer, or the platform's own words. */
function resultOf(outcome: AgentRunOutcome): {
  answer: string;
  citations: AiAgentCitation[];
  notice: AiAgentNotice | null;
  error: { code: string; message: string } | null;
  code: string | null;
  reason: string | null;
} {
  switch (outcome.status) {
    case 'answered': {
      const conflict = outcome.kind === 'conflict';
      return {
        answer: conflict
          ? `${ANSWER_WORDS.conflictBefore} ${outcome.text} ${ANSWER_WORDS.conflictAfter}`
          : outcome.text,
        citations: outcome.citations,
        notice: conflict
          ? { code: 'conflicting_evidence', message: ANSWER_WORDS.conflictAfter }
          : null,
        error: null,
        code: null,
        reason: null,
      };
    }
    case 'insufficient_evidence':
      return declined('insufficient_evidence', AGENT_WORDS.insufficient, outcome.reason);
    case 'not_grounded':
      return declined('not_grounded', AGENT_WORDS.notGrounded, outcome.reason);
    case 'refused':
      return outcome.notice === 'unsupported'
        ? declined('unsupported', AGENT_WORDS.unsupported, outcome.reason)
        : declined('refused', AGENT_WORDS.refused, outcome.reason);
    case 'limit_reached':
      return declined('limit_reached', limitWords(outcome.reason), outcome.reason);
    case 'failed': {
      const failure = publicFailure(outcome.error);
      return {
        answer: '',
        citations: [],
        notice: null,
        error: failure,
        code: outcome.reason.slice(0, 40),
        reason: outcome.reason,
      };
    }
    case 'cancelled':
      return {
        answer: '',
        citations: [],
        notice: null,
        error: null,
        code: 'cancelled',
        reason: 'cancelled',
      };
  }
}

function declined(
  code: AiAgentNotice['code'],
  words: string,
  reason: string,
): ReturnType<typeof resultOf> {
  return {
    answer: words,
    citations: [],
    notice: { code, message: words },
    error: null,
    code: `${code === 'unsupported' || code === 'refused' ? 'refused' : code}:${reason}`.slice(
      0,
      40,
    ),
    reason,
  };
}

function limitWords(reason: AgentLimitReason): string {
  if (reason === 'quota_tokens') return AGENT_WORDS.quotaTokens;
  if (reason === 'quota_requests') return AGENT_WORDS.quotaRequests;
  if (reason === 'quota_budget') return AGENT_WORDS.quotaBudget;
  return AGENT_WORDS.limit;
}

/** What the learner is told of a failure: the platform's code and words only. */
function publicFailure(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) return { code: error.code, message: error.detail ?? error.title };
  return {
    code: AI_ERROR_CODES.UNAVAILABLE,
    message: 'SI Academy AI could not answer just now. Try again later.',
  };
}

/**
 * The run as events, once it is complete: the verified answer in pieces and its sources, or what
 * to say instead; the usage; `done`. Nothing here was written before the run ended.
 */
function write(stream: Stream, given: AiAgentRun, messageId: string): void {
  if (given.status === 'answered') {
    for (const piece of given.answer.match(/(?:\S+\s*){1,12}/g) ?? []) {
      stream.send('delta', { text: piece });
    }
    stream.send('sources', { citations: given.citations });
  }
  if (given.notice) stream.send('notice', given.notice);
  if (given.error) stream.send('error', given.error);
  if (given.usage) stream.send('usage', given.usage);
  stream.send('done', { messageId, status: given.status });
  stream.end();
}
