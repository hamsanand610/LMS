import type { AiProviderCapabilities } from '@lms/shared';
import type { AppConfig } from '../../../core/config/env.js';
import {
  type AiChatDelta,
  type AiChatRequest,
  type AiChatResult,
  type AiEmbedResult,
  type AiProvider,
  AiProviderError,
  AiUnavailableError,
  asProviderError,
} from './ai-provider.js';
import {
  type GroqRequest,
  GroqStreamState,
  groqFailure,
  readGroqResponse,
  resultOf,
  toGroqRequest,
} from './groq.wire.js';
import { parseJson, sseData } from './wire.js';

/** The input limit of every Groq model the registry lists; each model's own is in the registry. */
const GROQ_CONTEXT_TOKENS = 131_072;
/** Far above any real answer: beyond it, the response is not one. */
const MAX_RESPONSE_CHARACTERS = 4_000_000;
const MAX_EVENT_CHARACTERS = 1_000_000;
const MAX_ANSWER_CHARACTERS = 1_000_000;
const HEALTH_TIMEOUT_MS = 5000;
/** Groq's model codes, some with their publisher before them (`openai/gpt-oss-120b`): sent in the body. */
const MODEL_CODE = /^(?:[a-z0-9][a-z0-9.-]{0,39}\/)?[a-z0-9][a-z0-9.-]{0,79}$/;
/** The stream's own end, after the last event. */
const STREAM_DONE = '[DONE]';

/**
 * Groq, the provider that stands in for Gemini's models when they fail for a reason that may pass
 * (ADR-0038), over HTTPS with the platform's own fetch — no vendor SDK. It uses the OpenAI-compatible
 * chat completions, which keep no conversation on the provider's side: SI Academy sends the turns
 * each time and keeps its own records. It answers chat only: the knowledge base is embedded by
 * Gemini alone, so the vectors stay one model's.
 *
 * The key is sent as a bearer token in the `Authorization` header to the configured address and
 * nowhere else: never in a URL, an error, a log line or a result. Redirects are refused, so the
 * header cannot follow one to another host. Failures become `AiProviderError`s carrying status and
 * reason codes only.
 */
export class GroqAiProvider implements AiProvider {
  readonly name = 'groq' as const;
  /** A private field: not enumerable, not serialised, not shown when the object is inspected. */
  readonly #apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: Pick<AppConfig, 'GROQ_API_KEY' | 'GROQ_BASE_URL' | 'AI_FALLBACK_MODEL'>) {
    this.#apiKey = config.GROQ_API_KEY;
    this.baseUrl = config.GROQ_BASE_URL.replace(/\/+$/, '');
    this.defaultModel = config.AI_FALLBACK_MODEL;
  }

  capabilities(): AiProviderCapabilities {
    return {
      streaming: true,
      embeddings: false,
      structuredOutput: false,
      maxContextTokens: GROQ_CONTEXT_TOKENS,
    };
  }

  async chat(request: AiChatRequest, signal: AbortSignal): Promise<AiChatResult> {
    const model = this.modelFor(request);
    const response = await this.post(toGroqRequest(request, model, false), signal);
    const text = await this.readText(response, signal);
    if (!response.ok) {
      throw groqFailure(response.status, parseJson(text), response.headers.get('retry-after'));
    }
    const json = parseJson(text);
    if (json === undefined) throw new AiProviderError('malformed', { reason: 'NOT_JSON' });
    return resultOf(readGroqResponse(json), request, model);
  }

  async *stream(request: AiChatRequest, signal: AbortSignal): AsyncGenerator<AiChatDelta> {
    const model = this.modelFor(request);
    const response = await this.post(toGroqRequest(request, model, true), signal);
    if (!response.ok) {
      const text = await this.readText(response, signal);
      throw groqFailure(response.status, parseJson(text), response.headers.get('retry-after'));
    }
    if (!response.body) throw new AiProviderError('malformed', { reason: 'NO_BODY' });
    const state = new GroqStreamState();
    try {
      for await (const data of sseData(response.body, MAX_EVENT_CHARACTERS)) {
        if (data.trim() === STREAM_DONE) break;
        const json = parseJson(data);
        if (json === undefined) throw new AiProviderError('malformed', { reason: 'NOT_JSON' });
        const piece = state.take(readGroqResponse(json));
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

  /** Groq does not embed for SI Academy (ADR-0038): the knowledge base is Gemini's alone. */
  embed(): Promise<AiEmbedResult> {
    return Promise.reject(new AiUnavailableError());
  }

  /**
   * Whether the key answers and lists the configured model, by reading the model list (no
   * generation, no tokens). Says what kind of problem there is, never the provider's own words.
   */
  async health(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.#apiKey || !MODEL_CODE.test(this.defaultModel)) {
      return { ok: false, detail: 'The AI provider is not configured' };
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.#apiKey}` },
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        redirect: 'error',
      });
    } catch {
      return { ok: false, detail: 'The AI provider could not be reached' };
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      const kind = groqFailure(response.status, undefined).kind;
      const detail =
        kind === 'auth'
          ? 'The AI provider refused the key'
          : kind === 'rate_limited'
            ? 'The AI provider is at its limit for this key'
            : 'The AI provider answered with an error';
      return { ok: false, detail };
    }
    const listed = parseJson(await response.text().catch(() => '')) as
      { data?: { id?: unknown }[] } | undefined;
    return listed?.data?.some((model) => model.id === this.defaultModel)
      ? { ok: true }
      : { ok: false, detail: 'The configured model is not available to this key' };
  }

  private modelFor(request: AiChatRequest): string {
    const model = request.model || this.defaultModel;
    if (!MODEL_CODE.test(model)) throw new AiProviderError('configuration', { reason: 'NO_MODEL' });
    return model;
  }

  private async post(body: GroqRequest, signal: AbortSignal): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.#apiKey}` },
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
}
