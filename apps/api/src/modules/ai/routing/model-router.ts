import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { AiDataClass, AiFeature, AiProviderName, AiServiceState, AiTask } from '@lms/shared';
import {
  APP_CONFIG,
  type AppConfig,
  type ApprovableAiDataClass,
} from '../../../core/config/env.js';
import {
  AI_FALLBACK_PROVIDER,
  AI_PROVIDER,
  type AiChatMessage,
  type AiChatRequest,
  type AiChatResult,
  type AiEmbedPurpose,
  type AiProvider,
  AiProviderError,
  type AiProviderFailure,
  AiUnavailableError,
  type AiUsage,
  asProviderError,
} from '../providers/ai-provider.js';
import { checkedVectors } from '../providers/vectors.js';
import { estimateCostUsd } from '../usage/cost.js';
import { AiCircuitBreakers, type CircuitBreaker } from './circuit-breaker.js';
import {
  AI_EMBEDDING_MODELS,
  AI_EMBEDDING_MODEL_REGISTRY,
  AI_MODELS,
  type AiEmbeddingModelSpec,
  type AiEmbeddingRouting,
  type AiInstituteRouting,
  type AiModelSpec,
  type AiRouting,
  resolveEmbeddingRouting,
  resolveRouting,
} from './model-registry.js';

/** Who a call is for and what it carries (ADR-0024, ADR-0029): checked and recorded with it. */
export interface AiRouteRequest {
  task: AiTask;
  /** The surface the call is for, or the knowledge base's grounded answers (Phase 8E). */
  feature: AiFeature | 'knowledge';
  /** The most sensitive data in the call, as the caller's policy classified it (Phase 7C). */
  dataClass: AiDataClass;
  userId: string;
  organizationId: string;
}

/**
 * One call made to a provider for a request (Phase 7C): what the usage ledger records. A model
 * that was resting, or a request refused before any call, makes no attempt.
 */
export interface AiAttempt {
  provider: AiProviderName;
  model: string;
  /** The fallback model answered (or failed) instead of the task's own. */
  fallback: boolean;
  outcome: 'ok' | AiProviderFailure;
  latencyMs: number;
  /** The provider's own counts; null when the call did not complete. */
  usage: AiUsage | null;
  estimatedCostUsd: number | null;
}

export interface AiRoutedChatRequest extends AiRouteRequest {
  messages: readonly AiChatMessage[];
  maxOutputTokens?: number;
  /** Passed to the provider as it is (Phase 8E). */
  temperature?: number;
  /** Told of every call made to a provider for this request, in order (Phase 7C). */
  onAttempt?: (attempt: AiAttempt) => void;
  /**
   * Awaited before a stand-in is tried for the task's own model (Phase 9B): a caller keeping a
   * budget — the learning agent's run — refuses the second call by throwing, and the error is the
   * request's. `chat` only.
   */
  beforeFallback?: () => Promise<void>;
}

/** Why the router would refuse a request before calling anything. */
export type AiRouteRefusal =
  | 'not_configured'
  | 'task_not_supported'
  | 'streaming_not_supported'
  | 'restricted_data'
  | 'data_class_not_approved';

/** A model's answer with what the usage ledger records (Phase 7C): provider, latency, cost. */
export interface AiRoutedResult extends AiChatResult {
  provider: AiProviderName;
  /** A fallback model answered: the task's own model was overloaded or resting. */
  fallback: boolean;
  latencyMs: number;
  /** From the configured prices (AI_MODEL_COSTS); null when the model has none (ADR-0029). */
  estimatedCostUsd: number | null;
}

/**
 * Texts to embed, and for whom (Phase 8C; ADR-0035): checked and recorded like any call. Knowledge
 * is embedded for the institute; the person who asked for it is who the usage ledger counts it for.
 */
export interface AiEmbedRouteRequest {
  feature: 'knowledge';
  /** The most sensitive data the texts carry: their knowledge source's (ADR-0033). */
  dataClass: AiDataClass;
  userId: string;
  organizationId: string;
  purpose: AiEmbedPurpose;
  /** At most the routing's batch size; each within the model's input limit. */
  texts: readonly string[];
  /** Told of the call made to the provider (the usage ledger). */
  onAttempt?: (attempt: AiAttempt) => void;
}

