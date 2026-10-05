import { z } from 'zod';
import {
  type AiChatRequest,
  type AiChatResult,
  type AiFailureDiagnostics,
  type AiFinishReason,
  type AiProviderFailure,
  AiProviderError,
  type AiUsage,
} from './ai-provider.js';
import { retryAfterSeconds } from './wire.js';

/**
 * Groq's chat-completion wire format — the OpenAI-compatible `POST /openai/v1/chat/completions`,
 * whole and streamed — as Groq's API reference and error guide describe it (read on 5 October 2026;
 * ADR-0038). It stays in this folder: everything outside it sees SI Academy's own types (ADR-0024).
 */

/** What SI Academy sends: the turns as they are, one choice, and the bounds the router set. */
export interface GroqRequest {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  n: 1;
  max_completion_tokens?: number;
  temperature?: number;
  stream?: true;
  /** The token counts, in the stream's last event. */
  stream_options?: { include_usage: true };
}

const usageSchema = z.looseObject({
  prompt_tokens: z.number().optional(),
  completion_tokens: z.number().optional(),
});
type GroqUsage = z.infer<typeof usageSchema>;

/** The provider's error: only its type and code are ever read, never its message. */
const errorSchema = z.looseObject({
  type: z.string().optional(),
  code: z.union([z.string(), z.number()]).nullable().optional(),
});

/**
 * A response, or one event of a stream. Loose — the provider adds fields over time — but every
 * field read here must have the type the contract gives it, or the answer counts as unreadable.
 */
