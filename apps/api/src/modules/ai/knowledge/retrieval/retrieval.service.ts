import { Injectable, Logger } from '@nestjs/common';
import {
  type AiDataClass,
  type KnowledgeRetrieval,
  type KnowledgeRetrieveRequest,
  knowledgeRetrievalSchema,
} from '@lms/shared';
import { AuditService } from '../../../../core/audit/audit.service.js';
import type { AuthUser } from '../../../../core/auth/auth-user.js';
import { AppError, ValidationError } from '../../../../core/http/errors.js';
import { PrismaService } from '../../../../core/prisma/prisma.service.js';
import { CoursesService, LessonsService } from '../../../courses/index.js';
import {
  AiDataNotApprovedError,
  AiQuotaExceededError,
  AiRestrictedContentError,
} from '../../ai-errors.js';
import { AiPolicyService } from '../../policy/ai-policy.service.js';
import { classifyAiRequest } from '../../policy/data-class.js';
import { AiProviderError, AiUnavailableError } from '../../providers/ai-provider.js';
import { type AiAttempt, ModelRouter } from '../../routing/model-router.js';
import { AiSettingsService } from '../../settings/ai-settings.service.js';
import { toMicros } from '../../usage/cost.js';
import {
  AI_KNOWLEDGE_RETRIEVE_TASK,
  AI_KNOWLEDGE_USAGE_FEATURE,
  AiUsageService,
} from '../../usage/usage.service.js';
import { type KnowledgeEmbeddingContract, activeEmbeddingContract } from '../embedding/contract.js';
import { KnowledgeReachService, RETRIEVABLE_DATA_CLASSES } from '../knowledge-reach.service.js';
import { KnowledgeService } from '../knowledge.service.js';
import {
  KnowledgeRetrievalFailedError,
  KnowledgeRetrievalForbiddenError,
  KnowledgeRetrievalTimeoutError,
  KnowledgeRetrievalUnavailableError,
} from './retrieval-errors.js';
import {
  KNOWLEDGE_RETRIEVAL_LIMITS,
  candidatesFor,
  selectPassages,
  toResult,
} from './selection.js';
import { KnowledgeVectorSearch, type RetrievalScope, isStatementTimeout } from './vector-search.js';

/** Why a retrieval was refused before any search, as its audit entry records it. */
type Refusal =
  | 'not_configured'
  | 'timed_test'
  | 'context_forbidden'
  | 'restricted_content'
  | 'data_not_approved'
  | 'quota_requests'
  | 'quota_tokens'
  | 'quota_budget'
  | 'unpriced_model';

/** Why a retrieval failed once it had started, as its audit entry records it. */
type Failure =
  'provider_unavailable' | 'provider_malformed' | 'timeout' | 'cancelled' | 'search_failed';

/** What a retrieval was asked: how many passages, and from which course or lesson. */
interface Ask {
  topK: number;
  courseId: string | null;
  lessonId: string | null;
}

/** A refusal or failure that has been recorded, carrying the problem the person is answered with. */
class Recorded extends Error {
  constructor(readonly problem: AppError) {
    super(problem.message);
  }
}

/**
 * Retrieval from the knowledge base (Roadmap Phase 8D; ADR-0036): a question to the passages a
 * person may draw on, best first, with their provenance — no model writes anything.
 *
 * 1. **May they ask?** Both flags (`module.ai`, `ai.knowledge`), an embedding contract on this
 *    installation, the course or lesson they ask from (one they can open — never taken on trust),
 *    the question's data class (a credential is never sent; a class the provider is not approved for
 *    is refused), and their allowance and the institute's budget.
 * 2. **What may they draw on?** The reach rule (`KnowledgeReachService.reachOf`), resolved on the
 *    server, with the data classes a retrieval may draw on.
 * 3. **The question as a vector**, through the model router — `RETRIEVAL_QUERY`, the active
 *    contract's model and dimension, the router's checks — within the retrieval's deadline.
 * 4. **The search** (`KnowledgeVectorSearch`): every rule a condition of the one SQL statement.
 * 5. **Selection**: de-duplicated, at most two passages a document, the first K.
 * 6. **Records**: the call in the usage ledger (no question, no passage), one audit entry (ids and
 *    counts), one log line of numbers.
 */