/** A batch's vectors with what the usage ledger records. */
export interface AiRoutedEmbedding {
  vectors: number[][];
  provider: AiProviderName;
  model: string;
  dimension: number;
  latencyMs: number;
  usage: AiUsage;
  estimatedCostUsd: number | null;
}

/** A model as the records name it: with its own provider (ADR-0038). */
type ModelRef = { id: string; provider: AiProviderName };

/** Who a call is for, as the log line and the ledger attribute it. */
interface AiCallAttribution {
  task: string;
  feature: string;
  dataClass: AiDataClass;
  userId: string;
  organizationId: string;
}

export type AiRoutedDelta =
  { type: 'text'; text: string } | { type: 'done'; result: AiRoutedResult };

/** About four characters a token: enough to refuse what cannot fit a model before sending it. */
const CHARACTERS_PER_TOKEN = 4;

const REFUSED_DETAIL = 'SI Academy AI cannot take this kind of request on this installation.';

/**
 * Chooses the model for every AI call and makes the call (Phase 7B; ADR-0024). Nothing else in the
 * platform reaches a provider.
 *
 * - **Route**: the task's model (AI_TASK_MODELS, else AI_MODEL), from the model registry, for the
 *   configured provider. It must handle the task, stream when asked to, and be approved for the
 *   call's data class — the model's own limit and the deployment's AI_DATA_CLASSES; `restricted`
 *   data is never sent anywhere. What no model may take is refused before any call.
 * - **Fallback**: only AI_FALLBACK_MODEL — another of the provider's own models, or the fallback
 *   provider's (AI_FALLBACK_PROVIDER, ADR-0038) — and only when the task's model failed for a reason
 *   that may pass (`AiProviderError.fallbackAllowed`) before any of the answer was written. It gets
 *   the same request, refused or not by the same rules: the stand-in never takes what its own
 *   approval does not cover, and is never asked twice. The process builds only the configured
 *   providers, and never the fake outside local.
 * - **Circuits**: each provider's model rests after repeated failures of its service
 *   (`AiCircuitBreakers`), then one probe call tests it: one provider's failures never rest the
 *   other's model.
 * - **Deadline**: every call to a model, streaming included, ends after AI_TIMEOUT_MS or when the
 *   caller aborts, whichever comes first; a stand-in has its own.
 * - **Record**: each call is logged with provider, model, task, feature, data class, person,
 *   organisation, outcome, latency and tokens (ADR-0028) — never the prompt or the answer.
 */
