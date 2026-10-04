import { Logger } from '@nestjs/common';
import type { AiProviderCapabilities } from '@lms/shared';
import type { AppConfig } from '../../../core/config/env.js';
import {
  type AiChatDelta,
  type AiChatRequest,
  type AiChatResult,
  type AiEmbedRequest,
  type AiEmbedResult,
  type AiProvider,
  AiProviderError,
  asProviderError,
} from './ai-provider.js';
import {
  type GeminiEmbedRequest,
  GeminiStreamState,
  type GeminiRequest,
  geminiFailure,
  parseJson,
  readGeminiEmbeddings,
  readGeminiResponse,
  resultOf,
  sseData,
  toGeminiEmbedRequest,
  toGeminiRequest,
} from './gemini.wire.js';

/** The input limit of every Gemini model the registry lists; each model's own is in the registry. */
const GEMINI_CONTEXT_TOKENS = 1_048_576;
/** Far above any real answer (65,536 output tokens): beyond it, the response is not one. */
const MAX_RESPONSE_CHARACTERS = 4_000_000;
const MAX_EVENT_CHARACTERS = 1_000_000;
const MAX_ANSWER_CHARACTERS = 1_000_000;
const HEALTH_TIMEOUT_MS = 5000;
/** Model codes go into the request path: nothing else may. */
const MODEL_CODE = /^[a-z0-9][a-z0-9.-]{0,79}$/;
const RETIRING_STAGES = new Set(['LEGACY', 'DEPRECATED', 'RETIRED']);

/**
 * Gemini, the first cloud provider (ADR-0024; Phase 7B), over HTTPS with the platform's own fetch —
 * no vendor SDK. It uses `generateContent`, which keeps no conversation on the provider's side:
 * SI Academy sends the turns each time and keeps its own records, and every request sets
 * `store: false` so the provider logs none of them.
 *
 * The key is sent in the `x-goog-api-key` header to the configured address and nowhere else: never
 * in a URL, an error, a log line or a result. Redirects are refused, so the header cannot follow
 * one to another host. Failures become `AiProviderError`s carrying status and reason codes only.
 */
export class GeminiAiProvider implements AiProvider {
  readonly name = 'gemini' as const;
  private readonly logger = new Logger(GeminiAiProvider.name);
  /** A private field: not enumerable, not serialised, not shown when the object is inspected. */
  readonly #apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly retiringNoted = new Set<string>();

  constructor(config: Pick<AppConfig, 'GEMINI_API_KEY' | 'GEMINI_BASE_URL' | 'AI_MODEL'>) {
    this.#apiKey = config.GEMINI_API_KEY;
    this.baseUrl = config.GEMINI_BASE_URL.replace(/\/+$/, '');
    this.defaultModel = config.AI_MODEL;
  }

  capabilities(): AiProviderCapabilities {
    return {
      streaming: true,
      embeddings: true,
      structuredOutput: false,
      maxContextTokens: GEMINI_CONTEXT_TOKENS,
    };
  }

  async chat(request: AiChatRequest, signal: AbortSignal): Promise<AiChatResult> {
    const model = this.modelFor(request);
    const body = toGeminiRequest(request);
    const response = await this.post(`${this.modelUrl(model)}:generateContent`, body, signal);
    const text = await this.readText(response, signal);
    if (!response.ok) {
      throw geminiFailure(response.status, parseJson(text), response.headers.get('retry-after'));
    }
    const json = parseJson(text);
    if (json === undefined) throw new AiProviderError('malformed', { reason: 'NOT_JSON' });
    const answer = readGeminiResponse(json);
    this.noteRetiring(model, answer.modelStatus?.modelStage);
    return resultOf(answer, request, model);
  }

  async *stream(request: AiChatRequest, signal: AbortSignal): AsyncGenerator<AiChatDelta> {
    const model = this.modelFor(request);
    const body = toGeminiRequest(request);
    const url = `${this.modelUrl(model)}:streamGenerateContent?alt=sse`;
    const response = await this.post(url, body, signal);
    if (!response.ok) {
      const text = await this.readText(response, signal);
      throw geminiFailure(response.status, parseJson(text), response.headers.get('retry-after'));
    }
    if (!response.body) throw new AiProviderError('malformed', { reason: 'NO_BODY' });
    const state = new GeminiStreamState();
    try {
      for await (const data of sseData(response.body, MAX_EVENT_CHARACTERS)) {
        const json = parseJson(data);
        if (json === undefined) throw new AiProviderError('malformed', { reason: 'NOT_JSON' });
        const event = readGeminiResponse(json);
        this.noteRetiring(model, event.modelStatus?.modelStage);
        const piece = state.take(event);
        if (state.text.length > MAX_ANSWER_CHARACTERS) {
          throw new AiProviderError('malformed', { reason: 'ANSWER_TOO_LARGE' });
        }
        if (piece !== '') yield { type: 'text', text: piece };
      }
    } catch (error) {
      throw asProviderError(error, signal);
    }
    yield { type: 'done', result: state.result(request, model) };
  }

