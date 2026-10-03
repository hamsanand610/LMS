import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AiDataClass, AiFeature, AiProviderName, AiServiceState, AiTask } from '@lms/shared';
import { APP_CONFIG, type AppConfig } from '../../../core/config/env.js';
import {
  AI_PROVIDER,
  type AiChatMessage,
  type AiChatRequest,
  type AiChatResult,
  type AiProvider,
  AiProviderError,
  type AiProviderFailure,
  AiUnavailableError,
  type AiUsage,
  asProviderError,
} from '../providers/ai-provider.js';
import { estimateCostUsd } from '../usage/cost.js';
import { AiCircuitBreakers, type CircuitBreaker } from './circuit-breaker.js';
import { AI_MODELS, type AiModelSpec, type AiRouting, resolveRouting } from './model-registry.js';

/** Who a call is for and what it carries (ADR-0024, ADR-0029): checked and recorded with it. */
export interface AiRouteRequest {
  task: AiTask;
  feature: AiFeature;
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
  /** Told of every call made to a provider for this request, in order (Phase 7C). */
  onAttempt?: (attempt: AiAttempt) => void;
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
 *   one configured provider. It must handle the task, stream when asked to, and be approved for the
 *   call's data class — the model's own limit and the deployment's AI_DATA_CLASSES; `restricted`
 *   data is never sent anywhere. What no model may take is refused before any call.
 * - **Fallback**: only AI_FALLBACK_MODEL, of the same provider, and only when the task's model is
 *   overloaded or resting, before any of the answer was written. There is no other provider to
 *   switch to: the process builds only the configured one, and never the fake outside local.
 * - **Circuits**: each model rests after repeated failures of the model service
 *   (`AiCircuitBreakers`), then one probe call tests it.
 * - **Deadline**: every call, streaming included, ends after AI_TIMEOUT_MS or when the caller
 *   aborts, whichever comes first.
 * - **Record**: each call is logged with provider, model, task, feature, data class, person,
 *   organisation, outcome, latency and tokens (ADR-0028) — never the prompt or the answer.
 */
@Injectable()
export class ModelRouter {
  private readonly logger = new Logger(ModelRouter.name);
  private readonly routing: AiRouting;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    @Inject(AI_MODELS) registry: readonly AiModelSpec[],
    private readonly circuits: AiCircuitBreakers,
  ) {
    const { routing, problems } = resolveRouting(config, registry);
    if (provider.name !== config.AI_PROVIDER) {
      problems.push(
        `the provider built (${provider.name}) is not AI_PROVIDER (${config.AI_PROVIDER})`,
      );
    }
    if (problems.length > 0) {
      throw new Error(
        `SI Academy AI is not configured correctly:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
      );
    }
    this.routing = routing;
  }

  /** Whether a model service is configured at all; never which one. */
  get configured(): boolean {
    return this.routing.main !== null;
  }

  /** How the model service is doing, in four words (Phase 7B). */
  serviceState(): AiServiceState {
    const { main, fallback } = this.routing;
    if (!main) return 'off';
    if (this.circuits.state(this.provider.name, main.id) === 'closed') return 'ready';
    if (fallback && this.circuits.state(this.provider.name, fallback.id) === 'closed') {
      return 'degraded';
    }
    return 'unavailable';
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
    const deadline = AbortSignal.timeout(this.routing.timeoutMs);
    const callSignal = AbortSignal.any([signal, deadline]);
    let failure: AiProviderError | undefined;
    for (const [index, model] of candidates.entries()) {
      const circuit = this.circuits.circuitOf(this.provider.name, model.id);
      if (!circuit.tryAcquire()) {
        failure = this.resting(request, model, index > 0);
        continue;
      }
      const started = performance.now();
      try {
        const result = await this.provider.chat(this.providerRequest(request, model), callSignal);
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
    const deadline = AbortSignal.timeout(this.routing.timeoutMs);
    const callSignal = AbortSignal.any([signal, deadline]);
    let failure: AiProviderError | undefined;
    for (const [index, model] of candidates.entries()) {
      const circuit = this.circuits.circuitOf(this.provider.name, model.id);
      if (!circuit.tryAcquire()) {
        failure = this.resting(request, model, index > 0);
        continue;
      }
      const started = performance.now();
      let wrote = false;
      let settled = false;
      try {
        for await (const delta of this.provider.stream(
          this.providerRequest(request, model),
          callSignal,
        )) {
          if (delta.type === 'text') {
            wrote = true;
            yield delta;
            continue;
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
      provider: this.provider.name,
      fallback,
      latencyMs: elapsed(started),
      estimatedCostUsd: estimateCostUsd(result.usage, this.routing.costs.get(model.id)),
    };
  }

  /** The configured price of a model, for estimates made outside a completed call. */
  costOf(model: string) {
    return this.routing.costs.get(model) ?? null;
  }

  /** Tells the caller of a call made to the provider (the usage ledger, Phase 7C). */
  private attempted(
    request: AiRoutedChatRequest,
    model: AiModelSpec,
    fallback: boolean,
    latencyMs: number,
    outcome: AiRoutedResult | AiProviderError,
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
    model: AiModelSpec,
  ): AiProviderError {
    const failure = caller.aborted
      ? new AiProviderError('cancelled')
      : deadline.aborted
        ? new AiProviderError('timeout', { reason: 'GATEWAY_DEADLINE' })
        : asProviderError(error, caller);
    return failure.withTarget(this.target(model));
  }

  /** The model is resting: no call is made. */
  private resting(request: AiRouteRequest, model: AiModelSpec, fallback: boolean): AiProviderError {
    const failure = new AiProviderError('circuit_open').withTarget(this.target(model));
    this.record(request, model, fallback, 0, failure);
    return failure;
  }

  private settle(circuit: CircuitBreaker, model: AiModelSpec, failure: AiProviderError | null) {
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
    request: AiRouteRequest,
    model: AiModelSpec,
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

  private attribution(request: AiRouteRequest) {
    return {
      task: request.task,
      feature: request.feature,
      dataClass: request.dataClass,
      userId: request.userId,
      organizationId: request.organizationId,
    };
  }

  private target(model: AiModelSpec) {
    return { provider: this.provider.name, model: model.id };
  }
}

function elapsed(started: number): number {
  return Math.round(performance.now() - started);
}