@Injectable()
export class KnowledgeRetrievalService {
  private readonly logger = new Logger(KnowledgeRetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeService,
    private readonly reach: KnowledgeReachService,
    private readonly search: KnowledgeVectorSearch,
    private readonly courses: CoursesService,
    private readonly lessons: LessonsService,
    private readonly router: ModelRouter,
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageService,
    private readonly audit: AuditService,
    private readonly policy: AiPolicyService,
  ) {}

  async retrieve(
    user: AuthUser,
    input: KnowledgeRetrieveRequest,
    signal: AbortSignal,
  ): Promise<KnowledgeRetrieval> {
    await this.knowledge.assertOn(user);
    // The institute's settings first: they narrow the data the provider may be given.
    await this.settings.current();
    const started = performance.now();
    const asked: Ask = {
      topK: input.topK,
      courseId: input.courseId ?? null,
      lessonId: input.lessonId ?? null,
    };
    try {
      // No AI on any surface while a timed test is open (ADR-0031; Phase 8F).
      await this.policy.assertNotInTimedTest(user).catch(async (error: unknown) => {
        throw await this.refuse(user, asked, 'timed_test', error as AppError);
      });
      const contract = activeEmbeddingContract(this.router);
      if (!contract) {
        throw await this.refuse(
          user,
          asked,
          'not_configured',
          new KnowledgeRetrievalUnavailableError(),
        );
      }
      const context = await this.contextOf(user, input, asked);
      const ask: Ask = { topK: input.topK, ...context };
      const dataClass = await this.classify(user, input.query, ask);
      await this.assertWithinQuota(user, contract, ask);
      const reach = await this.reach.reachOf(user);
      const scope: RetrievalScope = {
        organizationId: user.organizationId,
        sourceIds: reach.sourceIds,
        closedDocumentIds: reach.closedDocumentIds,
        dataClasses: [...RETRIEVABLE_DATA_CLASSES],
        courseId: context.courseId,
        lessonId: context.lessonId,
      };

      const deadline = AbortSignal.timeout(KNOWLEDGE_RETRIEVAL_LIMITS.deadlineMs);
      const vector = await this.embedQuery(user, input.query, dataClass, contract, ask, {
        caller: signal,
        deadline,
      });
      const embeddedAt = performance.now();
      const remaining = KNOWLEDGE_RETRIEVAL_LIMITS.deadlineMs - (embeddedAt - started);
      if (remaining <= 0) {
        throw await this.fail(user, ask, 'timeout', contract, new KnowledgeRetrievalTimeoutError());
      }
      let candidates;
      try {
        candidates = await this.search.search(scope, contract, vector, {
          limit: candidatesFor(input.topK),
          timeoutMs: remaining,
        });
      } catch (error) {
        const timedOut = isStatementTimeout(error);
        throw await this.fail(
          user,
          ask,
          timedOut ? 'timeout' : 'search_failed',
          contract,
          timedOut ? new KnowledgeRetrievalTimeoutError() : new KnowledgeRetrievalFailedError(500),
        );
      }
      const passages = selectPassages(candidates, input.topK);
      const retrieval = knowledgeRetrievalSchema.parse({
        results: passages.map(toResult),
        topK: input.topK,
        context,
      });
      const durationMs = Math.round(performance.now() - started);
      await this.record(user, 'succeeded', ask, {
        resultCount: retrieval.results.length,
        candidates: candidates.length,
        documentIds: [...new Set(retrieval.results.map((result) => result.document.id))],
        durationMs,
        ...contract,
      });
      this.logger.log(
        {
          knowledge: {
            retrieval: {
              results: retrieval.results.length,
              candidates: candidates.length,
              embedMs: Math.round(embeddedAt - started),
              searchMs: Math.round(performance.now() - embeddedAt),
              ms: durationMs,
              course: context.courseId !== null,
              lesson: context.lessonId !== null,
            },
          },
        },
        'Knowledge retrieved',
      );
      return retrieval;
    } catch (error) {
      if (error instanceof Recorded) throw error.problem;
      throw error;
    }
  }

