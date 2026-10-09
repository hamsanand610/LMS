import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  AI_ERROR_CODES,
  AI_KNOWLEDGE_ANSWERS_FLAG,
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  type AiDataClass,
  type KnowledgeAnswer,
  type KnowledgeAnswerRequest,
  type KnowledgeAnswerStatus,
  type KnowledgeAnswerUsage,
  type KnowledgeCitation,
  type KnowledgePreviewRequest,
  type KnowledgeRetrieval,
  knowledgeAnswerSchema,
  knowledgeAnswerStreamEventSchemas,
} from '@lms/shared';
import { AuditService } from '../../../../core/audit/audit.service.js';
import type { AuthUser } from '../../../../core/auth/auth-user.js';
import { APP_CONFIG, type AppConfig } from '../../../../core/config/env.js';
import { AppError, ForbiddenError, NotFoundError } from '../../../../core/http/errors.js';
import { getRequestContext } from '../../../../core/http/request-context.js';
import { PrismaService } from '../../../../core/prisma/prisma.service.js';
import { FlagsService } from '../../../settings/flags.service.js';
import {
  AiDataNotApprovedError,
  AiGenerationBusyError,
  AiRestrictedContentError,
} from '../../ai-errors.js';
import { AiPolicyService } from '../../policy/ai-policy.service.js';
import { classifyAiRequest } from '../../policy/data-class.js';
import { AiProviderError, AiUnavailableError } from '../../providers/ai-provider.js';
import { type AiAttempt, type AiRouteRequest, ModelRouter } from '../../routing/model-router.js';
import { AiSettingsService } from '../../settings/ai-settings.service.js';
import { AnswerStream, HEARTBEAT_MS } from '../../streaming/answer-stream.js';
import { toMicros } from '../../usage/cost.js';
import {
  AI_KNOWLEDGE_ANSWER_TASK,
  AI_KNOWLEDGE_USAGE_FEATURE,
  AiUsageService,
} from '../../usage/usage.service.js';
import { activeEmbeddingContract } from '../embedding/contract.js';
import { KnowledgeRetrievalService, type RetrievalMode } from '../retrieval/retrieval.service.js';
import {
  KnowledgeAnswerBusyError,
  KnowledgeAnswerFailedError,
  KnowledgeAnswerTimeoutError,
  KnowledgeAnswerUnavailableError,
  NOT_CALIBRATED_DETAIL,
} from './answer-errors.js';
import {
  KNOWLEDGE_ANSWER_LIMITS,
  type PackedPassage,
  type Withheld,
  evidenceFloorFor,
  packEvidence,
} from './evidence.js';
import {
  GROUNDED_PROMPT_VERSION,
  INSTRUCTION_FINGERPRINTS,
  groundedMessages,
} from './grounded-prompt.js';
import { type AcceptedAnswer, checkAnswer } from './validation.js';

/** What a grounded answer says when it declines or reports a conflict: the platform's own words. */
export const ANSWER_WORDS = {
  insufficient:
    "I couldn't find enough information in the available SI Academy knowledge to answer that reliably.",
  notGrounded:
    "I couldn't put together an answer that the available SI Academy knowledge fully supports. Try asking in another way.",
  conflictBefore: 'The available SI Academy knowledge gives conflicting information on this.',
  conflictAfter:
    'Check with your course team or the authoritative source before relying on either.',
} as const;

/** Everything an answer's audit entry records: ids, counts, codes and times — never content. */
interface Trace {
  courseId: string | null;
  lessonId: string | null;
  retrieved: number;
  used: number;
  withheld: Withheld | null;
  evidenceCharacters: number;
  attempts: number;
  faults: string[];
  citations: number;
  documentIds: string[];
  provider: string | null;
  model: string | null;
  /** The stand-in answered: the fallback provider's model, or another of the provider's (ADR-0038). */
  fallback: boolean;
  retrievalMs: number | null;
  generationMs: number | null;
  /** A question the knowledge base's managers tried from its page (Phase 10). */
  preview: boolean;
}

/** What `meta` says, once the evidence is chosen and before any model is called. */
export interface AnswerEvidence {
  context: KnowledgeRetrieval['context'];
  evidence: { retrieved: number; used: number };
}

