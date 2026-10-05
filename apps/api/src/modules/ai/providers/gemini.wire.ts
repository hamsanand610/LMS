import { z } from 'zod';
import {
  type AiChatRequest,
  type AiChatResult,
  type AiEmbedRequest,
  type AiFailureDiagnostics,
  type AiFinishReason,
  type AiProviderFailure,
  AiProviderError,
  type AiUsage,
} from './ai-provider.js';
import { checkedVectors } from './vectors.js';

/**
 * The Gemini API's content-generation wire format — `models.generateContent` and
 * `models.streamGenerateContent` — as Google's discovery document for the Generative Language API
 * describes it (v1, revision 20261002, read on 3 October 2026). It stays in this folder: everything
 * outside it sees SI Academy's own types (ADR-0024).
 */

/** What SI Academy sends: text turns, an optional system instruction, one candidate, no logging. */
export interface GeminiRequest {
  contents: { role: 'user' | 'model'; parts: { text: string }[] }[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig: { candidateCount: 1; maxOutputTokens?: number; temperature?: number };
  /** Off: the provider keeps no log of the request. SI Academy keeps its own records (ADR-0028). */
  store: false;
}

const errorSchema = z
  .object({
    code: z.union([z.number(), z.string()]).optional(),
    status: z.string().optional(),
    details: z
      .array(z.looseObject({ reason: z.string().optional(), retryDelay: z.string().optional() }))
      .optional(),
  })
  .loose();

/**
 * A response, or one event of a stream. Loose — the provider adds fields over time — but every
 * field read here must have the type the contract gives it, or the answer counts as unreadable.
 */
const responseSchema = z.looseObject({
  candidates: z
    .array(
      z.looseObject({
        content: z
          .looseObject({
            parts: z
              .array(
                z.looseObject({ text: z.string().optional(), thought: z.boolean().optional() }),
              )
              .optional(),
          })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  promptFeedback: z.looseObject({ blockReason: z.string().optional() }).optional(),
  usageMetadata: z
    .looseObject({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
      thoughtsTokenCount: z.number().optional(),
      toolUsePromptTokenCount: z.number().optional(),
    })
    .optional(),
  modelStatus: z.looseObject({ modelStage: z.string().optional() }).optional(),
  /** A failure inside a stream arrives as an event of its own. */
  error: errorSchema.optional(),
});
export type GeminiResponse = z.infer<typeof responseSchema>;
type GeminiUsage = NonNullable<GeminiResponse['usageMetadata']>;

/**
 * Gemini's embedding wire format — `models.batchEmbedContents` — one request per text, each naming
 * the model and its text; the embeddings come back in the order asked, with the prompt's token
 * count. The task type and the output dimensionality are sent twice. At the top of each request,
 * where the live API honours them; and inside `embedContentConfig`, where the discovery document
 * (v1 and v1beta, revision 20261004) places them and marks the top-level fields deprecated. On 5
 * October 2026 both versions ignored that object entirely: a 768 dimension came back as 3,072
 * values, and a document and a question embedded alike. With the top-level fields: 768 values, and
 * different vectors for each task (Phase 8F external verification; ADR-0035).
 */
export interface GeminiEmbedRequest {
  requests: {
    model: string;
    content: { parts: { text: string }[] };
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';
    outputDimensionality: number;
    embedContentConfig: {
      taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';
      outputDimensionality: number;
      autoTruncate: false;
    };
  }[];
}

/** Texts to embed in Gemini's terms (Phase 8C; the top-level fields since the external verification). */
export function toGeminiEmbedRequest(request: AiEmbedRequest, model: string): GeminiEmbedRequest {
  const taskType = request.purpose === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT';
  return {
    requests: request.texts.map((text) => ({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: request.dimension,
      embedContentConfig: {
        taskType,
        outputDimensionality: request.dimension,
        autoTruncate: false,
      },
    })),
  };
}

/**
 * Embedding models whose reduced outputs are their full output's first values (Matryoshka), with
 * that full size. Gemini documents a reduced dimension as the full embedding "truncated from the
 * end", and a full-size `gemini-embedding-001` vector cut to 768 values and renormalised is the
 * vector a 768-value request returns (measured on 5 October 2026: cosine 1.000000). A vector of
 * exactly that full size, when fewer values were asked for, is therefore cut to the size asked;
 * any other length is refused.
 */
const FULL_DIMENSION: Readonly<Record<string, number>> = { 'gemini-embedding-001': 3072 };

/** A full-size vector cut to the dimension asked; anything else as it came, for the checks to judge. */
function reducedToDimension(values: unknown, model: string, dimension: number): unknown {
  const full = FULL_DIMENSION[model];
  return Array.isArray(values) && full !== undefined && dimension < full && values.length === full
    ? values.slice(0, dimension)
    : values;
}

const embedResponseSchema = z.looseObject({
  embeddings: z.array(z.looseObject({ values: z.array(z.unknown()).optional() })).optional(),
  usageMetadata: z.looseObject({ promptTokenCount: z.number().optional() }).optional(),
});

/**
 * A batch's vectors, checked before anything keeps them: one per text, of the dimension asked (a
 * full-size vector of a Matryoshka model cut to it first; a shorter one, or any other length, is
 * refused), every value a finite number, each scaled to unit length (`gemini-embedding-001` leaves
 * a reduced dimension unnormalised, and a cut vector must be renormalised). With the prompt's token
 * count, when Gemini reports one.
 */
export function readGeminiEmbeddings(
  json: unknown,
  request: AiEmbedRequest,
): { vectors: number[][]; inputTokens: number | undefined } {
  const parsed = embedResponseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.embeddings) {
    throw new AiProviderError('malformed', { reason: 'NOT_EMBEDDINGS' });
  }
  const vectors = checkedVectors(
    parsed.data.embeddings.map((embedding) =>
      reducedToDimension(embedding.values, request.model, request.dimension),
    ),
    request.texts.length,
    request.dimension,
  );
  const count = parsed.data.usageMetadata?.promptTokenCount;
  return { vectors, inputTokens: Number.isInteger(count) && count! >= 0 ? count : undefined };
}

/** SI Academy's request in Gemini's terms. Throws `bad_request` before any call when there is no question. */
export function toGeminiRequest(request: AiChatRequest): GeminiRequest {
  const system: { text: string }[] = [];
  const contents: GeminiRequest['contents'] = [];
  for (const message of request.messages) {
    if (message.role === 'system') {
      if (message.content.trim() !== '') system.push({ text: message.content });
      continue;
    }
    const role = message.role === 'assistant' ? 'model' : 'user';
    const last = contents.at(-1);
    // One turn per author in a row: consecutive messages of one author become one turn's parts.
    if (last?.role === role) last.parts.push({ text: message.content });
    else contents.push({ role, parts: [{ text: message.content }] });
  }
  if (!contents.some((turn) => turn.role === 'user')) {
    throw new AiProviderError('bad_request', { reason: 'NO_QUESTION' });
  }
  return {
    contents,
    ...(system.length > 0 ? { systemInstruction: { parts: system } } : {}),
    generationConfig: {
      candidateCount: 1,
      ...(request.maxOutputTokens ? { maxOutputTokens: request.maxOutputTokens } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    },
    store: false,
  };
}

/** A response or stream event, checked against the contract; unreadable is `malformed`. */
export function readGeminiResponse(json: unknown): GeminiResponse {
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) throw new AiProviderError('malformed', { reason: 'UNEXPECTED_SHAPE' });
  return parsed.data;
}

// The readers every HTTP adapter shares, where the Gemini adapter has always found them.
export { parseJson, sseData } from './wire.js';

/** Gemini's finish reasons whose answer its safety and policy filters withheld. */
const BLOCKED_FINISH_REASONS = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_RECITATION',
  'ESCALATION',
]);

/**
 * The account itself is barred under the provider's Prohibited Use Policy: every call would end the
 * same way, so it is the key's failure, not this request's.
 */
const ACCOUNT_BARRED = 'PUP_LIMITED_DISABLED';

/** Gemini's finish reason in SI Academy's terms; anything unrecognised is `other`. */
export function finishReasonOf(raw: string | undefined): AiFinishReason {
  if (raw === 'STOP') return 'stop';
  if (raw === 'MAX_TOKENS') return 'length';
  if (raw !== undefined && BLOCKED_FINISH_REASONS.has(raw)) return 'blocked';
  return 'other';
}

/** The answer's text: the first candidate's text parts, the model's reasoning left out. */
export function answerTextOf(response: GeminiResponse): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => typeof part.text === 'string' && part.thought !== true)
    .map((part) => part.text)
    .join('');
}

