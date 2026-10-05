import { inspect } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AiChatDelta,
  type AiChatRequest,
  AiProviderError,
  AiUnavailableError,
} from './ai-provider.js';
import { GroqAiProvider } from './groq.provider.js';
import { finishReasonOf } from './groq.wire.js';

/**
 * The Groq adapter (ADR-0038) against a stand-in for `fetch`: no test reaches the network. The
 * fixtures follow Groq's OpenAI-compatible chat completions as its API reference and error guide
 * describe them (read on 5 October 2026).
 */
const KEY = 'test-groq-key-CANARY-4d19';
const BASE = 'https://api.groq.com/openai/v1';
const MODEL = 'openai/gpt-oss-120b';
const config = { GROQ_API_KEY: KEY, GROQ_BASE_URL: `${BASE}/`, AI_FALLBACK_MODEL: MODEL };

const request: AiChatRequest = {
  task: 'chat',
  messages: [
    { role: 'system', content: 'You help learners.' },
    { role: 'system', content: '  ' },
    { role: 'user', content: 'What is a class?' },
    { role: 'assistant', content: 'A blueprint for objects.' },
    { role: 'user', content: 'And an object?' },
  ],
  maxOutputTokens: 256,
  temperature: 0.2,
};

interface Call {
  url: string;
  init: RequestInit;
}

let calls: Call[] = [];
function respond(handler: (call: Call) => Response | Promise<Response>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return handler(call);
  });
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** Server-sent events, delivered `chunk` bytes at a time, ended as Groq ends them. */
function sse(events: unknown[], chunk = 7, done = true): Response {
  const text =
    events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join('') +
    (done ? 'data: [DONE]\n\n' : '');
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += chunk) controller.enqueue(bytes.slice(i, i + chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

/** Never answers; rejects as fetch does when its signal aborts. */
const hang = (call: Call) =>
  new Promise<Response>((_, reject) => {
    const signal = call.init.signal!;
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

const completion = (content: string | null, finish = 'stop', usage: unknown = null) => ({
  id: 'chatcmpl-MARKER-ID',
  object: 'chat.completion',
  model: MODEL,
  choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: finish }],
  ...(usage === null ? {} : { usage }),
  x_groq: { id: 'req_MARKER' },
});
const chunk = (content: string | null, finish: string | null = null) => ({
  id: 'chatcmpl-MARKER-ID',
  object: 'chat.completion.chunk',
  choices: [{ index: 0, delta: content === null ? {} : { content }, finish_reason: finish }],
});

const live = () => new AbortController().signal;

async function collect(stream: AsyncIterable<AiChatDelta>): Promise<AiChatDelta[]> {
  const out: AiChatDelta[] = [];
  for await (const delta of stream) out.push(delta);
  return out;
}

async function failureOf(promise: Promise<unknown>): Promise<AiProviderError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AiProviderError);
    return error as AiProviderError;
  }
  throw new Error('expected the call to fail');
}