/**
 * Grounded answers from the knowledge base (Roadmap Phase 8E; ADR-0037): a person's question,
 * answered only from the passages they may draw on, every sentence citing its passage — or
 * declined, when the passages do not say.
 *
 * 1. **May they ask?** `module.ai`, `ai.knowledge` and `ai.knowledge_answers`; no timed test open;
 *    no credential in the question; a model that can answer, and an evidence floor for the active
 *    embedding model; their allowance and the institute's budget; one answer at a time each.
 * 2. **Retrieval** (`KnowledgeRetrievalService`, Phase 8D) — the one authority on what they may
 *    draw on, with its own checks, records and the reach rule. Nothing here reads the knowledge base.
 * 3. **The evidence** (`packEvidence`): of what retrieval returned, only passages similar enough to
 *    be evidence, of a data class the provider may be given, with no credential — bounded, ordered
 *    as retrieved, cited `S1`, `S2`, …. None: the answer declines, and no model is called.
 * 4. **The model** through the router (the `chat` task's model, its data-class approval, deadline
 *    and circuits): the instructions in the system channel; the evidence and the question as data.
 * 5. **The check** (`checkAnswer`): no leaked instruction or credential; every citation one of the
 *    evidence's; every sentence cited. Once more if not — then withheld.
 * 6. **Records**: the call in the usage ledger (a question of theirs), one audit entry and one log
 *    line — ids, counts and codes, never the question, a passage, the answer or the prompt.
 */
@Injectable()
export class KnowledgeAnswerService {
  private readonly logger = new Logger(KnowledgeAnswerService.name);
  /** People with an answer being written now: one at a time each. */
  private readonly writing = new Set<string>();