  /**
   * Embeddings (Phase 8C; ADR-0035): `models.batchEmbedContents` of the same `v1` API, one call for
   * the batch, the key in its header alone. Every vector is checked and kept at unit length; a
   * failure is an `AiProviderError` with status and reason codes, never the provider's words.
   */
  async embed(request: AiEmbedRequest, signal: AbortSignal): Promise<AiEmbedResult> {
    const model = request.model;
    if (!MODEL_CODE.test(model)) throw new AiProviderError('configuration', { reason: 'NO_MODEL' });
    if (request.texts.length === 0) return { vectors: [], model, usage: { inputTokens: 0 } };
    const body = toGeminiEmbedRequest(request, model);
    const response = await this.post(`${this.modelUrl(model)}:batchEmbedContents`, body, signal);
    const text = await this.readText(response, signal);
    if (!response.ok) {
      throw geminiFailure(response.status, parseJson(text), response.headers.get('retry-after'));
    }
    const json = parseJson(text);
    if (json === undefined) throw new AiProviderError('malformed', { reason: 'NOT_JSON' });
    const { vectors, inputTokens } = readGeminiEmbeddings(json, request);
    const usage =
      inputTokens === undefined
        ? {
            inputTokens: request.texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
            estimated: true,
          }
        : { inputTokens };
    return { vectors, model, usage };
  }

  /**
   * Whether the key and the configured model answer, by reading the model's description (no
   * generation, no tokens). Says what kind of problem there is, never the provider's own words.
   */
  async health(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.#apiKey || !MODEL_CODE.test(this.defaultModel)) {
      return { ok: false, detail: 'The AI provider is not configured' };
    }
    let response: Response;
    try {
      response = await fetch(this.modelUrl(this.defaultModel), {
        headers: { 'x-goog-api-key': this.#apiKey },
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        redirect: 'error',
      });
    } catch {
      return { ok: false, detail: 'The AI provider could not be reached' };
    }
    await response.body?.cancel().catch(() => undefined);
    if (response.ok) return { ok: true };
    const kind = geminiFailure(response.status, undefined).kind;
    const detail =
      kind === 'auth'
        ? 'The AI provider refused the key'
        : kind === 'configuration'
          ? 'The configured model is not available to this key'
          : kind === 'rate_limited'
            ? 'The AI provider is at its limit for this key'
            : 'The AI provider answered with an error';
    return { ok: false, detail };
  }

  private modelFor(request: AiChatRequest): string {
    const model = request.model || this.defaultModel;
    if (!MODEL_CODE.test(model)) throw new AiProviderError('configuration', { reason: 'NO_MODEL' });
    return model;
  }

  private modelUrl(model: string): string {
    return `${this.baseUrl}/models/${model}`;
  }

  private async post(
    url: string,
    body: GeminiRequest | GeminiEmbedRequest,
    signal: AbortSignal,
  ): Promise<Response> {
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.#apiKey },
        body: JSON.stringify(body),
        signal,
        redirect: 'error',
      });
    } catch (error) {
      throw asProviderError(error, signal);
    }
  }

  private async readText(response: Response, signal: AbortSignal): Promise<string> {
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_RESPONSE_CHARACTERS) {
      await response.body?.cancel().catch(() => undefined);
      throw new AiProviderError('malformed', { reason: 'RESPONSE_TOO_LARGE' });
    }
    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      throw asProviderError(error, signal);
    }
    if (text.length > MAX_RESPONSE_CHARACTERS) {
      throw new AiProviderError('malformed', { reason: 'RESPONSE_TOO_LARGE' });
    }
    return text;
  }

  /** Once per model: the provider says the model is on its way out. */
  private noteRetiring(model: string, stage: string | undefined): void {
    if (!stage || !RETIRING_STAGES.has(stage) || this.retiringNoted.has(model)) return;
    this.retiringNoted.add(model);
    this.logger.warn(
      { ai: { provider: this.name, model, modelStage: stage } },
      'The AI provider is retiring the configured model: choose a current one',
    );
  }
}