  /**
   * The course or lesson a retrieval is asked from, checked as the course and the lesson player
   * would check them — never taken on trust. A lesson brings its course.
   */
  private async contextOf(
    user: AuthUser,
    input: KnowledgeRetrieveRequest,
    asked: Ask,
  ): Promise<{ courseId: string | null; lessonId: string | null }> {
    if (input.lessonId) {
      let courseId: string;
      try {
        courseId = (await this.lessons.aiContextFor(input.lessonId, user)).courseId;
      } catch (error) {
        if (error instanceof AppError && (error.status === 403 || error.status === 404)) {
          throw await this.refuse(
            user,
            asked,
            'context_forbidden',
            new KnowledgeRetrievalForbiddenError(),
          );
        }
        throw error;
      }
      if (input.courseId && input.courseId !== courseId) {
        throw new ValidationError([
          { path: 'lessonId', message: 'The lesson is not a lesson of that course' },
        ]);
      }
      return { courseId, lessonId: input.lessonId };
    }
    if (input.courseId) {
      if (!(await this.courses.reachableCourseIds(user)).includes(input.courseId)) {
        throw await this.refuse(
          user,
          asked,
          'context_forbidden',
          new KnowledgeRetrievalForbiddenError(),
        );
      }
      return { courseId: input.courseId, lessonId: null };
    }
    return { courseId: null, lessonId: null };
  }

  /**
   * The question's data class (ADR-0024), as the gateway decides a question's: a credential is
   * never sent anywhere; a question asked from a course or lesson is course data; any other is
   * public. Refused when the provider may not be given it.
   */
  private async classify(user: AuthUser, query: string, ask: Ask): Promise<AiDataClass> {
    const { dataClass } = classifyAiRequest({
      purpose: ask.courseId ? 'assistant' : 'workspace',
      subject: { courseId: ask.courseId, lessonId: ask.lessonId, questionId: null },
      message: query,
    });
    if (dataClass === 'restricted') {
      throw await this.refuse(user, ask, 'restricted_content', new AiRestrictedContentError());
    }
    const refusal = this.router.embeddingRefusal(dataClass);
    if (refusal === 'data_class_not_approved' || refusal === 'restricted_data') {
      throw await this.refuse(
        user,
        ask,
        'data_not_approved',
        new AiDataNotApprovedError(dataClass),
      );
    }
    if (refusal) {
      throw await this.refuse(
        user,
        ask,
        'not_configured',
        new KnowledgeRetrievalUnavailableError(),
      );
    }
    return dataClass;
  }

  private async assertWithinQuota(
    user: AuthUser,
    contract: KnowledgeEmbeddingContract,
    ask: Ask,
  ): Promise<void> {
    const blocked = await this.usage.retrievalBlockedBy(
      user.id,
      user.organizationId,
      contract.model,
    );
    if (!blocked) return;
    if (blocked === 'unpriced') {
      throw await this.refuse(
        user,
        ask,
        'unpriced_model',
        new KnowledgeRetrievalUnavailableError(),
      );
    }
    throw await this.refuse(user, ask, `quota_${blocked}`, new AiQuotaExceededError(blocked));
  }