  constructor(
    private readonly flags: FlagsService,
    private readonly policy: AiPolicyService,
    private readonly settings: AiSettingsService,
    private readonly router: ModelRouter,
    private readonly retrieval: KnowledgeRetrievalService,
    private readonly usage: AiUsageService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * The route: one JSON answer, or — when `stream` is asked — server-sent events: `meta` once the
   * evidence is chosen, then, once the answer has been checked, `delta`, `sources`, `notice`,
   * `usage` and `done`. Anything refused before the evidence is chosen is an ordinary problem
   * response; a failure after it, an `error` event. The work stops when the client goes.
   */
  async respond(user: AuthUser, input: KnowledgeAnswerRequest, res: Response): Promise<void> {
    const reader = new AbortController();
    const gone = () => {
      if (!res.writableFinished) reader.abort(new Error('The client went away'));
    };
    res.on('close', gone);
    try {
      if (!input.stream) {
        const answer = await this.answer(user, input, reader.signal);
        if (!res.destroyed) res.status(200).json(answer);
        return;
      }
      const opened: { stream: AnswerStream<typeof knowledgeAnswerStreamEventSchemas> | null } = {
        stream: null,
      };
      try {
        const answer = await this.answer(user, input, reader.signal, (meta) => {
          const stream = new AnswerStream(res, HEARTBEAT_MS, knowledgeAnswerStreamEventSchemas);
          stream.open();
          stream.send('meta', meta);
          opened.stream = stream;
        });
        writeAnswer(opened.stream!, answer);
      } catch (error) {
        if (!opened.stream) throw error;
        opened.stream.send('error', publicFailure(error));
        opened.stream.send('done', { status: 'failed' });
        opened.stream.end();
      }
    } finally {
      res.off('close', gone);
    }
  }

  /**
   * A question the knowledge base's managers try from its page (Phase 10): answered as every grounded
   * answer is — the same flags, checks, evidence floor, model, citations, ledger and audit — over
   * the institute's published knowledge, or one source of it (`RetrievalMode` `managed`). The route
   * holds it to `ai:knowledge_manage`; one JSON answer.
   */
  async preview(
    user: AuthUser,
    input: KnowledgePreviewRequest,
    signal: AbortSignal,
  ): Promise<KnowledgeAnswer> {
    if (input.sourceId) {
      const source = await this.prisma.knowledgeSource.findFirst({
        where: { id: input.sourceId, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!source) throw new NotFoundError('Knowledge source');
    }
    return this.answer(
      user,
      {
        query: input.query,
        stream: false,
        ...(input.courseId ? { courseId: input.courseId } : {}),
        ...(input.lessonId ? { lessonId: input.lessonId } : {}),
      },
      signal,
      undefined,
      { kind: 'managed', sourceId: input.sourceId ?? null },
    );
  }

  /** A grounded answer: the one implementation both forms of the route share. */
  async answer(
    user: AuthUser,
    input: KnowledgeAnswerRequest,
    signal: AbortSignal,
    onEvidence?: (evidence: AnswerEvidence) => void,
    mode: RetrievalMode = { kind: 'reach' },
  ): Promise<KnowledgeAnswer> {
    await this.assertOn(user);
    const started = performance.now();
    const trace: Trace = {
      courseId: input.courseId ?? null,
      lessonId: input.lessonId ?? null,
      retrieved: 0,
      used: 0,
      withheld: null,
      evidenceCharacters: 0,
      attempts: 0,
      faults: [],
      citations: 0,
      documentIds: [],
      provider: null,
      model: null,
      fallback: false,
      retrievalMs: null,
      generationMs: null,
      preview: mode.kind === 'managed',
    };
    let release: (() => void) | null = null;
    try {
      await this.policy.assertNotInTimedTest(user);
      // The institute's settings first: they narrow the models and the data the provider may be given.
      await this.settings.current();
      const asked = classifyAiRequest({
        purpose: 'assistant',
        subject: { courseId: trace.courseId, lessonId: trace.lessonId, questionId: null },
        message: input.query,
      });
      if (asked.dataClass === 'restricted') throw new AiRestrictedContentError();
      this.assertCanAnswer(this.route(user, asked.dataClass));
      const contract = activeEmbeddingContract(this.router);
      const floor = evidenceFloorFor(
        contract?.model ?? null,
        this.config.AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY,
      );
      if (floor === null) throw new KnowledgeAnswerUnavailableError(NOT_CALIBRATED_DETAIL);
      await this.usage.assertWithinQuota(user, null, 'knowledge_answer');
      release = this.acquire(user.id);

      const retrievalStarted = performance.now();
      const retrieval = await this.retrieval.retrieve(
        user,
        {
          query: input.query,
          topK: KNOWLEDGE_ANSWER_LIMITS.retrieve,
          ...(input.courseId ? { courseId: input.courseId } : {}),
          ...(input.lessonId ? { lessonId: input.lessonId } : {}),
        },
        signal,
        mode,
      );
      trace.retrievalMs = Math.round(performance.now() - retrievalStarted);
      trace.courseId = retrieval.context.courseId;
      trace.lessonId = retrieval.context.lessonId;
      trace.retrieved = retrieval.results.length;
      const evidence = packEvidence(retrieval.results, {
        floor,
        approved: this.router.approvedDataClasses(),
      });
      trace.used = evidence.packed.length;
      trace.withheld = evidence.withheld;
      trace.evidenceCharacters = evidence.characters;
      onEvidence?.({
        context: retrieval.context,
        evidence: { retrieved: trace.retrieved, used: trace.used },
      });
      if (evidence.packed.length === 0) {
        return await this.finish(user, trace, started, 'no_evidence', {
          ...declined('insufficient_evidence', retrieval, trace),
          usage: null,
        });
      }

      const dataClass: AiDataClass =
        asked.dataClass === 'course' ||
        evidence.packed.some((passage) => passage.result.source.dataClass === 'course')
          ? 'course'
          : 'public';
      const route = this.route(user, dataClass);
      this.assertCanAnswer(route);
      const calls: AiAttempt[] = [];
      let checked: AcceptedAnswer | null;
      try {
        checked = await this.generate(route, evidence.packed, input.query, calls, signal, trace);
      } finally {
        await this.recordUsage(user, dataClass, calls);
      }
      const usage = await this.usageOf(user, calls);
      if (!checked) {
        return await this.finish(user, trace, started, trace.faults.at(-1) ?? 'not_grounded', {
          ...declined('not_grounded', retrieval, trace),
          usage,
        });
      }
      if (checked.kind === 'declined') {
        return await this.finish(user, trace, started, 'model_declined', {
          ...declined('insufficient_evidence', retrieval, trace),
          usage,
        });
      }
      const citations = checked.cited.map((id) =>
        citationOf(evidence.packed.find((passage) => passage.id === id)!),
      );
      trace.citations = citations.length;
      trace.documentIds = [...new Set(citations.map((citation) => citation.documentId))];
      const conflict = checked.kind === 'conflict';
      return await this.finish(user, trace, started, null, {
        status: conflict ? 'conflicting' : 'answered',
        answer: conflict
          ? `${ANSWER_WORDS.conflictBefore} ${checked.text} ${ANSWER_WORDS.conflictAfter}`
          : checked.text,
        citations,
        context: retrieval.context,
        evidence: { retrieved: trace.retrieved, used: trace.used },
        usage,
      });
    } catch (error) {
      await this.recordFailure(user, trace, started, error);
      throw error;
    } finally {
      release?.();
    }
  }

  /** `module.ai`, `ai.knowledge` and `ai.knowledge_answers`: otherwise nothing is retrieved or sent. */
  private async assertOn(user: AuthUser): Promise<void> {
    const flags = await this.flags.effectiveFor(user);
    if (
      flags[AI_MODULE_FLAG] !== true ||
      flags[AI_KNOWLEDGE_FLAG] !== true ||
      flags[AI_KNOWLEDGE_ANSWERS_FLAG] !== true
    ) {
      throw new ForbiddenError(
        "SI Academy AI's answers from the knowledge base are switched off.",
        AI_ERROR_CODES.FEATURE_DISABLED,
      );
    }
  }

  private route(user: AuthUser, dataClass: AiDataClass): AiRouteRequest {
    return {
      task: 'chat',
      feature: 'knowledge',
      dataClass,
      userId: user.id,
      organizationId: user.organizationId,
    };
  }

  /** A model that answers now, approved for the data in the request — or a refusal before any call. */
  private assertCanAnswer(route: AiRouteRequest): void {
    const service = this.router.serviceState();
    if (service === 'off') throw new KnowledgeAnswerUnavailableError();
    if (service === 'unavailable') throw new AiProviderError('circuit_open');
    const refusal = this.router.refusalFor(route);
    if (refusal === 'data_class_not_approved') throw new AiDataNotApprovedError(route.dataClass);
    if (refusal) throw new KnowledgeAnswerUnavailableError();
  }

  /** One answer at a time for each person, and a bound on this process's answers at once. */
  private acquire(userId: string): () => void {
    if (this.writing.has(userId)) throw new AiGenerationBusyError();
    if (this.writing.size >= KNOWLEDGE_ANSWER_LIMITS.concurrent) {
      throw new KnowledgeAnswerBusyError();
    }
    this.writing.add(userId);
    return () => {
      this.writing.delete(userId);
    };
  }

  /**
   * The model's answer, checked: at most two attempts — the second after one that broke the rules,
   * with a reminder — then null (withheld). A provider's failure is not retried here (the router
   * has its own fallback); it is said in the answer's own words.
   */
  private async generate(
    route: AiRouteRequest,
    packed: readonly PackedPassage[],
    question: string,
    calls: AiAttempt[],
    signal: AbortSignal,
    trace: Trace,
  ): Promise<AcceptedAnswer | null> {
    const referenceCode = randomBytes(12).toString('base64url');
    const checks = {
      ids: new Set(packed.map((passage) => passage.id)),
      secrets: [referenceCode, ...INSTRUCTION_FINGERPRINTS],
      maxCharacters: KNOWLEDGE_ANSWER_LIMITS.answerCharacters,
      passages: new Map(
        packed.map((passage) => [
          passage.id,
          `${passage.document}\n${passage.heading}\n${passage.content}`,
        ]),
      ),
    };
    const deadline = AbortSignal.timeout(
      this.config.AI_TIMEOUT_MS * KNOWLEDGE_ANSWER_LIMITS.attempts + 5_000,
    );
    const callSignal = AbortSignal.any([signal, deadline]);
    const started = performance.now();
    try {
      for (let attempt = 1; attempt <= KNOWLEDGE_ANSWER_LIMITS.attempts; attempt += 1) {
        trace.attempts = attempt;
        const result = await this.router.chat(
          {
            ...route,
            messages: groundedMessages(packed, question, referenceCode, attempt > 1),
            maxOutputTokens: Math.min(
              this.config.AI_MAX_OUTPUT_TOKENS,
              KNOWLEDGE_ANSWER_LIMITS.outputTokens,
            ),
            temperature: KNOWLEDGE_ANSWER_LIMITS.temperature,
            onAttempt: (call) => calls.push(call),
          },
          callSignal,
        );
        trace.provider = result.provider;
        trace.model = result.model;
        trace.fallback = result.fallback;
        if (result.finishReason === 'blocked') {
          trace.faults.push('blocked');
          return null;
        }
        const checked = checkAnswer(result.text, checks);
        if (checked.ok) return checked;
        trace.faults.push(checked.fault);
      }
      return null;
    } catch (error) {
      throw failureOf(error, signal, deadline);
    } finally {
      trace.generationMs = Math.round(performance.now() - started);
    }
  }

  /** The calls in the usage ledger: a question of the person's, counted in their day and the budget. */
  private async recordUsage(user: AuthUser, dataClass: string, calls: readonly AiAttempt[]) {
    if (calls.length === 0) return;
    try {
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
            task: AI_KNOWLEDGE_ANSWER_TASK,
            dataClass,
            requestId: getRequestContext()?.requestId ?? null,
            question: true,
            calls: calls.map((call) => ({
              provider: call.provider,
              model: call.model,
              fallback: call.fallback,
              outcome: call.outcome,
              latencyMs: call.latencyMs,
              inputTokens: call.usage?.inputTokens ?? 0,
              outputTokens: call.usage?.outputTokens ?? 0,
              estimated: call.usage?.estimated === true,
              costMicros: toMicros(call.estimatedCostUsd),
            })),
          },
          day,
        ),
      );
    } catch (error) {
      this.logger.error(
        { knowledge: { answer: { calls: calls.length } }, err: error },
        'A grounded answer could not be recorded in the usage ledger',
      );
    }
  }

