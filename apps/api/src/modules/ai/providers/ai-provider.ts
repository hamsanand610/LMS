import {
  AI_ERROR_CODES,
  type AiProviderCapabilities,
  type AiProviderName,
  type AiTask,
} from '@lms/shared';
import { AppError } from '../../../core/http/errors.js';

/** Injection token for the provider this build runs (ADR-0024), chosen by `AI_PROVIDER`. */
export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  task: AiTask;
  messages: readonly AiChatMessage[];
  /** A model the registry lists for this provider; the router always names one. Empty: `AI_MODEL`. */
  model?: string;
  /** At most this many output tokens, a thinking model's reasoning included. */
  maxOutputTokens?: number;
}

export interface AiUsage {
  inputTokens: number;
  /** Output tokens; a thinking model's reasoning tokens are included, as they are billed as output. */
  outputTokens: number;
  /** Set when the provider reported no counts and these are estimates (about four characters a token). */
  estimated?: boolean;
}

/**
 * Why a model stopped (Phase 7B): it finished (`stop`), reached the output limit (`length`), its
 * provider's safety filters withheld the question or the answer (`blocked`), or anything else
 * (`other`). A provider's own reasons are mapped to these and go no further.
 */
export const AI_FINISH_REASONS = ['stop', 'length', 'blocked', 'other'] as const;
export type AiFinishReason = (typeof AI_FINISH_REASONS)[number];

export interface AiChatResult {
  text: string;
  model: string;
  finishReason: AiFinishReason;
  usage: AiUsage;
}

/** A streamed answer: text as it is written, then the whole result once. */
export type AiChatDelta = { type: 'text'; text: string } | { type: 'done'; result: AiChatResult };

export interface AiEmbedRequest {
  texts: readonly string[];
  model?: string;
}

export interface AiEmbedResult {
  vectors: number[][];
  model: string;
}

/**
 * A model provider (ADR-0024). Every model call in the platform goes through one, and through the
 * model router (Phase 7B); feature code never names a vendor, a URL or a model.
 *
 * Rules every implementation keeps:
 * - its key comes from configuration and appears in no URL, error, log line or result;
 * - it turns its provider's failures into an `AiProviderError`, carrying none of the provider's own
 *   message, body or headers;
 * - it honours the AbortSignal, and does not retry on its own (retries and fallbacks belong to the
 *   router);
 * - it reaches its own provider's configured address and nothing else — no database, repository,
 *   shell or arbitrary URL (ADR-0031);
 * - it is called only after the policy has allowed the call and the usage can be accounted for
 *   (ADR-0029; from Phase 7C).
 */
export interface AiProvider {
  readonly name: AiProviderName;
  capabilities(): AiProviderCapabilities;
  chat(request: AiChatRequest, signal: AbortSignal): Promise<AiChatResult>;
  stream(request: AiChatRequest, signal: AbortSignal): AsyncIterable<AiChatDelta>;
  /** Reserved for Phase 8 (ADR-0027): every Phase 7 provider refuses it. */
  embed(request: AiEmbedRequest, signal: AbortSignal): Promise<AiEmbedResult>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}

/** The AI cannot answer: no provider, or a capability this build does not offer. */
export class AiUnavailableError extends AppError {
  constructor(detail = 'SI Academy AI is not available yet.') {
    super(503, AI_ERROR_CODES.UNAVAILABLE, 'AI unavailable', detail);
  }
}

/**
 * Why a provider call failed, in SI Academy's words (Phase 7B):
 * - `auth`: the provider refused the key or the account;
 * - `configuration`: the model, billing or region is not set up for the call;
 * - `rate_limited`: the provider's own limits;
 * - `unavailable`: the provider failed or could not be reached;
 * - `timeout`: the call took longer than the gateway waits;
 * - `cancelled`: the caller went away;
 * - `bad_request`: the provider refused the request as invalid;
 * - `malformed`: the provider answered with something unreadable;
 * - `circuit_open`: the gateway is resting the model after repeated failures.
 */
export const AI_PROVIDER_FAILURES = [
  'auth',
  'configuration',
  'rate_limited',
  'unavailable',
  'timeout',
  'cancelled',
  'bad_request',
  'malformed',
  'circuit_open',
] as const;
export type AiProviderFailure = (typeof AI_PROVIDER_FAILURES)[number];

interface FailureRule {
  status: number;
  code: string;
  title: string;
  detail: string;
  /** A failure of the model service: repeated, it rests the model (the circuit opens). */
  countsAgainstModel: boolean;
  /** Another model of the same provider may answer instead. */
  fallback: boolean;
}

const UNAVAILABLE_DETAIL = 'SI Academy AI could not answer just now. Try again later.';