const responseSchema = z.looseObject({
  choices: z
    .array(
      z.looseObject({
        message: z.looseObject({ content: z.string().nullable().optional() }).optional(),
        delta: z.looseObject({ content: z.string().nullable().optional() }).optional(),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .optional(),
  usage: usageSchema.nullable().optional(),
  /** Where Groq has also put a stream's token counts. */
  x_groq: z.looseObject({ usage: usageSchema.nullable().optional() }).nullable().optional(),
  /** A failure inside a stream arrives as an event of its own. */
  error: errorSchema.optional(),
});
export type GroqResponse = z.infer<typeof responseSchema>;

/** SI Academy's request in Groq's terms. Throws `bad_request` before any call when there is no question. */
export function toGroqRequest(request: AiChatRequest, model: string, stream: boolean): GroqRequest {
  const messages = request.messages
    .filter((message) => message.role !== 'system' || message.content.trim() !== '')
    .map((message) => ({ role: message.role, content: message.content }));
  if (!messages.some((message) => message.role === 'user')) {
    throw new AiProviderError('bad_request', { reason: 'NO_QUESTION' });
  }
  return {
    model,
    messages,
    n: 1,
    ...(request.maxOutputTokens ? { max_completion_tokens: request.maxOutputTokens } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(stream ? ({ stream: true, stream_options: { include_usage: true } } as const) : {}),
  };
}

/** A response or stream event, checked against the contract; unreadable is `malformed`. */
export function readGroqResponse(json: unknown): GroqResponse {
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) throw new AiProviderError('malformed', { reason: 'UNEXPECTED_SHAPE' });
  return parsed.data;
}

/** Groq's finish reason in SI Academy's terms; anything unrecognised is `other`. */
export function finishReasonOf(raw: string | null | undefined): AiFinishReason {
  if (raw === 'stop') return 'stop';
  if (raw === 'length') return 'length';
  if (raw === 'content_filter') return 'blocked';
  return 'other';
}

/** Generation failed part-way, by the provider's own account: its failure, not this request's. */
const GENERATION_ERROR = 'error';

const tokens = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;

/**
 * Token counts as the provider reports them (a reasoning model's reasoning is counted in the
 * completion, as it is billed). Without a report, an estimate of about four characters a token,
 * marked as one.
 */
function usageOf(reported: GroqUsage | undefined, request: AiChatRequest, answer: string): AiUsage {
  if (reported?.prompt_tokens === undefined) {
    const characters = request.messages.reduce((total, m) => total + m.content.length, 0);
    return {
      inputTokens: Math.ceil(characters / 4),
      outputTokens: Math.ceil(answer.length / 4),
      estimated: true,
    };
  }
  return {
    inputTokens: tokens(reported.prompt_tokens),
    outputTokens: tokens(reported.completion_tokens),
  };
}

/** A whole (not streamed) response as SI Academy's result. */
export function resultOf(
  response: GroqResponse,
  request: AiChatRequest,
  model: string,
): AiChatResult {
  if (response.error) throw groqFailure(undefined, { error: response.error });
  const choice = response.choices?.[0];
  if (!choice) throw new AiProviderError('malformed', { reason: 'NO_CHOICE' });
  if (choice.finish_reason === GENERATION_ERROR) {
    throw new AiProviderError('unavailable', { reason: 'GENERATION_ERROR' });
  }
  const text = choice.message?.content ?? '';
  return {
    text,
    model,
    finishReason: finishReasonOf(choice.finish_reason),
    usage: usageOf(response.usage ?? undefined, request, text),
  };
}

/** A streamed answer as it builds up; the counts come with the last events. */
export class GroqStreamState {
  text = '';
  private finish: string | undefined;
  private usage: GroqUsage | undefined;

  /** Takes one event; returns its new text (possibly empty). */
  take(event: GroqResponse): string {
    if (event.error) throw groqFailure(undefined, { error: event.error });
    const usage = event.usage ?? event.x_groq?.usage;
    if (usage) this.usage = usage;
    const choice = event.choices?.[0];
    if (!choice) return '';
    if (choice.finish_reason === GENERATION_ERROR) {
      throw new AiProviderError('unavailable', { reason: 'GENERATION_ERROR' });
    }
    if (choice.finish_reason) this.finish = choice.finish_reason;
    const piece = choice.delta?.content ?? '';
    this.text += piece;
    return piece;
  }

  /** The result once the stream has ended; a stream that stopped without a reason was cut short. */
  result(request: AiChatRequest, model: string): AiChatResult {
    if (this.finish === undefined) {
      throw new AiProviderError('malformed', { reason: 'STREAM_CUT_SHORT' });
    }
    return {
      text: this.text,
      model,
      finishReason: finishReasonOf(this.finish),
      usage: usageOf(this.usage, request, this.text),
    };
  }
}

const enumValue = (value: unknown, pattern: RegExp) =>
  typeof value === 'string' && pattern.test(value) ? value : undefined;

/** Codes that say the model, or the account's access to it, is not set up for the call. */
const CONFIGURATION_CODES = new Set([
  'MODEL_NOT_FOUND',
  'MODEL_DECOMMISSIONED',
  'MODEL_NOT_ACTIVE',
  'MODEL_TERMS_REQUIRED',
  'MODEL_PERMISSION_BLOCKED_PROJECT',
  'MODEL_PERMISSION_BLOCKED_ORG',
  'ORGANIZATION_RESTRICTED',
]);

/**
 * A failed call in SI Academy's terms (ADR-0038). Only the HTTP status, the error's type and code,
 * and the `retry-after` header are read — never the provider's message, which may quote the
 * request. Groq's own statuses: 498 (its flex tier at capacity) is a limit like 429; 499 is a
 * cancellation; every 5xx is the provider being unavailable.
 */
export function groqFailure(
  httpStatus: number | undefined,
  body: unknown,
  retryAfterHeader?: string | null,
): AiProviderError {
  const parsed = z.object({ error: errorSchema }).safeParse(body);
  const error = parsed.success ? parsed.data.error : undefined;
  const type = enumValue(error?.type, /^[a-z][a-z_]{1,40}$/)?.toUpperCase();
  const code = enumValue(error?.code, /^[a-z][a-z0-9_]{1,63}$/)?.toUpperCase();
  const retry = retryAfterSeconds(retryAfterHeader);
  const diagnostics: AiFailureDiagnostics = {};
  if (httpStatus !== undefined) diagnostics.httpStatus = httpStatus;
  if (type) diagnostics.providerStatus = type;
  if (code) diagnostics.reason = code;
  if (retry !== undefined) diagnostics.retryAfterSeconds = retry;
  return new AiProviderError(classify(httpStatus, code), diagnostics);
}

function classify(status: number | undefined, code: string | undefined): AiProviderFailure {
  if (status === 401 || status === 403 || code === 'INVALID_API_KEY') return 'auth';
  if (status === 429 || status === 498 || code === 'RATE_LIMIT_EXCEEDED') return 'rate_limited';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 404 || (code !== undefined && CONFIGURATION_CODES.has(code))) {
    return 'configuration';
  }
  if (status === 499) return 'cancelled';
  if (status === undefined || status >= 500) return 'unavailable';
  return 'bad_request';
}