  private async usageOf(
    user: AuthUser,
    calls: readonly AiAttempt[],
  ): Promise<KnowledgeAnswerUsage | null> {
    if (calls.length === 0) return null;
    const left = await this.usage.allowance(user.id);
    return {
      inputTokens: calls.reduce((sum, call) => sum + (call.usage?.inputTokens ?? 0), 0),
      outputTokens: calls.reduce((sum, call) => sum + (call.usage?.outputTokens ?? 0), 0),
      estimated: calls.some((call) => call.usage?.estimated === true),
      requestsLeftToday: left.requestsLeft,
      tokensLeftToday: left.tokensLeft,
    };
  }

  /** The answer, parsed on its way out (nothing else gets through), audited and logged. */
  private async finish(
    user: AuthUser,
    trace: Trace,
    started: number,
    reason: string | null,
    answer: KnowledgeAnswer,
  ): Promise<KnowledgeAnswer> {
    const parsed = knowledgeAnswerSchema.parse(answer);
    const durationMs = Math.round(performance.now() - started);
    await this.record(user, parsed.status, reason, trace, durationMs);
    this.logger.log(
      {
        knowledge: {
          answer: {
            status: parsed.status,
            retrieved: trace.retrieved,
            used: trace.used,
            citations: trace.citations,
            attempts: trace.attempts,
            retrievalMs: trace.retrievalMs,
            generationMs: trace.generationMs,
            ms: durationMs,
          },
        },
      },
      'Knowledge answered',
    );
    return parsed;
  }

