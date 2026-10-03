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
  /** Empty: the configured default (`AI_MODEL`); per-task routing arrives in Phase 7B. */
  model?: string;
  maxOutputTokens?: number;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiChatResult {
  text: string;
  model: string;
  finishReason: 'stop' | 'length';
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
 * A model provider (ADR-0024). Every model call in the platform goes through one; feature code never
 * names a vendor, a URL or a model.
 *
 * Rules every implementation keeps:
 * - its key comes from configuration and appears in no error, log line or result;
 * - it honours the AbortSignal, and does not retry on its own (retries belong to the caller);
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