const FAILURE_RULES: Record<AiProviderFailure, FailureRule> = {
  auth: {
    status: 503,
    code: AI_ERROR_CODES.UNAVAILABLE,
    title: 'AI unavailable',
    detail: UNAVAILABLE_DETAIL,
    countsAgainstModel: true,
    fallback: false,
  },
  configuration: {
    status: 503,
    code: AI_ERROR_CODES.UNAVAILABLE,
    title: 'AI unavailable',
    detail: UNAVAILABLE_DETAIL,
    countsAgainstModel: true,
    fallback: false,
  },
  rate_limited: {
    status: 503,
    code: AI_ERROR_CODES.BUSY,
    title: 'AI busy',
    detail: 'SI Academy AI is busy. Try again in a minute.',
    countsAgainstModel: true,
    fallback: true,
  },
  unavailable: {
    status: 503,
    code: AI_ERROR_CODES.UNAVAILABLE,
    title: 'AI unavailable',
    detail: UNAVAILABLE_DETAIL,
    countsAgainstModel: true,
    fallback: true,
  },
  timeout: {
    status: 504,
    code: AI_ERROR_CODES.TIMEOUT,
    title: 'AI timeout',
    detail: 'SI Academy AI took too long to answer. Try again.',
    countsAgainstModel: true,
    fallback: false,
  },
  cancelled: {
    status: 503,
    code: AI_ERROR_CODES.UNAVAILABLE,
    title: 'AI unavailable',
    detail: 'The request was cancelled.',
    countsAgainstModel: false,
    fallback: false,
  },
  bad_request: {
    status: 502,
    code: AI_ERROR_CODES.UNAVAILABLE,
    title: 'AI unavailable',
    detail: 'SI Academy AI could not take this request.',
    countsAgainstModel: false,
    fallback: false,
  },
  malformed: {
    status: 502,
    code: AI_ERROR_CODES.UNAVAILABLE,
    title: 'AI unavailable',
    detail: UNAVAILABLE_DETAIL,
    countsAgainstModel: true,
    fallback: false,
  },
  circuit_open: {
    status: 503,
    code: AI_ERROR_CODES.BUSY,
    title: 'AI busy',
    detail: 'SI Academy AI is busy. Try again in a minute.',
    countsAgainstModel: false,
    fallback: true,
  },
};

/**
 * What the log may say about a failed call: the provider's status and reason codes, never its
 * message (which may quote the request).
 */
export interface AiFailureDiagnostics {
  httpStatus?: number;
  /** The provider's status name, such as `RESOURCE_EXHAUSTED`. */
  providerStatus?: string;
  /** The provider's or the gateway's reason code, such as `API_KEY_INVALID`. */
  reason?: string;
  /** The provider's suggested wait. */
  retryAfterSeconds?: number;
  /** The error's type for failures without a response, such as `TypeError` or `ECONNREFUSED`. */
  errorName?: string;
}

/** Which provider and model a failure belongs to, once the router knows (ADR-0029). */
export interface AiCallTarget {
  provider: AiProviderName;
  model: string;
}

/**
 * A provider call failed (Phase 7B). The problem response says only what the person may act on —
 * unavailable, busy, too slow — in the platform's own words; `kind`, `diagnostics` and `target` are
 * for the router and the log, and the problem filter never sends them.
 */
export class AiProviderError extends AppError {
  constructor(
    readonly kind: AiProviderFailure,
    readonly diagnostics: AiFailureDiagnostics = {},
    readonly target?: AiCallTarget,
  ) {
    const rule = FAILURE_RULES[kind];
    super(rule.status, rule.code, rule.title, rule.detail);
    this.name = 'AiProviderError';
  }

  /** Whether the failure is the model service's, and repeated, should rest the model. */
  get countsAgainstModel(): boolean {
    return FAILURE_RULES[this.kind].countsAgainstModel;
  }

  /** Whether another model of the same provider may answer instead. */
  get fallbackAllowed(): boolean {
    return FAILURE_RULES[this.kind].fallback;
  }

  /** The same failure, attributed to the provider and model that had it. */
  withTarget(target: AiCallTarget): AiProviderError {
    return new AiProviderError(this.kind, this.diagnostics, target);
  }
}

/** Whether an abort was the deadline's (`AbortSignal.timeout`) rather than the caller's. */
export function isTimeoutReason(reason: unknown): boolean {
  return (
    typeof reason === 'object' &&
    reason !== null &&
    (reason as { name?: unknown }).name === 'TimeoutError'
  );
}

/**
 * Any failure of a provider call as an `AiProviderError`: an abort is a timeout or a cancellation;
 * anything else unexpected is the provider being unavailable, named by its type only.
 */
export function asProviderError(error: unknown, signal: AbortSignal): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (signal.aborted) {
    return new AiProviderError(isTimeoutReason(signal.reason) ? 'timeout' : 'cancelled');
  }
  return new AiProviderError('unavailable', { errorName: errorNameOf(error) });
}

/** An error's type, or its network code, for the log: never its message. */
export function errorNameOf(error: unknown): string {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  if (typeof cause?.code === 'string' && /^[A-Z][A-Z0-9_]{1,40}$/.test(cause.code)) {
    return cause.code;
  }
  return error instanceof Error ? error.name : typeof error;
}