  private async recordFailure(
    user: AuthUser,
    trace: Trace,
    started: number,
    error: unknown,
  ): Promise<void> {
    const cancelled = error instanceof AiProviderError && error.kind === 'cancelled';
    const status = cancelled
      ? 'cancelled'
      : error instanceof AppError && error.status < 500
        ? 'refused'
        : 'failed';
    const reason = error instanceof AppError ? error.code : 'internal';
    try {
      await this.record(user, status, reason, trace, Math.round(performance.now() - started));
    } catch (recordError) {
      this.logger.error({ err: recordError }, 'A grounded answer could not be audited');
    }
  }

  /**
   * One entry per answer asked for (ADR-0037, amending ADR-0028's item 4 as ADR-0036 did for
   * retrievals): how it ended and why, the evidence counted, the documents cited, the model and the
   * times — never the question, a passage, the answer, the prompt or a key.
   */
  private async record(
    user: AuthUser,
    status: KnowledgeAnswerStatus | 'refused' | 'failed' | 'cancelled',
    reason: string | null,
    trace: Trace,
    durationMs: number,
  ): Promise<void> {
    await this.audit.record({
      action: 'ai.knowledge.answer',
      resourceType: 'knowledge_answer',
      resourceId: null,
      summary: `A grounded answer from the knowledge base: ${status}${reason ? ` (${reason})` : ''}`,
      after: {
        status,
        reason,
        courseId: trace.courseId,
        lessonId: trace.lessonId,
        retrieved: trace.retrieved,
        used: trace.used,
        withheld: trace.withheld,
        evidenceCharacters: trace.evidenceCharacters,
        attempts: trace.attempts,
        faults: trace.faults,
        citations: trace.citations,
        documentIds: trace.documentIds,
        provider: trace.provider,
        model: trace.model,
        fallback: trace.fallback,
        promptVersion: GROUNDED_PROMPT_VERSION,
        retrievalMs: trace.retrievalMs,
        generationMs: trace.generationMs,
        durationMs,
        ...(trace.preview ? { preview: true } : {}),
      },
      actorId: user.id,
    });
  }
}