describe('the Groq provider (ADR-0038)', () => {
  let provider: GroqAiProvider;
  beforeEach(() => {
    calls = [];
    provider = new GroqAiProvider(config);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('the request it sends', () => {
    it('posts the turns to the configured chat completions, the key in its header alone', async () => {
      respond(() =>
        json(completion('An instance.', 'stop', { prompt_tokens: 20, completion_tokens: 3 })),
      );
      await provider.chat(request, live());
      expect(calls).toHaveLength(1);
      const [call] = calls;
      expect(call!.url).toBe(`${BASE}/chat/completions`);
      expect(call!.init.method).toBe('POST');
      expect(call!.init.redirect).toBe('error');
      const headers = new Headers(call!.init.headers);
      expect(headers.get('authorization')).toBe(`Bearer ${KEY}`);
      expect(headers.get('content-type')).toBe('application/json');
      expect(call!.url).not.toContain(KEY);
      const body = JSON.parse(String(call!.init.body)) as Record<string, unknown>;
      expect(body).toEqual({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You help learners.' },
          { role: 'user', content: 'What is a class?' },
          { role: 'assistant', content: 'A blueprint for objects.' },
          { role: 'user', content: 'And an object?' },
        ],
        n: 1,
        max_completion_tokens: 256,
        temperature: 0.2,
      });
      expect(String(call!.init.body)).not.toContain(KEY);
    });

    it('names the model the router chose, a publisher before it if Groq names one so', async () => {
      respond(() => json(completion('ok')));
      await provider.chat({ ...request, model: 'openai/gpt-oss-20b' }, live());
      expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
        model: 'openai/gpt-oss-20b',
      });
    });

    it('streams with the token counts asked for in the last event', async () => {
      respond(() => sse([chunk('Hi', 'stop')]));
      await collect(provider.stream(request, live()));
      expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
        stream: true,
        stream_options: { include_usage: true },
      });
    });

    it('sends nothing without a question, or for a model code that is not one', async () => {
      respond(() => json(completion('never')));
      const noQuestion = await failureOf(
        provider.chat({ task: 'chat', messages: [{ role: 'system', content: 'x' }] }, live()),
      );
      expect(noQuestion.kind).toBe('bad_request');
      const notAModel = await failureOf(provider.chat({ ...request, model: '../models' }, live()));
      expect(notAModel).toMatchObject({
        kind: 'configuration',
        diagnostics: { reason: 'NO_MODEL' },
      });
      expect(calls).toHaveLength(0);
    });
  });

  describe('the answer it returns', () => {
    it('gives the text, the model asked for, why it stopped and the counts Groq reports', async () => {
      respond(() =>
        json(
          completion('An instance of a class.', 'stop', {
            prompt_tokens: 21,
            completion_tokens: 6,
          }),
        ),
      );
      expect(await provider.chat(request, live())).toEqual({
        text: 'An instance of a class.',
        model: MODEL,
        finishReason: 'stop',
        usage: { inputTokens: 21, outputTokens: 6 },
      });
    });

    it('estimates the counts, and says so, when Groq reports none', async () => {
      respond(() => json(completion('Four words of answer.')));
      const result = await provider.chat(request, live());
      expect(result.usage.estimated).toBe(true);
      expect(result.usage.inputTokens).toBeGreaterThan(0);
      expect(result.usage.outputTokens).toBe(Math.ceil('Four words of answer.'.length / 4));
    });

    it('maps why the model stopped into SI Academy’s words', () => {
      expect(finishReasonOf('stop')).toBe('stop');
      expect(finishReasonOf('length')).toBe('length');
      expect(finishReasonOf('content_filter')).toBe('blocked');
      expect(finishReasonOf('tool_calls')).toBe('other');
      expect(finishReasonOf(null)).toBe('other');
    });

    it('reads an empty answer as empty, and a generation Groq reports failed as unavailable', async () => {
      respond(() => json(completion(null, 'length')));
      expect(await provider.chat(request, live())).toMatchObject({
        text: '',
        finishReason: 'length',
      });
      vi.restoreAllMocks();
      respond(() => json(completion('half', 'error')));
      expect(await failureOf(provider.chat(request, live()))).toMatchObject({
        kind: 'unavailable',
        diagnostics: { reason: 'GENERATION_ERROR' },
      });
    });

    it('refuses an answer it cannot read', async () => {
      respond(() => new Response('<html>gateway</html>', { status: 200 }));
      expect((await failureOf(provider.chat(request, live()))).diagnostics.reason).toBe('NOT_JSON');
      vi.restoreAllMocks();
      respond(() => json({ choices: 'none' }));
      expect((await failureOf(provider.chat(request, live()))).diagnostics.reason).toBe(
        'UNEXPECTED_SHAPE',
      );
      vi.restoreAllMocks();
      respond(() => json({ choices: [] }));
      expect((await failureOf(provider.chat(request, live()))).diagnostics.reason).toBe(
        'NO_CHOICE',
      );
    });
  });

  describe('failures, in SI Academy’s words', () => {
    const cases: [number, unknown, string, string | undefined][] = [
      [
        401,
        { error: { type: 'invalid_request_error', code: 'invalid_api_key' } },
        'auth',
        'INVALID_API_KEY',
      ],
      [403, { error: { type: 'permission_error' } }, 'auth', undefined],
      [
        404,
        { error: { type: 'invalid_request_error', code: 'model_not_found' } },
        'configuration',
        'MODEL_NOT_FOUND',
      ],
      [
        400,
        { error: { type: 'invalid_request_error', code: 'model_decommissioned' } },
        'configuration',
        'MODEL_DECOMMISSIONED',
      ],
      [
        400,
        { error: { type: 'invalid_request_error', code: 'context_length_exceeded' } },
        'bad_request',
        'CONTEXT_LENGTH_EXCEEDED',
      ],
      [413, { error: { type: 'invalid_request_error' } }, 'bad_request', undefined],
      [422, { error: { type: 'invalid_request_error' } }, 'bad_request', undefined],
      [
        429,
        { error: { type: 'tokens', code: 'rate_limit_exceeded' } },
        'rate_limited',
        'RATE_LIMIT_EXCEEDED',
      ],
      [498, { error: { type: 'capacity_exceeded' } }, 'rate_limited', undefined],
      [499, {}, 'cancelled', undefined],
      [500, { error: { type: 'internal_server_error' } }, 'unavailable', undefined],
      [502, 'Bad gateway', 'unavailable', undefined],
      [503, { error: { type: 'service_unavailable' } }, 'unavailable', undefined],
      [504, {}, 'timeout', undefined],
    ];

    it.each(cases)(
      'HTTP %i is a failure of its kind, by status and codes only',
      async (status, body, kind, reason) => {
        respond(() =>
          typeof body === 'string' ? new Response(body, { status }) : json(body, status),
        );
        const failure = await failureOf(provider.chat(request, live()));
        expect(failure.kind).toBe(kind);
        expect(failure.diagnostics.httpStatus).toBe(status);
        expect(failure.diagnostics.reason).toBe(reason);
      },
    );

    it('keeps the wait Groq asks for on a limit', async () => {
      respond(() =>
        json({ error: { type: 'requests', code: 'rate_limit_exceeded' } }, 429, {
          'retry-after': '7',
        }),
      );
      expect((await failureOf(provider.chat(request, live()))).diagnostics).toMatchObject({
        httpStatus: 429,
        providerStatus: 'REQUESTS',
        retryAfterSeconds: 7,
      });
    });

    it('is unavailable when Groq cannot be reached, named by the error’s code alone', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }),
      );
      expect(await failureOf(provider.chat(request, live()))).toMatchObject({
        kind: 'unavailable',
        diagnostics: { errorName: 'ECONNRESET' },
      });
    });

    it('is a timeout when the deadline ends the call, and cancelled when the caller leaves', async () => {
      respond(hang);
      const deadline = AbortSignal.timeout(20);
      expect((await failureOf(provider.chat(request, deadline))).kind).toBe('timeout');
      const caller = new AbortController();
      setTimeout(() => caller.abort(new Error('gone')), 5);
      expect((await failureOf(provider.chat(request, caller.signal))).kind).toBe('cancelled');
      const streamed = new AbortController();
      setTimeout(() => streamed.abort(new Error('gone')), 5);
      expect((await failureOf(collect(provider.stream(request, streamed.signal)))).kind).toBe(
        'cancelled',
      );
    });
  });

  describe('streaming', () => {
    it('streams the text as written, then the whole result once, with the counts', async () => {
      respond(() =>
        sse([
          chunk('Objects '),
          chunk('are '),
          chunk(''),
          chunk('instances.', 'stop'),
          {
            id: 'x',
            object: 'chat.completion.chunk',
            choices: [],
            usage: { prompt_tokens: 30, completion_tokens: 4 },
          },
        ]),
      );
      const deltas = await collect(provider.stream(request, live()));
      expect(deltas).toEqual([
        { type: 'text', text: 'Objects ' },
        { type: 'text', text: 'are ' },
        { type: 'text', text: 'instances.' },
        {
          type: 'done',
          result: {
            text: 'Objects are instances.',
            model: MODEL,
            finishReason: 'stop',
            usage: { inputTokens: 30, outputTokens: 4 },
          },
        },
      ]);
    });

    it('reads the counts where Groq has also put them (x_groq)', async () => {
      respond(() =>
        sse([
          {
            ...chunk('Done.', 'stop'),
            x_groq: { usage: { prompt_tokens: 9, completion_tokens: 2 } },
          },
        ]),
      );
      const deltas = await collect(provider.stream(request, live()));
      expect(deltas.at(-1)).toMatchObject({
        result: { usage: { inputTokens: 9, outputTokens: 2 } },
      });
    });

    it('refuses a stream cut short, an event it cannot read, or a failure inside it', async () => {
      respond(() => sse([chunk('Half ')], 7, false));
      expect((await failureOf(collect(provider.stream(request, live())))).diagnostics.reason).toBe(
        'STREAM_CUT_SHORT',
      );
      vi.restoreAllMocks();
      respond(() => sse(['{not json']));
      expect((await failureOf(collect(provider.stream(request, live())))).diagnostics.reason).toBe(
        'NOT_JSON',
      );
      vi.restoreAllMocks();
      respond(() => sse([chunk('Half '), { error: { type: 'internal_server_error' } }]));
      expect((await failureOf(collect(provider.stream(request, live())))).kind).toBe('unavailable');
      vi.restoreAllMocks();
      respond(() => sse([chunk('Half ', 'error')]));
      expect((await failureOf(collect(provider.stream(request, live())))).diagnostics.reason).toBe(
        'GENERATION_ERROR',
      );
    });

    it('fails before writing when Groq refuses the stream', async () => {
      respond(() => json({ error: { type: 'tokens', code: 'rate_limit_exceeded' } }, 429));
      const seen: AiChatDelta[] = [];
      const failure = await failureOf(
        (async () => {
          for await (const delta of provider.stream(request, live())) seen.push(delta);
        })(),
      );
      expect(failure.kind).toBe('rate_limited');
      expect(seen).toEqual([]);
    });
  });

  describe('what it does not do', () => {
    it('never embeds: the knowledge base is Gemini’s alone', async () => {
      respond(() => json({}));
      expect(provider.capabilities()).toMatchObject({ embeddings: false, streaming: true });
      await expect(provider.embed()).rejects.toBeInstanceOf(AiUnavailableError);
      expect(calls).toHaveLength(0);
    });
  });

  describe('health', () => {
    it('is healthy when the key lists the configured model, reading the list alone', async () => {
      respond(() => json({ object: 'list', data: [{ id: MODEL }, { id: 'openai/gpt-oss-20b' }] }));
      expect(await provider.health()).toEqual({ ok: true });
      expect(calls[0]!.url).toBe(`${BASE}/models`);
      expect(new Headers(calls[0]!.init.headers).get('authorization')).toBe(`Bearer ${KEY}`);
    });

    it('says what kind of problem there is, never Groq’s words', async () => {
      respond(() => json({ error: { message: `bad key ${KEY}` } }, 401));
      expect(await provider.health()).toEqual({
        ok: false,
        detail: 'The AI provider refused the key',
      });
      vi.restoreAllMocks();
      respond(() => json({ data: [{ id: 'openai/gpt-oss-20b' }] }));
      expect(await provider.health()).toEqual({
        ok: false,
        detail: 'The configured model is not available to this key',
      });
      expect(await new GroqAiProvider({ ...config, GROQ_API_KEY: '' }).health()).toEqual({
        ok: false,
        detail: 'The AI provider is not configured',
      });
    });
  });

  describe('the key and the provider’s words stay where they belong', () => {
    it('never carries the key or the provider’s message in a failure', async () => {
      const echo = `Invalid API Key ${KEY} for the request "What is a class?"`;
      respond(() =>
        json(
          { error: { message: echo, type: 'invalid_request_error', code: 'invalid_api_key' } },
          401,
        ),
      );
      const failure = await failureOf(provider.chat(request, live()));
      const shown = [
        JSON.stringify(failure),
        failure.message,
        inspect(failure),
        String(failure.stack),
      ].join('\n');
      expect(shown).not.toContain(KEY);
      expect(shown).not.toContain('What is a class?');
      expect(shown).not.toContain('Invalid API Key');
    });

    it('keeps the key out of sight when the provider is inspected or serialised', () => {
      expect(JSON.stringify(provider)).not.toContain(KEY);
      expect(inspect(provider, { depth: 5 })).not.toContain(KEY);
      expect(Object.values(provider)).not.toContain(KEY);
    });
  });
});
