import { inspect } from 'node:util';
import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_ERROR_CODES } from '@lms/shared';
import {
  type AiChatDelta,
  type AiChatRequest,
  type AiChatResult,
  AiProviderError,
} from './ai-provider.js';
import { GeminiAiProvider } from './gemini.provider.js';
import { finishReasonOf } from './gemini.wire.js';

/**
 * The Gemini adapter (Phase 7B) against a stand-in for `fetch`: no test reaches the network. The
 * fixtures follow the contract in Google's discovery document for the Generative Language API (v1,
 * revision 20261002).
 */
const KEY = 'test-gemini-key-CANARY-7b31';
const BASE = 'https://generativelanguage.googleapis.com/v1';
const config = { GEMINI_API_KEY: KEY, GEMINI_BASE_URL: `${BASE}/`, AI_MODEL: 'gemini-3.8-flash' };

const request: AiChatRequest = {
  task: 'chat',
  messages: [
    { role: 'system', content: 'You help learners.' },
    { role: 'user', content: 'What is a class?' },
    { role: 'assistant', content: 'A blueprint for objects.' },
    { role: 'user', content: 'And an object?' },
    { role: 'user', content: 'In Java, please.' },
  ],
  maxOutputTokens: 256,
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

/** Server-sent events, delivered `chunk` bytes at a time. */
function sse(events: unknown[], chunk = 7, separator = '\r\n\r\n'): Response {
  const text = events
    .map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}${separator}`)
    .join('');
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

const answer = (text: string, finishReason = 'STOP') => ({
  candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason, index: 0 }],
  usageMetadata: {
    promptTokenCount: 12,
    candidatesTokenCount: 5,
    thoughtsTokenCount: 3,
    totalTokenCount: 20,
  },
  modelVersion: 'gemini-3.8-flash',
  responseId: 'r-1',
});

const live = () => new AbortController().signal;

async function collect(stream: AsyncIterable<AiChatDelta>): Promise<AiChatDelta[]> {
  const out: AiChatDelta[] = [];
  for await (const delta of stream) out.push(delta);
  return out;
}

async function failure(promise: Promise<unknown>): Promise<AiProviderError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AiProviderError);
    return error as AiProviderError;
  }
  throw new Error('expected the call to fail');
}

const headersOf = (call: Call) => new Headers(call.init.headers);

describe('the Gemini provider (Phase 7B)', () => {
  let gemini: GeminiAiProvider;
  let logged: unknown[][];

  beforeEach(() => {
    calls = [];
    logged = [];
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
    gemini = new GeminiAiProvider(config);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('the request it sends', () => {
    it('is one POST to the model’s generateContent, with the key in its header and nowhere else', async () => {
      respond(() => json(answer('Objects are instances.')));
      await gemini.chat(request, live());
      expect(calls).toHaveLength(1);
      const [call] = calls;
      expect(call!.url).toBe(`${BASE}/models/gemini-3.8-flash:generateContent`);
      expect(call!.init.method).toBe('POST');
      expect(call!.init.redirect).toBe('error');
      expect(headersOf(call!).get('x-goog-api-key')).toBe(KEY);
      expect(headersOf(call!).get('content-type')).toBe('application/json');
      expect(call!.url).not.toContain(KEY);
      expect(call!.url).not.toMatch(/[?&]key=/);
      expect(String(call!.init.body)).not.toContain(KEY);
    });

    it('carries the conversation: a system instruction, user and model turns, no provider-side log', async () => {
      respond(() => json(answer('Objects are instances.')));
      await gemini.chat(request, live());
      expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
        contents: [
          { role: 'user', parts: [{ text: 'What is a class?' }] },
          { role: 'model', parts: [{ text: 'A blueprint for objects.' }] },
          // Two messages in a row from the learner are one turn.
          { role: 'user', parts: [{ text: 'And an object?' }, { text: 'In Java, please.' }] },
        ],
        systemInstruction: { parts: [{ text: 'You help learners.' }] },
        generationConfig: { candidateCount: 1, maxOutputTokens: 256 },
        store: false,
      });
    });

    it('passes a grounded answer’s low temperature through, and none when unset (Phase 8E)', async () => {
      respond(() => json(answer('ok')));
      await gemini.chat({ ...request, temperature: 0.2 }, live());
      expect(JSON.parse(String(calls[0]!.init.body)).generationConfig).toEqual({
        candidateCount: 1,
        maxOutputTokens: 256,
        temperature: 0.2,
      });
    });

    it('uses the model the router names, else AI_MODEL', async () => {
      respond(() => json(answer('ok')));
      await gemini.chat({ ...request, model: 'gemini-3.5-flash-lite' }, live());
      await gemini.chat(request, live());
      expect(calls.map((c) => c.url)).toEqual([
        `${BASE}/models/gemini-3.5-flash-lite:generateContent`,
        `${BASE}/models/gemini-3.8-flash:generateContent`,
      ]);
    });

    it('streams from streamGenerateContent as server-sent events', async () => {
      respond(() => sse([answer('Hello.')]));
      await collect(gemini.stream(request, live()));
      expect(calls[0]!.url).toBe(`${BASE}/models/gemini-3.8-flash:streamGenerateContent?alt=sse`);
      expect(headersOf(calls[0]!).get('x-goog-api-key')).toBe(KEY);
    });

    it('refuses before any call: no question, or a model code that is not one', async () => {
      respond(() => json(answer('never')));
      const noQuestion = await failure(
        gemini.chat({ task: 'chat', messages: [{ role: 'system', content: 'Rules' }] }, live()),
      );
      expect(noQuestion.kind).toBe('bad_request');
      for (const model of ['models/x', 'gemini-3.8-flash?key=x', '../admin', 'Gemini']) {
        const refused = await failure(gemini.chat({ ...request, model }, live()));
        expect(refused.kind, model).toBe('configuration');
      }
      expect(calls).toHaveLength(0);
    });
  });

  describe('the answer it returns', () => {
    it('is the text, why it stopped and the tokens used — thinking counted as output', async () => {
      respond(() => json(answer('A class is a blueprint.')));
      expect(await gemini.chat(request, live())).toEqual<AiChatResult>({
        text: 'A class is a blueprint.',
        model: 'gemini-3.8-flash',
        finishReason: 'stop',
        usage: { inputTokens: 12, outputTokens: 8 },
      });
    });

    it('leaves the model’s reasoning out of the answer', async () => {
      respond(() =>
        json({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: 'Let me think…', thought: true }, { text: 'An instance.' }],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 },
        }),
      );
      expect((await gemini.chat(request, live())).text).toBe('An instance.');
    });

    it('says why the model stopped in four words', async () => {
      expect(finishReasonOf('STOP')).toBe('stop');
      expect(finishReasonOf('MAX_TOKENS')).toBe('length');
      for (const raw of ['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII']) {
        expect(finishReasonOf(raw), raw).toBe('blocked');
      }
      for (const raw of ['LANGUAGE', 'OTHER', 'MALFORMED_RESPONSE', 'A_NEW_REASON', undefined]) {
        expect(finishReasonOf(raw), String(raw)).toBe('other');
      }
      respond(() => json(answer('Cut', 'MAX_TOKENS')));
      expect((await gemini.chat(request, live())).finishReason).toBe('length');
    });

    it('answers a blocked question with no text, as blocked', async () => {
      respond(() =>
        json({ promptFeedback: { blockReason: 'SAFETY' }, usageMetadata: { promptTokenCount: 7 } }),
      );
      expect(await gemini.chat(request, live())).toEqual({
        text: '',
        model: 'gemini-3.8-flash',
        finishReason: 'blocked',
        usage: { inputTokens: 7, outputTokens: 0 },
      });
    });

    it('estimates the tokens, and says so, when the provider reports none', async () => {
      respond(() =>
        json({
          candidates: [{ content: { parts: [{ text: 'Twelve chars' }] }, finishReason: 'STOP' }],
        }),
      );
      const characters = request.messages.reduce((n, m) => n + m.content.length, 0);
      expect((await gemini.chat(request, live())).usage).toEqual({
        inputTokens: Math.ceil(characters / 4),
        outputTokens: 3,
        estimated: true,
      });
    });

    it('counts an unreadable answer as malformed, never as an answer', async () => {
      for (const body of [
        new Response('<html>oops</html>', { status: 200 }),
        json({ candidates: 'none' }),
        json({ candidates: [{ content: { parts: [{ text: 42 }] } }] }),
        json({}),
      ]) {
        respond(() => body);
        const error = await failure(gemini.chat(request, live()));
        expect(error.kind).toBe('malformed');
        expect(error.status).toBe(502);
      }
    });

    it('treats an account barred by the provider as a key problem', async () => {
      respond(() => json(answer('', 'PUP_LIMITED_DISABLED')));
      expect((await failure(gemini.chat(request, live()))).kind).toBe('auth');
    });
  });

  describe('failures, in SI Academy’s words', () => {
    const table: [string, number, unknown, string, number, string][] = [
      [
        'an unknown key',
        401,
        { error: { code: 401, status: 'UNAUTHENTICATED' } },
        'auth',
        503,
        AI_ERROR_CODES.UNAVAILABLE,
      ],
      [
        'a refused key',
        403,
        { error: { code: 403, status: 'PERMISSION_DENIED' } },
        'auth',
        503,
        AI_ERROR_CODES.UNAVAILABLE,
      ],
      [
        'an invalid key, said with a 400',
        400,
        {
          error: {
            code: 400,
            status: 'INVALID_ARGUMENT',
            details: [
              { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' },
            ],
          },
        },
        'auth',
        503,
        AI_ERROR_CODES.UNAVAILABLE,
      ],
      [
        'an invalid request',
        400,
        { error: { code: 400, status: 'INVALID_ARGUMENT' } },
        'bad_request',
        502,
        AI_ERROR_CODES.UNAVAILABLE,
      ],
      [
        'billing or region not set up',
        400,
        { error: { code: 400, status: 'FAILED_PRECONDITION' } },
        'configuration',
        503,
        AI_ERROR_CODES.UNAVAILABLE,
      ],
      [
        'an unknown model',
        404,
        { error: { code: 404, status: 'NOT_FOUND' } },
        'configuration',
        503,
        AI_ERROR_CODES.UNAVAILABLE,
      ],
      [
        'the provider’s limits',
        429,
        { error: { code: 429, status: 'RESOURCE_EXHAUSTED' } },
        'rate_limited',
        503,
        AI_ERROR_CODES.BUSY,
      ],
      [
        'a provider error',
        500,
        { error: { code: 500, status: 'INTERNAL' } },
        'unavailable',
        503,
        AI_ERROR_CODES.UNAVAILABLE,
      ],
      [
        'an overloaded model',
        503,
        { error: { code: 503, status: 'UNAVAILABLE' } },
        'unavailable',
        503,
        AI_ERROR_CODES.UNAVAILABLE,
      ],
      [
        'the provider’s own deadline',
        504,
        { error: { code: 504, status: 'DEADLINE_EXCEEDED' } },
        'timeout',
        504,
        AI_ERROR_CODES.TIMEOUT,
      ],
      [
        'a proxy’s error page',
        502,
        '<html>Bad gateway</html>',
        'unavailable',
        503,
        AI_ERROR_CODES.UNAVAILABLE,
      ],
    ];

    it.each(table)('%s (HTTP %i) is %s', async (_, status, body, kind, httpStatus, code) => {
      respond(() =>
        typeof body === 'string' ? new Response(body, { status }) : json(body, status),
      );
      const error = await failure(gemini.chat(request, live()));
      expect(error.kind).toBe(kind);
      expect(error.status).toBe(httpStatus);
      expect(error.code).toBe(code);
      expect(error.title).toBe(
        code === AI_ERROR_CODES.BUSY
          ? 'AI busy'
          : code === AI_ERROR_CODES.TIMEOUT
            ? 'AI timeout'
            : 'AI unavailable',
      );
      expect(error.diagnostics.httpStatus).toBe(status);
    });

    it('passes on how long the provider asks to wait', async () => {
      respond(() =>
        json(
          {
            error: {
              code: 429,
              status: 'RESOURCE_EXHAUSTED',
              details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' }],
            },
          },
          429,
        ),
      );
      const error = await failure(gemini.chat(request, live()));
      expect(error.diagnostics).toEqual({
        httpStatus: 429,
        providerStatus: 'RESOURCE_EXHAUSTED',
        retryAfterSeconds: 37,
      });
      respond(() => json({ error: { code: 429 } }, 429, { 'Retry-After': '12' }));
      expect((await failure(gemini.chat(request, live()))).diagnostics.retryAfterSeconds).toBe(12);
    });

    it('is unavailable when the provider cannot be reached, named by the error code only', async () => {
      respond(() => {
        throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
      });
      const error = await failure(gemini.chat(request, live()));
      expect(error.kind).toBe('unavailable');
      expect(error.diagnostics).toEqual({ errorName: 'ECONNREFUSED' });
    });

    it('is a timeout when the deadline passes, and a cancellation when the caller leaves', async () => {
      respond(hang);
      const late = await failure(gemini.chat(request, AbortSignal.timeout(20)));
      expect(late.kind).toBe('timeout');
      expect(late.status).toBe(504);

      const caller = new AbortController();
      setTimeout(() => caller.abort(), 10);
      const left = await failure(gemini.chat(request, caller.signal));
      expect(left.kind).toBe('cancelled');
      expect(left.countsAgainstModel).toBe(false);
    });
  });

  describe('streaming', () => {
    it('writes the answer as it comes, however the bytes arrive, then the whole result once', async () => {
      respond(() =>
        sse([
          { candidates: [{ content: { role: 'model', parts: [{ text: 'A class ' }] } }] },
          {
            candidates: [
              {
                content: { role: 'model', parts: [{ text: 'is a blueprint.' }] },
                finishReason: 'STOP',
              },
            ],
            usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 6, thoughtsTokenCount: 2 },
          },
        ]),
      );
      const deltas = await collect(gemini.stream(request, live()));
      expect(deltas).toEqual<AiChatDelta[]>([
        { type: 'text', text: 'A class ' },
        { type: 'text', text: 'is a blueprint.' },
        {
          type: 'done',
          result: {
            text: 'A class is a blueprint.',
            model: 'gemini-3.8-flash',
            finishReason: 'stop',
            usage: { inputTokens: 9, outputTokens: 8 },
          },
        },
      ]);
    });

    it('reads plain line feeds, comments and a last event without its blank line', async () => {
      const event = JSON.stringify(answer('Done.'));
      respond(
        () =>
          new Response(`: keep-alive\n\ndata: ${event}`, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
      );
      const deltas = await collect(gemini.stream(request, live()));
      expect(deltas.at(-1)).toMatchObject({ type: 'done', result: { text: 'Done.' } });
    });

    it('keeps the text written before a safety stop, and says the answer was blocked', async () => {
      respond(() =>
        sse([
          { candidates: [{ content: { parts: [{ text: 'Partial ' }] } }] },
          { candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }] },
        ]),
      );
      const done = (await collect(gemini.stream(request, live()))).at(-1);
      expect(done).toMatchObject({
        type: 'done',
        result: { text: 'Partial ', finishReason: 'blocked' },
      });
    });

    it('counts a stream cut short, or unreadable, as malformed', async () => {
      respond(() => sse([{ candidates: [{ content: { parts: [{ text: 'Half' }] } }] }]));
      expect((await failure(collect(gemini.stream(request, live())))).kind).toBe('malformed');
      respond(() => sse(['{not json']));
      expect((await failure(collect(gemini.stream(request, live())))).kind).toBe('malformed');
    });

    it('maps a failure the stream reports, and a failed start, like any failed call', async () => {
      respond(() => sse([{ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }]));
      expect((await failure(collect(gemini.stream(request, live())))).kind).toBe('rate_limited');
      respond(() => json({ error: { code: 503, status: 'UNAVAILABLE' } }, 503));
      expect((await failure(collect(gemini.stream(request, live())))).kind).toBe('unavailable');
    });

    /** A stream that sends one event and stays open, as a slow answer does. */
    function openStream(call: Call, onCancel: () => void): Response {
      const event = { candidates: [{ content: { parts: [{ text: 'Hi ' }] } }] };
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\r\n\r\n`));
            // As fetch does: an abort errors the body with the signal's reason.
            call.init.signal!.addEventListener('abort', () =>
              controller.error(call.init.signal!.reason),
            );
          },
          cancel: onCancel,
        }),
        { status: 200 },
      );
    }

    it('stops when the caller leaves mid-answer: a cancellation, not a failure', async () => {
      respond((call) => openStream(call, () => undefined));
      const caller = new AbortController();
      const seen: AiChatDelta[] = [];
      const error = await failure(
        (async () => {
          for await (const delta of gemini.stream(request, caller.signal)) {
            seen.push(delta);
            caller.abort();
          }
        })(),
      );
      expect(seen).toEqual([{ type: 'text', text: 'Hi ' }]);
      expect(error.kind).toBe('cancelled');
      expect(error.countsAgainstModel).toBe(false);
    });

    it('closes the provider’s connection when the reader stops reading', async () => {
      let closed = false;
      respond((call) =>
        openStream(call, () => {
          closed = true;
        }),
      );
      for await (const delta of gemini.stream(request, live())) {
        expect(delta).toEqual({ type: 'text', text: 'Hi ' });
        break;
      }
      expect(closed).toBe(true);
    });
  });

  describe('health', () => {
    it('reads the configured model’s description: no generation, the key in the header', async () => {
      respond(() => json({ name: 'models/gemini-3.8-flash' }));
      expect(await gemini.health()).toEqual({ ok: true });
      expect(calls[0]!.url).toBe(`${BASE}/models/gemini-3.8-flash`);
      expect(calls[0]!.init.method ?? 'GET').toBe('GET');
      expect(headersOf(calls[0]!).get('x-goog-api-key')).toBe(KEY);
    });

    it('says what kind of problem there is, never the provider’s words', async () => {
      const cases: [Response | Error, string][] = [
        [
          json({ error: { code: 403, message: `Key ${KEY} refused` } }, 403),
          'The AI provider refused the key',
        ],
        [json({ error: { code: 404 } }, 404), 'The configured model is not available to this key'],
        [json({ error: { code: 429 } }, 429), 'The AI provider is at its limit for this key'],
        [json({ error: { code: 500 } }, 500), 'The AI provider answered with an error'],
        [new TypeError('fetch failed'), 'The AI provider could not be reached'],
      ];
      for (const [outcome, detail] of cases) {
        respond(() => {
          if (outcome instanceof Error) throw outcome;
          return outcome;
        });
        expect(await gemini.health()).toEqual({ ok: false, detail });
      }
      const unconfigured = new GeminiAiProvider({ ...config, GEMINI_API_KEY: '' });
      expect(await unconfigured.health()).toEqual({
        ok: false,
        detail: 'The AI provider is not configured',
      });
    });
  });

  describe('the key and the provider’s words stay where they belong', () => {
    it('never appear in a URL, an error, a log line, a result or the provider object itself', async () => {
      const leaky = {
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          // A provider message may echo a key or the question; none of it may travel.
          message: `API key ${KEY} not valid; prompt was "a learner's private question"`,
        },
      };
      const outcomes: (() => Response | Promise<Response>)[] = [
        () => json(answer('fine')),
        () => sse([answer('fine')]),
        () => json(leaky, 400),
        () => json({ error: { code: 401, message: `bad ${KEY}` } }, 401),
        () => json({ error: { code: 429, message: KEY } }, 429),
        () => json({ error: { code: 500, message: KEY } }, 500),
        () => new Response(`<html>${KEY}</html>`, { status: 200 }),
        () => {
          throw new TypeError(`fetch failed for ${KEY}`);
        },
      ];
      const seen: string[] = [];
      for (const outcome of outcomes) {
        respond(outcome);
        for (const call of [
          () => gemini.chat(request, live()),
          () => collect(gemini.stream(request, live())),
        ]) {
          try {
            seen.push(JSON.stringify(await call()));
          } catch (error) {
            const e = error as AiProviderError;
            seen.push(e.message, String(e.detail), String(e.stack), JSON.stringify(e), inspect(e));
          }
        }
      }
      seen.push(...calls.map((c) => c.url), JSON.stringify(logged), inspect(logged, { depth: 8 }));
      seen.push(JSON.stringify(gemini), inspect(gemini, { showHidden: true, depth: 8 }));
      for (const text of seen) {
        expect(text).not.toContain(KEY);
        expect(text).not.toContain('private question');
      }
      // The key went where it is needed: the header of every call, to the configured address.
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call.url.startsWith(`${BASE}/models/`)).toBe(true);
        expect(headersOf(call).get('x-goog-api-key')).toBe(KEY);
      }
    });
  });
});