const tokens = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;

/**
 * Token counts as the provider reports them: thinking tokens are billed as output, and are counted
 * there. Without a report, an estimate of about four characters a token, marked as one.
 */
export function usageOf(
  reported: GeminiUsage | undefined,
  request: AiChatRequest,
  answer: string,
): AiUsage {
  if (reported?.promptTokenCount === undefined) {
    const characters = request.messages.reduce((total, m) => total + m.content.length, 0);
    return {
      inputTokens: Math.ceil(characters / 4),
      outputTokens: Math.ceil(answer.length / 4),
      estimated: true,
    };
  }
  return {
    inputTokens: tokens(reported.promptTokenCount) + tokens(reported.toolUsePromptTokenCount),
    outputTokens: tokens(reported.candidatesTokenCount) + tokens(reported.thoughtsTokenCount),
  };
}

/** A whole (not streamed) response as SI Academy's result. */
export function resultOf(
  response: GeminiResponse,
  request: AiChatRequest,
  model: string,
): AiChatResult {
  if (response.error) throw geminiFailure(undefined, { error: response.error });
  const blocked = response.promptFeedback?.blockReason !== undefined;
  const candidate = response.candidates?.[0];
  if (!blocked && !candidate) throw new AiProviderError('malformed', { reason: 'NO_CANDIDATE' });
  if (candidate?.finishReason === ACCOUNT_BARRED) {
    throw new AiProviderError('auth', { reason: ACCOUNT_BARRED });
  }
  const text = blocked ? '' : answerTextOf(response);
  return {
    text,
    model,
    finishReason: blocked ? 'blocked' : finishReasonOf(candidate?.finishReason),
    usage: usageOf(response.usageMetadata, request, text),
  };
}

