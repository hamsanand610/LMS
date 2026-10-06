import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  AI_ERROR_CODES,
  AI_PURPOSE_FEATURE,
  type AiAdminStatus,
  type AiAnswerEnding,
  type AiConversationCreate,
  type AiConversationDetail,
  type AiConversationSummary,
  type AiMessageSend,
  type AiPurpose,
  type Paginated,
  aiAdminStatusSchema,
} from '@lms/shared';
import { AuditService } from '../../../core/audit/audit.service.js';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { APP_CONFIG, type AppConfig } from '../../../core/config/env.js';
import { AppError } from '../../../core/http/errors.js';
import { getRequestContext } from '../../../core/http/request-context.js';
import {
  AiConversationKindError,
  AiDataNotApprovedError,
  AiGenerationBusyError,
  AiRestrictedContentError,
} from '../ai-errors.js';
import {
  type AiCacheCandidate,
  type AiCacheEntryRow,
  AiCacheService,
} from '../cache/cache.service.js';
import { type AssembledContext, assembleContext } from '../context/context-assembler.js';
import { AiSubjectsService } from '../context/subjects.service.js';
import {
  AiConversationsService,
  type AiTurn,
  type ConversationRow,
} from '../conversations/conversations.service.js';
import { AiSummariesService } from '../jobs/summaries.service.js';
import { AiTitlesService } from '../jobs/titles.service.js';
import { type AiClassification, classifyAiRequest } from '../policy/data-class.js';
import { AiPolicyService } from '../policy/ai-policy.service.js';
import { AiProviderError, AiUnavailableError, errorNameOf } from '../providers/ai-provider.js';
import {
  type AiAttempt,
  type AiRouteRequest,
  type AiRoutedResult,
  ModelRouter,
} from '../routing/model-router.js';
import { AiSettingsService } from '../settings/ai-settings.service.js';
import { AnswerStream } from '../streaming/answer-stream.js';
import { estimateCostUsd, estimateTokens, toMicros } from '../usage/cost.js';
import { type AiLedgerCall, AiUsageService } from '../usage/usage.service.js';