@Injectable()
export class ModelRouter {
  private readonly logger = new Logger(ModelRouter.name);
  /** The deployment's own routing, from its configuration alone: checked at start-up. */
  private readonly deployment: AiRouting;
  /** What routes now: the deployment's, with the institute's choices over it (Phase 7D). */
  private routing: AiRouting;
  private applied = '';
  /** How knowledge is embedded (Phase 8C): null when the provider cannot embed. */
  private readonly embedding: AiEmbeddingRouting | null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    @Inject(AI_MODELS) private readonly registry: readonly AiModelSpec[],
    private readonly circuits: AiCircuitBreakers,
    @Optional()
    @Inject(AI_EMBEDDING_MODELS)
    embeddingRegistry: readonly AiEmbeddingModelSpec[] = AI_EMBEDDING_MODEL_REGISTRY,
    @Optional()
    @Inject(AI_FALLBACK_PROVIDER)
    private readonly fallbackProvider: AiProvider | null = null,
  ) {
    const { routing, problems } = resolveRouting(config, registry, null, embeddingRegistry);
    const embedding = resolveEmbeddingRouting(config, embeddingRegistry);
    problems.push(...embedding.problems);
    // A provider that cannot embed leaves embeddings unavailable; it is no reason not to start.
    this.embedding = provider.capabilities().embeddings ? embedding.routing : null;
    if (provider.name !== config.AI_PROVIDER) {
      problems.push(
        `the provider built (${provider.name}) is not AI_PROVIDER (${config.AI_PROVIDER})`,
      );
    }
    const fallbackName = this.fallbackProvider?.name ?? 'none';
    if (fallbackName !== config.AI_FALLBACK_PROVIDER) {
      problems.push(
        `the fallback provider built (${fallbackName}) is not AI_FALLBACK_PROVIDER (${config.AI_FALLBACK_PROVIDER})`,
      );
    }
    if (problems.length > 0) {
      throw new Error(
        `SI Academy AI is not configured correctly:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
      );
    }
    this.deployment = routing;
    this.routing = routing;
  }

  /**
   * What is wrong with the institute's routing choices (Phase 7D), by the rules the deployment's
   * own configuration is checked by at start-up; empty when they can be routed.
   */
  checkInstituteRouting(institute: AiInstituteRouting): string[] {
    return resolveRouting(this.config, this.registry, institute).problems;
  }

  /**
   * Routes by the institute's choices from now on (Phase 7D), when they can be routed; otherwise
   * keeps the deployment's routing and says why. Choices are never half applied — with one
   * exception: a stand-in the institute saved before the deployment named a fallback provider is
   * set aside and reported (ADR-0038), so that naming one never drops the institute's other
   * choices, its narrowing of the data classes above all.
   */
  useInstituteRouting(institute: AiInstituteRouting | null): string[] {
    const fingerprint = JSON.stringify(institute);
    if (!institute) {
      this.routing = this.deployment;
      this.applied = fingerprint;
      return [];
    }
    const setAside: string[] = [];
    let choices = institute;
    if (institute.fallbackModel && !this.standInChoosable()) {
      setAside.push(
        `fallbackModel (AI settings) is set aside: the deployment's fallback provider stands in (AI_FALLBACK_PROVIDER=${this.config.AI_FALLBACK_PROVIDER}, AI_FALLBACK_MODEL)`,
      );
      choices = { ...institute, fallbackModel: null };
    }
    const { routing, problems } = resolveRouting(this.config, this.registry, choices);
    if (problems.length > 0) {
      if (this.applied !== fingerprint) {
        this.logger.warn(
          { ai: { problems } },
          'AI settings not applied: the deployment cannot route them',
        );
      }
      this.routing = this.deployment;
    } else {
      this.routing = routing;
    }
    this.applied = fingerprint;
    return [...setAside, ...problems];
  }

  /** Whether a model service is configured at all; never which one. */
  get configured(): boolean {
    return this.routing.main !== null;
  }

  /** The model a task goes to now, or null when none is configured (Phase 7D: the answer cache). */
  modelFor(task: AiTask): AiModelSpec | null {
    return this.routing.models[task] ?? null;
  }

  /** The models this installation can route to: the registry's, for the configured provider. */
  availableModels(): readonly AiModelSpec[] {
    return this.registry.filter((model) => model.provider === this.config.AI_PROVIDER);
  }

  /** The data classes approved now: the deployment's, narrowed by the institute's settings. */
  approvedDataClasses(): readonly ApprovableAiDataClass[] {
    return this.routing.approved;
  }

  /** The tasks' models and the fallback that route now, by code (the Super Admin's settings). */
  currentModels(): {
    main: string | null;
    tasks: Partial<Record<AiTask, string>>;
    fallback: string | null;
  } {
    const tasks: Partial<Record<AiTask, string>> = {};
    for (const [task, spec] of Object.entries(this.routing.models)) {
      if (spec) tasks[task as AiTask] = spec.id;
    }
    return {
      main: this.routing.main?.id ?? null,
      tasks,
      fallback: this.routing.fallback?.id ?? null,
    };
  }

  /**
   * How the model service is doing, in four words (Phase 7B). `unavailable` only while no model
   * could be called: a model whose rest is over is free for its one probe call, so the service
   * answers again. The gateway, grounded answers and the availability the browser reads all ask
   * this before any call, so a rested model they turned away was never probed, and never recovered
   * (found by the Gemini evaluation, 5 October 2026). While the probe is out, nothing else is sent.
   */
  serviceState(): AiServiceState {
    const { main, fallback } = this.routing;
    if (!main) return 'off';
    // Each model's circuit is its own provider's (ADR-0038).
    if (this.circuits.state(main.provider, main.id) === 'closed') return 'ready';
    if (fallback && this.circuits.state(fallback.provider, fallback.id) === 'closed') {
      return 'degraded';
    }
    if (this.circuits.admits(main.provider, main.id)) return 'ready';
    if (fallback && this.circuits.admits(fallback.provider, fallback.id)) return 'degraded';
    return 'unavailable';
  }

  /**
   * Whether the institute may choose the stand-in model (Phase 7D): not while the deployment names a
   * fallback provider, whose model the deployment alone chooses (ADR-0038).
   */
  standInChoosable(): boolean {
    return this.config.AI_FALLBACK_PROVIDER === 'none';
  }

  /**
   * The longest one call may take now (ADR-0038): each model tried has its own AI_TIMEOUT_MS, and a
   * stand-in may follow the task's model. What anything waiting on a call must allow for.
   */
  longestCallMs(): number {
    return this.routing.timeoutMs * (this.routing.fallback ? 2 : 1);
  }

  /**
   * Whether the router would refuse this request before calling anything, and why (Phase 7C): the
   * gateway asks first, so a refusal is answered plainly and nothing is written. The router still
   * refuses on its own when the call is made.
   */
  refusalFor(request: AiRouteRequest, streaming = false): AiRouteRefusal | null {
    const main = this.routing.models[request.task];
    if (!main) return 'not_configured';
    return this.refusal(main, request, streaming);
  }

  /**
   * The models that may serve a request, in the order they are tried: the task's own, then the
   * fallback when it may take the request too. Refuses — before any call — what the task's model
   * may not take.
   */
  plan(request: AiRouteRequest, streaming = false): AiModelSpec[] {
    const main = this.routing.models[request.task];
    if (!main) throw new AiUnavailableError();
    const refusal = this.refusal(main, request, streaming);
    if (refusal) {
      this.logger.warn(
        {
          ai: { ...this.attribution(request), model: main.id, outcome: 'refused', reason: refusal },
        },
        'AI call refused by the router',
      );
      throw new AiUnavailableError(REFUSED_DETAIL);
    }
    const fallback = this.routing.fallback;
    return fallback && fallback.id !== main.id && !this.refusal(fallback, request, streaming)
      ? [main, fallback]
      : [main];
  }

  /** One whole answer. */
  async chat(request: AiRoutedChatRequest, signal: AbortSignal): Promise<AiRoutedResult> {
    const candidates = this.plan(request);
    this.assertFits(candidates[0]!, request);
    let failure: AiProviderError | undefined;
    for (const [index, model] of candidates.entries()) {
      if (index > 0 && request.beforeFallback) await request.beforeFallback();
      const circuit = this.circuits.circuitOf(model.provider, model.id);
      if (!circuit.tryAcquire()) {
        failure = this.resting(request, model, index > 0);
        continue;
      }
      // Each model's own deadline: one that was too slow leaves its stand-in the whole of it.
      const deadline = AbortSignal.timeout(this.routing.timeoutMs);
      const callSignal = AbortSignal.any([signal, deadline]);
      const started = performance.now();
      try {
        const result = await this.providerFor(model).chat(
          this.providerRequest(request, model),
          callSignal,
        );
        const routed = this.routed(result, model, index > 0, started);
        this.settle(circuit, model, null);
        this.record(request, model, index > 0, routed.latencyMs, routed);
        this.attempted(request, model, index > 0, routed.latencyMs, routed);
        return routed;
      } catch (error) {
        failure = this.failureOf(error, signal, deadline, model);
        this.settle(circuit, model, failure);
        this.record(request, model, index > 0, elapsed(started), failure);
        this.attempted(request, model, index > 0, elapsed(started), failure);
        if (!failure.fallbackAllowed) throw failure;
      }
    }
    throw failure ?? new AiUnavailableError();
  }

  /**
   * An answer as it is written, then the whole result once. A fallback answers only if the task's
   * model failed before writing anything: an answer is never stitched from two models.
   */
  async *stream(request: AiRoutedChatRequest, signal: AbortSignal): AsyncGenerator<AiRoutedDelta> {
    const candidates = this.plan(request, true);
    this.assertFits(candidates[0]!, request);
    let failure: AiProviderError | undefined;
    for (const [index, model] of candidates.entries()) {
      const circuit = this.circuits.circuitOf(model.provider, model.id);
      if (!circuit.tryAcquire()) {
        failure = this.resting(request, model, index > 0);
        continue;
      }
      // Each model's own deadline: one that was too slow leaves its stand-in the whole of it.
      const deadline = AbortSignal.timeout(this.routing.timeoutMs);
      const callSignal = AbortSignal.any([signal, deadline]);
      const started = performance.now();
      let wrote = false;
      let settled = false;
      try {
        for await (const delta of this.providerFor(model).stream(
          this.providerRequest(request, model),
          callSignal,
        )) {
          if (delta.type === 'text') {
            wrote = true;
            yield delta;
            continue;
          }
          // A model that ends without a word, and was not withholding the answer, gave none: an
          // unreadable answer, never a complete empty one (Phase 7F).
          if (!delta.result.text.trim() && delta.result.finishReason !== 'blocked') {
            throw new AiProviderError('malformed', { reason: 'EMPTY_ANSWER' });
          }
          const routed = this.routed(delta.result, model, index > 0, started);
          settled = true;
          this.settle(circuit, model, null);
          this.record(request, model, index > 0, routed.latencyMs, routed);
          this.attempted(request, model, index > 0, routed.latencyMs, routed);
          yield { type: 'done', result: routed };
          return;
        }
        throw new AiProviderError('malformed', { reason: 'NO_RESULT' });
      } catch (error) {
        failure = this.failureOf(error, signal, deadline, model);
        settled = true;
        this.settle(circuit, model, failure);
        this.record(request, model, index > 0, elapsed(started), failure);
        this.attempted(request, model, index > 0, elapsed(started), failure);
        if (wrote || !failure.fallbackAllowed) throw failure;
      } finally {
        // The reader stopped early: no verdict on the model, and the probe slot frees.
        if (!settled) {
          circuit.released();
          const cancelled = new AiProviderError('cancelled').withTarget(this.target(model));
          this.record(request, model, index > 0, elapsed(started), cancelled);
          this.attempted(request, model, index > 0, elapsed(started), cancelled);
        }
      }
    }
    throw failure ?? new AiUnavailableError();
  }

  private refusal(
    model: AiModelSpec,
    request: AiRouteRequest,
    streaming: boolean,
  ): AiRouteRefusal | null {
    if (!model.tasks.includes(request.task)) return 'task_not_supported';
    if (streaming && !model.streaming) return 'streaming_not_supported';
    // Restricted data never leaves the platform (ADR-0024), and no model is approved for it.
    if (request.dataClass === 'restricted') return 'restricted_data';
    if (
      !model.dataClasses.includes(request.dataClass) ||
      !this.routing.approved.includes(request.dataClass)
    ) {
      return 'data_class_not_approved';
    }
    return null;
  }

  /** Refuses a request that cannot fit the model's input, before it is sent. */
  private assertFits(model: AiModelSpec, request: AiRoutedChatRequest): void {
    const characters = request.messages.reduce((total, m) => total + m.content.length, 0);
    if (Math.ceil(characters / CHARACTERS_PER_TOKEN) <= model.contextTokens) return;
    const failure = new AiProviderError('bad_request', { reason: 'CONTEXT_TOO_LARGE' }).withTarget(
      this.target(model),
    );
    this.record(request, model, false, 0, failure);
    throw failure;
  }

  private providerRequest(request: AiRoutedChatRequest, model: AiModelSpec): AiChatRequest {
    return {
      task: request.task,
      messages: request.messages,
      model: model.id,
      ...(request.maxOutputTokens
        ? { maxOutputTokens: Math.min(request.maxOutputTokens, model.outputTokens) }
        : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    };
  }

  private routed(
    result: AiChatResult,
    model: AiModelSpec,
    fallback: boolean,
    started: number,
  ): AiRoutedResult {
    return {
      ...result,
      model: model.id,
      provider: model.provider,
      fallback,
      latencyMs: elapsed(started),
      estimatedCostUsd: estimateCostUsd(result.usage, this.routing.costs.get(model.id)),
    };
  }

  /**
   * The provider a model belongs to: the configured one, or for the stand-in the fallback provider
   * (ADR-0038). Routing only ever names models of these two, so nothing else can be reached.
   */
  private providerFor(model: AiModelSpec): AiProvider {
    if (model.provider === this.provider.name) return this.provider;
    if (this.fallbackProvider && model.provider === this.fallbackProvider.name) {
      return this.fallbackProvider;
    }
    throw new AiUnavailableError();
  }

  /** How knowledge is embedded now (Phase 8C): the model, dimension and batch; null when it is not. */
  embeddingRouting(): AiEmbeddingRouting | null {
    return this.embedding;
  }

  /** Why an embedding of this data would be refused before any call, if it would. */
  embeddingRefusal(dataClass: AiDataClass): AiRouteRefusal | null {
    if (!this.embedding) return 'not_configured';
    // Restricted data never leaves the platform (ADR-0024).
    if (dataClass === 'restricted') return 'restricted_data';
    if (
      !this.embedding.model.dataClasses.includes(dataClass) ||
      !this.routing.approved.includes(dataClass)
    ) {
      return 'data_class_not_approved';
    }
    return null;
  }

  /**
   * One batch of texts embedded (Phase 8C; ADR-0035), on the rules every call keeps: refused before
   * any call when the data may not go to the provider, or the batch is too large; within the
   * deadline; through the model's circuit; logged and told to the ledger. The provider's vectors
   * are checked here once more — one per text, of the dimension, finite, at unit length — so no
   * provider can hand the platform a vector it would not keep.
   */
  async embed(request: AiEmbedRouteRequest, signal: AbortSignal): Promise<AiRoutedEmbedding> {
    const routing = this.embedding;
    if (!routing) throw new AiUnavailableError();
    const call: AiCallAttribution = { ...request, task: 'embed' };
    const refusal = this.embeddingRefusal(request.dataClass);
    if (refusal) {
      this.logger.warn(
        {
          ai: {
            ...this.attribution(call),
            model: routing.model.id,
            outcome: 'refused',
            reason: refusal,
          },
        },
        'AI call refused by the router',
      );
      throw new AiUnavailableError(REFUSED_DETAIL);
    }
    const model = routing.model;
    const tooLarge =
      request.texts.length === 0 ||
      request.texts.length > routing.batchSize ||
      request.texts.some(
        (text) => Math.ceil(text.length / CHARACTERS_PER_TOKEN) > model.inputTokens,
      );
    if (tooLarge) {
      const failure = new AiProviderError('bad_request', { reason: 'BATCH_TOO_LARGE' }).withTarget(
        this.target(model),
      );
      this.record(call, model, false, 0, failure);
      throw failure;
    }
    const circuit = this.circuits.circuitOf(model.provider, model.id);
    // A resting model makes no attempt: no call is made, and none is counted.
    if (!circuit.tryAcquire()) throw this.resting(call, model, false);
    const deadline = AbortSignal.timeout(this.routing.timeoutMs);
    const callSignal = AbortSignal.any([signal, deadline]);
    const started = performance.now();
    try {
      // The main provider alone embeds (ADR-0038): no stand-in, so the vectors stay one model's.
      const result = await this.provider.embed(
        {
          texts: request.texts,
          model: model.id,
          purpose: request.purpose,
          dimension: routing.dimension,
        },
        callSignal,
      );
      const vectors = checkedVectors(result.vectors, request.texts.length, routing.dimension);
      const usage: AiUsage = {
        inputTokens: result.usage.inputTokens,
        outputTokens: 0,
        ...(result.usage.estimated ? { estimated: true } : {}),
      };
      const embedded: AiRoutedEmbedding = {
        vectors,
        provider: model.provider,
        model: model.id,
        dimension: routing.dimension,
        latencyMs: elapsed(started),
        usage,
        estimatedCostUsd: estimateCostUsd(usage, this.routing.costs.get(model.id)),
      };
      this.settle(circuit, model, null);
      this.logger.log(
        {
          ai: {
            ...this.attribution(call),
            ...this.target(model),
            fallback: false,
            latencyMs: embedded.latencyMs,
            outcome: 'ok',
            texts: request.texts.length,
            dimension: routing.dimension,
            inputTokens: usage.inputTokens,
            tokensEstimated: usage.estimated === true,
            estimatedCostUsd: embedded.estimatedCostUsd,
          },
        },
        'AI call',
      );
      this.attempted(request, model, false, embedded.latencyMs, embedded);
      return embedded;
    } catch (error) {
      const failure = this.failureOf(error, signal, deadline, model);
      this.settle(circuit, model, failure);
      this.record(call, model, false, elapsed(started), failure);
      this.attempted(request, model, false, elapsed(started), failure);
      throw failure;
    }
  }

  /** The configured price of a model, for estimates made outside a completed call. */
  costOf(model: string) {
    return this.routing.costs.get(model) ?? null;
  }

  /** Models routed now that have no configured price (Phase 7D: a budget cannot count them). */
  unpricedModels(): string[] {
    const routed = new Set([
      ...Object.values(this.routing.models),
      ...(this.routing.fallback ? [this.routing.fallback] : []),
    ]);
    return [...routed]
      .filter((model): model is AiModelSpec => Boolean(model))
      .filter((model) => !this.routing.costs.has(model.id))
      .map((model) => model.id);
  }

  /** Tells the caller of a call made to the provider (the usage ledger, Phase 7C). */
  private attempted(
    request: { onAttempt?: (attempt: AiAttempt) => void },
    model: ModelRef,
    fallback: boolean,
    latencyMs: number,
    outcome: { usage: AiUsage; estimatedCostUsd: number | null } | AiProviderError,
  ): void {
    if (!request.onAttempt) return;
    const failed = outcome instanceof AiProviderError;
    request.onAttempt({
      ...this.target(model),
      fallback,
      outcome: failed ? outcome.kind : 'ok',
      latencyMs,
      usage: failed ? null : outcome.usage,
      estimatedCostUsd: failed ? null : outcome.estimatedCostUsd,
    });
  }

  /** The failure in SI Academy's terms. The caller's abort and the deadline are known here exactly. */
  private failureOf(
    error: unknown,
    caller: AbortSignal,
    deadline: AbortSignal,
    model: ModelRef,
  ): AiProviderError {
    const failure = caller.aborted
      ? new AiProviderError('cancelled')
      : deadline.aborted
        ? new AiProviderError('timeout', { reason: 'GATEWAY_DEADLINE' })
        : asProviderError(error, caller);
    return failure.withTarget(this.target(model));
  }

  /** The model is resting: no call is made. */
  private resting(request: AiCallAttribution, model: ModelRef, fallback: boolean): AiProviderError {
    const failure = new AiProviderError('circuit_open').withTarget(this.target(model));
    this.record(request, model, fallback, 0, failure);
    return failure;
  }

  private settle(circuit: CircuitBreaker, model: ModelRef, failure: AiProviderError | null) {
    const target = this.target(model);
    if (!failure) {
      if (circuit.succeeded()) this.logger.log({ ai: target }, 'AI model answering again');
      return;
    }
    if (!failure.countsAgainstModel) {
      circuit.released();
      return;
    }
    if (circuit.failed()) {
      this.logger.warn({ ai: target }, 'AI model resting after repeated failures');
    }
  }

  private record(
    request: AiCallAttribution,
    model: ModelRef,
    fallback: boolean,
    latencyMs: number,
    outcome: AiRoutedResult | AiProviderError,
  ): void {
    const call = { ...this.attribution(request), ...this.target(model), fallback, latencyMs };
    if (outcome instanceof AiProviderError) {
      const entry = { ai: { ...call, outcome: outcome.kind, ...outcome.diagnostics } };
      if (outcome.kind === 'cancelled') this.logger.log(entry, 'AI call cancelled');
      else this.logger.warn(entry, 'AI call failed');
      return;
    }
    this.logger.log(
      {
        ai: {
          ...call,
          outcome: 'ok',
          finishReason: outcome.finishReason,
          inputTokens: outcome.usage.inputTokens,
          outputTokens: outcome.usage.outputTokens,
          tokensEstimated: outcome.usage.estimated === true,
          estimatedCostUsd: outcome.estimatedCostUsd,
        },
      },
      'AI call',
    );
  }

  private attribution(request: AiCallAttribution) {
    return {
      task: request.task,
      feature: request.feature,
      dataClass: request.dataClass,
      userId: request.userId,
      organizationId: request.organizationId,
    };
  }

  private target(model: ModelRef) {
    return { provider: model.provider, model: model.id };
  }
}

function elapsed(started: number): number {
  return Math.round(performance.now() - started);
}