/**
 * A streamed answer as it builds up. A `blocked` result may carry text written before the filter
 * stopped it; what is kept is the gateway's decision (Phase 7C).
 */
export class GeminiStreamState {
  text = '';
  private finish: string | undefined;
  private blocked = false;
  private usage: GeminiUsage | undefined;

  /** Takes one event; returns its new text (possibly empty). */
  take(event: GeminiResponse): string {
    if (event.error) throw geminiFailure(undefined, { error: event.error });
    if (event.promptFeedback?.blockReason !== undefined) this.blocked = true;
    const finish = event.candidates?.[0]?.finishReason;
    if (finish === ACCOUNT_BARRED) throw new AiProviderError('auth', { reason: ACCOUNT_BARRED });
    if (finish) this.finish = finish;
    if (event.usageMetadata) this.usage = event.usageMetadata;
    const piece = answerTextOf(event);
    this.text += piece;
    return piece;
  }

  /** The result once the stream has ended; a stream that stopped without a reason was cut short. */
  result(request: AiChatRequest, model: string): AiChatResult {
    if (!this.blocked && this.finish === undefined) {
      throw new AiProviderError('malformed', { reason: 'STREAM_CUT_SHORT' });
    }
    return {
      text: this.text,
      model,
      finishReason: this.blocked ? 'blocked' : finishReasonOf(this.finish),
      usage: usageOf(this.usage, request, this.text),
    };
  }
}

const enumValue = (value: unknown, pattern: RegExp) =>
  typeof value === 'string' && pattern.test(value) ? value : undefined;

/** `"37s"` or `"1.5s"` (a protobuf Duration), or a Retry-After header's seconds; capped at an hour. */
function retryAfterOf(delays: (string | undefined)[], header: string | null | undefined) {
  for (const delay of [...delays, header ?? undefined]) {
    const match = typeof delay === 'string' ? /^(\d{1,6}(?:\.\d+)?)s?$/.exec(delay.trim()) : null;
    if (match) return Math.min(3600, Math.ceil(Number(match[1])));
  }
  return undefined;
}

/**
 * A failed call in SI Academy's terms. Only status names and reason codes are read from the
 * provider's error — never its message, which may quote the request.
 */
export function geminiFailure(
  httpStatus: number | undefined,
  body: unknown,
  retryAfterHeader?: string | null,
): AiProviderError {
  const parsed = z.object({ error: errorSchema }).safeParse(body);
  const error = parsed.success ? parsed.data.error : undefined;
  const status = httpStatus ?? (typeof error?.code === 'number' ? error.code : undefined);
  const providerStatus =
    enumValue(error?.status, /^[A-Z][A-Z_]{1,40}$/) ??
    enumValue(error?.code, /^[a-z][a-z_]{1,40}$/)?.toUpperCase();
  const reason = error?.details
    ?.map((detail) => enumValue(detail.reason, /^[A-Z][A-Z0-9_]{1,63}$/))
    .find((value) => value !== undefined);
  const retryAfterSeconds = retryAfterOf(
    error?.details?.map((detail) => detail.retryDelay) ?? [],
    retryAfterHeader,
  );
  const diagnostics: AiFailureDiagnostics = {};
  if (status !== undefined) diagnostics.httpStatus = status;
  if (providerStatus) diagnostics.providerStatus = providerStatus;
  if (reason) diagnostics.reason = reason;
  if (retryAfterSeconds !== undefined) diagnostics.retryAfterSeconds = retryAfterSeconds;
  return new AiProviderError(classify(status, providerStatus, reason), diagnostics);
}

function classify(
  status: number | undefined,
  providerStatus: string | undefined,
  reason: string | undefined,
): AiProviderFailure {
  const name = providerStatus ?? '';
  if (
    reason?.includes('API_KEY') ||
    status === 401 ||
    status === 403 ||
    ['UNAUTHENTICATED', 'PERMISSION_DENIED', 'AUTHENTICATION'].includes(name)
  ) {
    return 'auth';
  }
  if (status === 429 || ['RESOURCE_EXHAUSTED', 'RATE_LIMIT_EXCEEDED'].includes(name)) {
    return 'rate_limited';
  }
  if (status === 408 || status === 504 || name === 'DEADLINE_EXCEEDED') return 'timeout';
  if (
    status === 402 ||
    status === 404 ||
    ['FAILED_PRECONDITION', 'NOT_FOUND', 'PAYMENT_REQUIRED'].includes(name)
  ) {
    return 'configuration';
  }
  if (status === 499 || name === 'CANCELLED') return 'cancelled';
  if (status === undefined || status >= 500) return 'unavailable';
  return 'bad_request';
}