/**
 * The only way into SI Academy AI (AI architecture §2; Phases 7C–7E). A question goes through, in
 * order:
 *
 * 1. the platform's guards (rate limit, authentication, CSRF and origin, `module.ai`, permission);
 * 2. ownership of the conversation (anybody else's is not found);
 * 3. the policy: the surface's flag and permission, and no help during a timed test (ADR-0031);
 * 4. the institute's AI settings (Phase 7D), and a configured, answering model service;
 * 5. the data class (ADR-0024): a message holding a credential is refused and not stored; a class
 *    the institute has not approved for its provider is refused before anything is written;
 * 6. the conversation's subject, checked again for this person now (Phase 7E): a course or lesson
 *    they still reach, a lab they may still work on and have tried — and the material it brings,
 *    built on the server by the module that owns it, never sent by the browser;
 * 7. the quotas and the budget, before any call (ADR-0029);
 * 8. the context: the subject's material, the conversation's notes on its older turns, and its
 *    recent messages (7D–7E);
 * 9. the answer cache (Phase 7D; ADR-0032): a question asked on its own may be answered with a
 *    kept answer, checked again for this person — after every rule above, never instead of one;
 * 10. the generation gate, with the question and the answer's placeholder written together;
 * 11. the model router, the only path to a provider, streamed back as SI Academy's own events;
 * 12. closing the answer once, with its usage — however it ended — which opens the gate again;
 * 13. after the stream has ended, the background work it leads to: a title, the notes, keeping
 *     the answer. None of it is waited for, and none of it can fail the answer.
 *
 * Refusals before step 10 are ordinary problem responses. From step 11 the response is an event
 * stream, and anything that goes wrong is said in an `error` event, followed by `done`.
 */
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly policy: AiPolicyService,
    private readonly router: ModelRouter,
    private readonly settings: AiSettingsService,
    private readonly conversations: AiConversationsService,
    private readonly subjects: AiSubjectsService,
    private readonly usage: AiUsageService,
    private readonly cache: AiCacheService,
    private readonly titles: AiTitlesService,
    private readonly summaries: AiSummariesService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async createConversation(
    user: AuthUser,
    input: AiConversationCreate,
  ): Promise<AiConversationSummary> {
    await this.checkPolicy(user, input.purpose, null);
    return this.conversations.create(user, input);
  }

  async listConversations(
    user: AuthUser,
    query: { page: number; pageSize: number },
  ): Promise<Paginated<AiConversationSummary>> {
    await this.policy.assertNotInTimedTest(user);
    return this.conversations.list(user, query);
  }

  async conversation(user: AuthUser, id: string): Promise<AiConversationDetail> {
    await this.policy.assertNotInTimedTest(user);
    return this.conversations.detail(user, id);
  }

  async removeConversation(user: AuthUser, id: string): Promise<void> {
    await this.conversations.remove(user, id);
  }

  /** A question in the person's own conversation; the answer streams back on `res`. */
  async ask(
    user: AuthUser,
    conversationId: string,
    input: AiMessageSend,
    res: Response,
  ): Promise<void> {
    const conversation = await this.conversations.owned(user, conversationId);
    // The learning agent's conversations are answered by its runs alone (Phase 9B; ADR-0039): never
    // here, where an answer would stream unverified, outside the agent's limits and tools.
    if (conversation.purpose === 'agent') throw new AiConversationKindError(true);
    await this.checkPolicy(user, conversation.purpose, conversation.id);
    // The institute's settings decide the routing and the allowances below.
    await this.settings.current();

    const service = this.router.serviceState();
    if (service === 'off') throw new AiUnavailableError();
    if (service === 'unavailable') {
      await this.recordFailure(conversation.id, null, 'circuit_open');
      throw new AiProviderError('circuit_open');
    }

    const classification = classifyAiRequest({
      purpose: conversation.purpose,
      subject: {
        courseId: conversation.courseId,
        lessonId: conversation.lessonId,
        questionId: conversation.questionId,
      },
      message: input.content,
    });
    const route: AiRouteRequest = {
      task: conversation.purpose === 'lab_hint' ? 'hint' : 'chat',
      feature: AI_PURPOSE_FEATURE[conversation.purpose],
      dataClass: classification.dataClass,
      userId: user.id,
      organizationId: user.organizationId,
    };
    if (classification.dataClass === 'restricted') {
      await this.recordRefusal(conversation, 'restricted_content', classification);
      throw new AiRestrictedContentError();
    }
    const refusal = this.router.refusalFor(route, true);
    if (refusal === 'data_class_not_approved') {
      await this.recordRefusal(conversation, 'data_not_approved', classification);
      throw new AiDataNotApprovedError(classification.dataClass);
    }
    if (refusal) throw new AiUnavailableError();

    // Reach is checked again at every question: a course, lesson or lab lost since is not used.
    const material = await this.subjects.material(user, conversation);
    await this.usage.assertWithinQuota(user, conversation.id);

    const memory = await this.conversations.memoryOf(conversation);
    const context = assembleContext(
      conversation.purpose,
      memory.history,
      input.content,
      memory.summary,
      material,
    );
    const cacheable = await this.cache.candidate({
      cacheOn: (await this.policy.features(user)).semantic_cache,
      conversation,
      dataClass: classification.dataClass,
      refs: context.refs,
      question: input.content,
    });
    const kept = cacheable ? await this.cache.lookup(user, cacheable) : null;

    let turn: AiTurn;
    try {
      turn = await this.conversations.beginTurn(
        user,
        conversation,
        input.content,
        classification,
        context.refs,
      );
    } catch (error) {
      if (error instanceof AiGenerationBusyError) {
        await this.audit.record({
          action: 'ai.generation.busy',
          resourceType: 'ai_conversation',
          resourceId: conversation.id,
          summary: 'An SI Academy AI question was refused: another answer was being written',
        });
      }
      throw error;
    }
    const ending = kept
      ? await this.answerFromCache(user, conversation, turn, route, kept, res)
      : await this.answer(user, conversation, turn, route, context, res);
    await this.afterAnswer(conversation, turn, ending, kept ? null : cacheable);
  }

  /** Configured or not, answering or not, and how the service is doing; never which provider, model or key. */
  async status(): Promise<AiAdminStatus> {
    await this.settings.current();
    return aiAdminStatusSchema.parse({
      configured: this.router.configured,
      gatewayReady: this.policy.gatewayReady(),
      service: this.router.serviceState(),
    });
  }

  /**
   * Streams the answer, then closes the turn once, however it ended. Returns how it ended and the
   * model's finish reason, for what follows the answer.
   */
  private async answer(
    user: AuthUser,
    conversation: ConversationRow,
    turn: AiTurn,
    route: AiRouteRequest,
    context: AssembledContext,
    res: Response,
  ): Promise<Ended> {
    const reader = new AbortController();
    const readerLeft = () => reader.abort(new Error('The reader closed the stream'));
    res.on('close', readerLeft);
    // A reader who left while the question was being checked is not answered at all.
    if (res.destroyed || res.socket?.destroyed) readerLeft();
    const stream = new AnswerStream(res);
    stream.open();
    stream.send('meta', {
      conversationId: conversation.id,
      userMessageId: turn.questionId,
      assistantMessageId: turn.answerId,
    });

    const calls: AiAttempt[] = [];
    const started = performance.now();
    let written = '';
    let result: AiRoutedResult | null = null;
    let failure: unknown = null;
    try {
      for await (const delta of this.router.stream(
        {
          ...route,
          messages: context.messages,
          maxOutputTokens: this.config.AI_MAX_OUTPUT_TOKENS,
          onAttempt: (attempt) => calls.push(attempt),
        },
        reader.signal,
      )) {
        if (delta.type === 'text') {
          written += delta.text;
          stream.send('delta', { text: delta.text });
        } else {
          result = delta.result;
        }
      }
    } catch (error) {
      failure = error;
      if (!(error instanceof AppError)) {
        // Not a provider's failure, which is already normalised and logged: a fault of ours.
        this.logger.error(
          { ai: { messageId: turn.answerId }, err: error },
          'An SI Academy AI answer failed unexpectedly',
        );
      }
    } finally {
      res.off('close', readerLeft);
    }

    const ending = endingOf(result, failure);
    const ledger = this.ledgerOf(calls, ending, written, context);
    const last = calls.at(-1);
    const closed = await this.close(stream, {
      answerId: turn.answerId,
      conversationId: conversation.id,
      ending,
      content: result?.text ?? '',
      provider: result?.provider ?? last?.provider ?? null,
      model: result?.model ?? last?.model ?? null,
      inputTokens: ledger.reduce((sum, call) => sum + call.inputTokens, 0),
      outputTokens: ledger.reduce((sum, call) => sum + call.outputTokens, 0),
      tokensEstimated: ledger.some((call) => call.estimated),
      latencyMs: Math.round(performance.now() - started),
      finishReason: result?.finishReason ?? null,
      errorCode: errorCodeOf(ending, failure),
      ledger: {
        organizationId: user.organizationId,
        userId: user.id,
        conversationId: conversation.id,
        messageId: turn.answerId,
        feature: route.feature,
        task: route.task,
        dataClass: route.dataClass,
        requestId: getRequestContext()?.requestId ?? null,
        question: true,
        calls: ledger,
      },
    });
    if (!closed) return { ending: 'failed', finishReason: null };
    if (ending === 'complete' && result?.finishReason === 'length') {
      stream.send('notice', {
        code: 'answer_cut_short',
        message: 'The answer reached its length limit and stops there.',
      });
    }
    if (ending === 'blocked') {
      stream.send('error', {
        code: AI_ERROR_CODES.ANSWER_WITHHELD,
        message: 'SI Academy AI could not answer this question. Try asking it another way.',
      });
    }
    if (ending === 'failed') {
      const { code, message } = publicFailure(failure);
      stream.send('error', { code, message });
      if (!(failure instanceof AiProviderError) || failure.kind !== 'cancelled') {
        await this.recordFailure(conversation.id, turn.answerId, kindOf(failure));
      }
    }
    if (calls.length > 0) {
      const left = await this.usage.allowance(user.id);
      stream.send('usage', {
        inputTokens: ledger.reduce((sum, call) => sum + call.inputTokens, 0),
        outputTokens: ledger.reduce((sum, call) => sum + call.outputTokens, 0),
        estimated: ledger.some((call) => call.estimated),
        requestsLeftToday: left.requestsLeft,
        tokensLeftToday: left.tokensLeft,
      });
    }
    stream.send('done', { messageId: turn.answerId, status: ending });
    stream.end();
    return { ending, finishReason: result?.finishReason ?? null };
  }

  /**
   * An answer kept in the cache, given as an answer is (Phase 7D): the same events, the turn
   * closed the same way, with the entry it came from. No provider is called, so nothing is counted
   * against the person's allowance.
   */
  private async answerFromCache(
    user: AuthUser,
    conversation: ConversationRow,
    turn: AiTurn,
    route: AiRouteRequest,
    entry: AiCacheEntryRow,
    res: Response,
  ): Promise<Ended> {
    const started = performance.now();
    const stream = new AnswerStream(res);
    stream.open();
    stream.send('meta', {
      conversationId: conversation.id,
      userMessageId: turn.questionId,
      assistantMessageId: turn.answerId,
    });
    stream.send('delta', { text: entry.answer });
    const closed = await this.close(stream, {
      answerId: turn.answerId,
      conversationId: conversation.id,
      ending: 'complete',
      content: entry.answer,
      provider: entry.provider,
      model: entry.model,
      inputTokens: 0,
      outputTokens: 0,
      tokensEstimated: false,
      latencyMs: Math.round(performance.now() - started),
      finishReason: 'stop',
      errorCode: null,
      cacheEntryId: entry.id,
      ledger: {
        organizationId: user.organizationId,
        userId: user.id,
        conversationId: conversation.id,
        messageId: turn.answerId,
        feature: route.feature,
        task: route.task,
        dataClass: route.dataClass,
        requestId: getRequestContext()?.requestId ?? null,
        question: true,
        calls: [],
      },
    });
    if (!closed) return { ending: 'failed', finishReason: null };
    await this.cache.recordHit(entry.id);
    stream.send('done', { messageId: turn.answerId, status: 'complete' });
    stream.end();
    return { ending: 'complete', finishReason: 'stop' };
  }

  /**
   * Closes the turn, once. If it cannot be closed, the reader is told, and the answer stays
   * `streaming` until it counts as abandoned, then is closed as failed.
   */
  private async close(
    stream: AnswerStream,
    closing: Parameters<AiConversationsService['finishTurn']>[0],
  ): Promise<boolean> {
    let closed = false;
    try {
      closed = await this.conversations.finishTurn(closing);
    } catch (error) {
      this.logger.error(
        { ai: { messageId: closing.answerId }, err: errorNameOf(error) },
        'An SI Academy AI answer could not be closed',
      );
    }
    if (!closed) {
      stream.send('error', {
        code: AI_ERROR_CODES.UNAVAILABLE,
        message: 'SI Academy AI could not finish this answer. Try again.',
      });
      stream.send('done', { messageId: closing.answerId, status: 'failed' });
      stream.end();
    }
    return closed;
  }

  /**
   * What a complete answer leads to, after its stream has ended (Phase 7D): a title for a
   * conversation that has only the one taken from its question; the notes, once enough messages have
   * left the context window; and keeping the answer, when it may be kept. Queued, never waited for:
   * a job that cannot even be queued is logged, and the answer stands.
   */
  private async afterAnswer(
    conversation: ConversationRow,
    turn: AiTurn,
    ended: Ended,
    cacheable: AiCacheCandidate | null,
  ): Promise<void> {
    if (ended.ending !== 'complete') return;
    try {
      if (conversation.titleSource === 'question') await this.titles.queue(conversation.id);
      if (await this.conversations.needsSummary(conversation.id)) {
        await this.summaries.queue(conversation.id);
      }
      if (cacheable && ended.finishReason === 'stop') {
        await this.cache.queueWrite(turn.answerId, cacheable);
      }
    } catch (error) {
      this.logger.warn(
        { ai: { messageId: turn.answerId }, err: errorNameOf(error) },
        'SI Academy AI background work could not be queued',
      );
    }
  }

  /**
   * The ledger rows for a turn's calls. A call that completed has the provider's counts. The call
   * that was writing when the answer stopped — cancelled, timed out, failed — used tokens nobody
   * reported: they are estimated, and marked so; a call that failed before writing used none.
   */
  private ledgerOf(
    calls: readonly AiAttempt[],
    ending: AiAnswerEnding,
    written: string,
    context: AssembledContext,
  ): AiLedgerCall[] {
    const promptCharacters = context.messages.reduce((sum, m) => sum + m.content.length, 0);
    return calls.map((call, index) => {
      const stoppedWriting =
        call.outcome !== 'ok' && index === calls.length - 1 && written.length > 0;
      const usage = call.usage
        ? call.usage
        : stoppedWriting
          ? {
              inputTokens: estimateTokens(promptCharacters),
              outputTokens: estimateTokens(written.length),
              estimated: true,
            }
          : { inputTokens: 0, outputTokens: 0 };
      const cost =
        call.usage !== null
          ? call.estimatedCostUsd
          : stoppedWriting
            ? estimateCostUsd(usage, this.router.costOf(call.model))
            : null;
      return {
        provider: call.provider,
        model: call.model,
        fallback: call.fallback,
        outcome: call.outcome,
        latencyMs: call.latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimated: usage.estimated === true,
        costMicros: toMicros(cost),
      };
    });
  }

  /** The policy, with refusals that matter for governance recorded (ADR-0028: metadata only). */
  private async checkPolicy(
    user: AuthUser,
    purpose: AiPurpose,
    conversationId: string | null,
  ): Promise<void> {
    try {
      await this.policy.assertMayAsk(user, purpose);
    } catch (error) {
      const reason =
        error instanceof AppError && error.code === AI_ERROR_CODES.NOT_ALLOWED
          ? 'timed_assessment'
          : error instanceof AppError && error.code === AI_ERROR_CODES.FEATURE_DISABLED
            ? 'feature_disabled'
            : null;
      if (reason) {
        await this.audit.record({
          action: 'ai.policy.refused',
          resourceType: 'ai_conversation',
          resourceId: conversationId,
          summary: `An SI Academy AI request was refused (${reason})`,
          after: { reason, purpose },
        });
      }
      throw error;
    }
  }

  private async recordRefusal(
    conversation: ConversationRow,
    reason: 'restricted_content' | 'data_not_approved',
    classification: AiClassification,
  ): Promise<void> {
    await this.audit.record({
      action: 'ai.policy.refused',
      resourceType: 'ai_conversation',
      resourceId: conversation.id,
      summary: `An SI Academy AI question was refused (${reason})`,
      after: {
        reason,
        purpose: conversation.purpose,
        dataClass: classification.dataClass,
        reasons: classification.reasons,
      },
    });
  }

  private async recordFailure(
    conversationId: string,
    messageId: string | null,
    kind: string,
  ): Promise<void> {
    await this.audit.record({
      action: 'ai.generation.failed',
      resourceType: 'ai_conversation',
      resourceId: conversationId,
      summary: `An SI Academy AI answer could not be given (${kind})`,
      after: { kind, messageId },
    });
  }
}