/** A citation from the evidence the model was given: its provenance is retrieval's, never the model's. */
function citationOf(passage: PackedPassage): KnowledgeCitation {
  const result = passage.result;
  return {
    id: passage.id,
    chunkId: result.chunkId,
    sourceId: result.source.id,
    sourceName: result.source.name,
    documentId: result.document.id,
    versionId: result.version.id,
    title: result.document.title,
    heading: result.heading,
    position: result.position,
    courseId: result.source.courseId,
    lessonId: result.document.lessonId,
    similarity: result.similarity,
  };
}

/** An answer that declines, in the platform's own words. */
function declined(
  status: 'insufficient_evidence' | 'not_grounded',
  retrieval: KnowledgeRetrieval,
  trace: Trace,
): Omit<KnowledgeAnswer, 'usage'> {
  return {
    status,
    answer: status === 'not_grounded' ? ANSWER_WORDS.notGrounded : ANSWER_WORDS.insufficient,
    citations: [],
    context: retrieval.context,
    evidence: { retrieved: trace.retrieved, used: trace.used },
  };
}

/**
 * A provider's failure in the answer's own words: too slow (504), unreadable (502), or unavailable
 * (503). A client that went away is a cancellation, said to nobody.
 */
function failureOf(error: unknown, signal: AbortSignal, deadline: AbortSignal): unknown {
  if (signal.aborted) return new AiProviderError('cancelled');
  if (deadline.aborted) return new KnowledgeAnswerTimeoutError();
  if (error instanceof AiProviderError) {
    if (error.kind === 'cancelled') return error;
    if (error.kind === 'timeout') return new KnowledgeAnswerTimeoutError();
    if (error.kind === 'malformed' || error.kind === 'bad_request') {
      return new KnowledgeAnswerFailedError();
    }
    return new KnowledgeAnswerUnavailableError();
  }
  if (error instanceof AiUnavailableError) return new KnowledgeAnswerUnavailableError();
  return error;
}

/** What a reader of the stream is told about a failure: the platform's code and words only. */
function publicFailure(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) return { code: error.code, message: error.detail ?? error.title };
  return {
    code: AI_ERROR_CODES.UNAVAILABLE,
    message: 'SI Academy AI could not answer just now. Try again later.',
  };
}

/** The checked answer as events: its text, its sources, what to tell the reader, the usage, `done`. */
function writeAnswer(
  stream: AnswerStream<typeof knowledgeAnswerStreamEventSchemas>,
  answer: KnowledgeAnswer,
): void {
  if (answer.status === 'answered' || answer.status === 'conflicting') {
    for (const piece of answer.answer.match(/(?:\S+\s*){1,12}/g) ?? []) {
      stream.send('delta', { text: piece });
    }
    stream.send('sources', { citations: answer.citations });
  }
  if (answer.status !== 'answered') {
    stream.send('notice', {
      code:
        answer.status === 'conflicting'
          ? 'conflicting_evidence'
          : answer.status === 'not_grounded'
            ? 'not_grounded'
            : 'insufficient_evidence',
      message:
        answer.status === 'conflicting'
          ? ANSWER_WORDS.conflictAfter
          : answer.status === 'not_grounded'
            ? ANSWER_WORDS.notGrounded
            : ANSWER_WORDS.insufficient,
    });
  }
  if (answer.usage) stream.send('usage', answer.usage);
  stream.send('done', { status: answer.status });
  stream.end();
}