  /**
   * The question as a vector: `RETRIEVAL_QUERY`, the active contract's model and dimension, through
   * the router's checks, within the retrieval's deadline. The call is recorded in the ledger, done
   * or not; a failure is answered in the retrieval's own words.
   */
  private async embedQuery(
    user: AuthUser,
    query: string,
    dataClass: AiDataClass,
    contract: KnowledgeEmbeddingContract,
    ask: Ask,
    signals: { caller: AbortSignal; deadline: AbortSignal },
  ): Promise<number[]> {
    const calls: AiAttempt[] = [];
    try {
      const embedded = await this.router.embed(
        {
          feature: 'knowledge',
          dataClass,
          userId: user.id,
          organizationId: user.organizationId,
          purpose: 'query',
          texts: [query],
          onAttempt: (attempt) => calls.push(attempt),
        },
        AbortSignal.any([signals.caller, signals.deadline]),
      );
      await this.recordUsage(user, dataClass, calls);
      return embedded.vectors[0]!;
    } catch (error) {
      await this.recordUsage(user, dataClass, calls).catch(() => undefined);
      if (error instanceof AiUnavailableError) {
        throw await this.fail(
          user,
          ask,
          'provider_unavailable',
          contract,
          new KnowledgeRetrievalUnavailableError(),
        );
      }
      if (error instanceof AiProviderError) {
        if (error.kind === 'timeout' || (error.kind === 'cancelled' && signals.deadline.aborted)) {
          throw await this.fail(
            user,
            ask,
            'timeout',
            contract,
            new KnowledgeRetrievalTimeoutError(),
          );
        }
        if (error.kind === 'cancelled') {
          throw await this.fail(
            user,
            ask,
            'cancelled',
            contract,
            new KnowledgeRetrievalUnavailableError(),
          );
        }
        if (error.kind === 'malformed' || error.kind === 'bad_request') {
          throw await this.fail(
            user,
            ask,
            'provider_malformed',
            contract,
            new KnowledgeRetrievalFailedError(502),
          );
        }
        throw await this.fail(
          user,
          ask,
          'provider_unavailable',
          contract,
          new KnowledgeRetrievalUnavailableError(),
        );
      }
      throw error;
    }
  }

  /** The query's call in the ledger: tokens and cost, never the question or a passage. */
  private async recordUsage(user: AuthUser, dataClass: string, calls: readonly AiAttempt[]) {
    if (calls.length === 0) return;
    const { day } = await this.usage.today();
    await this.prisma.$transaction((tx) =>
      this.usage.recordTurn(
        tx,
        {
          organizationId: user.organizationId,
          userId: user.id,
          conversationId: null,
          messageId: null,
          feature: AI_KNOWLEDGE_USAGE_FEATURE,
          task: AI_KNOWLEDGE_RETRIEVE_TASK,
          dataClass,
          requestId: null,
          question: false,
          calls: calls.map((call) => ({
            provider: call.provider,
            model: call.model,
            fallback: call.fallback,
            outcome: call.outcome,
            latencyMs: call.latencyMs,
            inputTokens: call.usage?.inputTokens ?? 0,
            outputTokens: 0,
            estimated: call.usage?.estimated === true,
            costMicros: toMicros(call.estimatedCostUsd),
          })),
        },
        day,
      ),
    );
  }

  private async refuse(
    user: AuthUser,
    ask: Ask,
    reason: Refusal,
    problem: AppError,
  ): Promise<Recorded> {
    await this.record(user, 'refused', ask, { reason });
    return new Recorded(problem);
  }

  private async fail(
    user: AuthUser,
    ask: Ask,
    failure: Failure,
    contract: KnowledgeEmbeddingContract,
    problem: AppError,
  ): Promise<Recorded> {
    await this.record(user, 'failed', ask, { failureCode: failure, ...contract });
    this.logger.warn({ knowledge: { retrieval: { failure } } }, 'Knowledge retrieval failed');
    return new Recorded(problem);
  }

  /**
   * One audit entry per retrieval (ADR-0036): who asked is the entry's actor; it keeps the outcome,
   * the course or lesson asked from, counts, the documents a success drew on, the contract and the
   * time — never the question, a passage or a vector.
   */
  private async record(
    user: AuthUser,
    status: 'succeeded' | 'refused' | 'failed',
    ask: Ask,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      action: 'ai.knowledge.retrieval',
      resourceType: 'knowledge_retrieval',
      resourceId: null,
      summary: `A knowledge retrieval ${status}`,
      after: { status, topK: ask.topK, courseId: ask.courseId, lessonId: ask.lessonId, ...details },
      actorId: user.id,
    });
  }
}