/** How an answer ended, and why the model stopped (when it did). */
interface Ended {
  ending: AiAnswerEnding;
  finishReason: string | null;
}

/** How the answer ended: completed, withheld by the provider's filters, cancelled or failed. */
function endingOf(result: AiRoutedResult | null, failure: unknown): AiAnswerEnding {
  if (failure === null && result) return result.finishReason === 'blocked' ? 'blocked' : 'complete';
  if (failure instanceof AiProviderError && failure.kind === 'cancelled') return 'cancelled';
  return 'failed';
}

function kindOf(failure: unknown): string {
  if (failure instanceof AiProviderError) return failure.kind;
  if (failure instanceof AiUnavailableError) return 'unavailable';
  return 'internal';
}

function errorCodeOf(ending: AiAnswerEnding, failure: unknown): string | null {
  if (ending === 'complete') return null;
  if (ending === 'blocked') return 'blocked';
  return kindOf(failure);
}

/** What the reader is told about a failure: the platform's own code and words, nothing else. */
function publicFailure(failure: unknown): { code: string; message: string } {
  if (failure instanceof AppError) {
    return { code: failure.code, message: failure.detail ?? failure.title };
  }
  return {
    code: AI_ERROR_CODES.UNAVAILABLE,
    message: 'SI Academy AI could not answer just now. Try again later.',
  };
}
