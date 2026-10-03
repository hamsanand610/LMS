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
  AiDataNotApprovedError,
  AiGenerationBusyError,
  AiRestrictedContentError,
} from '../ai-errors.js';
import { type AssembledContext, assembleContext } from '../context/context-assembler.js';
import { AiConversationsService, type AiTurn } from '../conversations/conversations.service.js';
import { type AiClassification, classifyAiRequest } from '../policy/data-class.js';
import { AiPolicyService } from '../policy/ai-policy.service.js';
import { AiProviderError, AiUnavailableError, errorNameOf } from '../providers/ai-provider.js';
import {
  type AiAttempt,
  type AiRouteRequest,
  type AiRoutedResult,
  ModelRouter,
} from '../routing/model-router.js';
import { AnswerStream } from '../streaming/answer-stream.js';
import { estimateCostUsd, estimateTokens, toMicros } from '../usage/cost.js';
import { type AiLedgerCall, AiUsageService } from '../usage/usage.service.js';

type Conversation = Awaited<ReturnType<AiConversationsService['owned']>>;

/**
 * The only way into SI Academy AI (AI architecture §2; Phase 7C). A question goes through, in order:
 *
 * 1. the platform's guards (rate limit, authentication, CSRF and origin, `module.ai`, permission);
 * 2. ownership of the conversation (anybody else's is not found);
 * 3. the policy: the surface's flag and permission, and no help during a timed test (ADR-0031);
 * 4. a configured, answering model service;
 * 5. the data class (ADR-0024): a message holding a credential is refused and not stored; a class
 *    the deployment has not approved for its provider is refused before anything is written;
 * 6. the quotas, before any call (ADR-0029);
 * 7. the generation gate, with the question and the answer's placeholder written together;
 * 8. the context: the recent conversation only;
 * 9. the model router, the only path to a provider, streamed back as SI Academy's own events;
 * 10. closing the answer once, with its usage — however it ended — which opens the gate again.
 *
 * Refusals before step 7 are ordinary problem responses. From step 9 the response is an event
 * stream, and anything that goes wrong is said in an `error` event, followed by `done`.
 */
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly policy: AiPolicyService,
    private readonly router: ModelRouter,
    private readonly conversations: AiConversationsService,
    private readonly usage: AiUsageService,
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
    await this.checkPolicy(user, conversation.purpose, conversation.id);

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

    await this.usage.assertWithinQuota(user, conversation.id);

    const context = assembleContext(
      conversation.purpose,
      await this.conversations.history(conversation.id),
      input.content,
    );
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
    await this.answer(user, conversation, turn, route, context, res);
  }

  /** Configured or not, answering or not, and how the service is doing; never which provider, model or key. */
  status(): AiAdminStatus {
    return aiAdminStatusSchema.parse({
      configured: this.router.configured,
      gatewayReady: this.policy.gatewayReady(),
      service: this.router.serviceState(),
    });
  }

  /** Streams the answer, then closes the turn once, however it ended. */
  private async answer(
    user: AuthUser,
    conversation: Conversation,
    turn: AiTurn,
    route: AiRouteRequest,
    context: AssembledContext,
    res: Response,
  ): Promise<void> {
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
    let closed = false;
    try {
      closed = await this.conversations.finishTurn({
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
          calls: ledger,
        },
      });
    } catch (error) {
      // The answer stays `streaming` until it counts as abandoned, and is then closed as failed.
      this.logger.error(
        { ai: { messageId: turn.answerId }, err: errorNameOf(error) },
        'An SI Academy AI answer could not be closed',
      );
    }

    if (!closed) {
      stream.send('error', {
        code: AI_ERROR_CODES.UNAVAILABLE,
        message: 'SI Academy AI could not finish this answer. Try again.',
      });
      stream.send('done', { messageId: turn.answerId, status: 'failed' });
      stream.end();
      return;
    }
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
    conversation: Conversation,
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
