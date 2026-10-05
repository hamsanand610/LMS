import { inspect } from 'node:util';
import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AiEmbedRequest, AiProviderError } from './ai-provider.js';
import { GeminiAiProvider } from './gemini.provider.js';

/**
 * Gemini embeddings (Phase 8C; ADR-0035) against a stand-in for `fetch`: no test reaches the network.
 * The fixtures follow the Generative Language API: `models.batchEmbedContents`, a request per text
 * with its task type and output dimensionality at the top — where the live API honours them (the
 * external verification, 5 October 2026) — and again in `embedContentConfig`, where the discovery
 * document places them; the embeddings back in order with `usageMetadata.promptTokenCount`.
 */
const KEY = 'test-gemini-key-CANARY-8c42';
const BASE = 'https://generativelanguage.googleapis.com/v1';
const config = { GEMINI_API_KEY: KEY, GEMINI_BASE_URL: `${BASE}/`, AI_MODEL: 'gemini-3.8-flash' };
const MODEL = 'gemini-embedding-001';

const request: AiEmbedRequest = {
  texts: ['Inheritance reuses a class.', 'A loop repeats work.'],
  model: MODEL,
  purpose: 'document',
  dimension: 4,
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

const embeddings = (values: unknown[][], promptTokenCount?: number) =>
  json({
    embeddings: values.map((v) => ({ values: v })),
    ...(promptTokenCount === undefined ? {} : { usageMetadata: { promptTokenCount } }),
  });

const live = () => new AbortController().signal;

async function failure(promise: Promise<unknown>): Promise<AiProviderError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AiProviderError);
    return error as AiProviderError;
  }
  throw new Error('expected the call to fail');
}

describe('Gemini embeddings (Phase 8C)', () => {
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

  it('is one POST to batchEmbedContents of v1, the key in its header and nowhere else', async () => {
    respond(() =>
      embeddings(
        [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
        ],
        12,
      ),
    );
    await gemini.embed(request, live());
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.url).toBe(`${BASE}/models/${MODEL}:batchEmbedContents`);
    expect(call!.url).not.toContain(KEY);
    expect(call!.init.method).toBe('POST');
    expect(call!.init.redirect).toBe('error');
    expect(new Headers(call!.init.headers).get('x-goog-api-key')).toBe(KEY);
    expect(JSON.parse(String(call!.init.body))).toEqual({
      requests: request.texts.map((text) => ({
        model: `models/${MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: 4,
        embedContentConfig: {
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: 4,
          autoTruncate: false,
        },
      })),
    });
  });

  it('asks for a question as a query, and for the dimension it is told', async () => {
    respond(() => embeddings([[0, 0, 0, 0, 0, 0, 0, 1]]));
    await gemini.embed(
      { ...request, texts: ['What is inheritance?'], purpose: 'query', dimension: 8 },
      live(),
    );
    const body = JSON.parse(String(calls[0]!.init.body)) as {
      requests: {
        taskType: string;
        outputDimensionality: number;
        embedContentConfig: { taskType: string; outputDimensionality: number };
      }[];
    };
    // At the top, where the live API honours them, and in the config the discovery document names.
    expect(body.requests[0]).toMatchObject({
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: 8,
      embedContentConfig: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: 8 },
    });
  });

  it('cuts a full-size 3,072-value vector of gemini-embedding-001 to the 768 asked, and renormalises it (8F)', async () => {
    // Gemini's full output, its first 768 values not at unit length on their own.
    const full = Array.from({ length: 3072 }, (_, i) => (i < 768 ? 0.5 : 0.01) * (i % 2 ? -1 : 1));
    respond(() => embeddings([full]));
    const result = await gemini.embed({ ...request, texts: ['A loop.'], dimension: 768 }, live());
    const [vector] = result.vectors;
    expect(vector).toHaveLength(768);
    expect(Math.hypot(...vector!)).toBeCloseTo(1, 10);
    // The direction of the first 768 values, and nothing of the rest.
    const head = full.slice(0, 768);
    const norm = Math.hypot(...head);
    expect(vector!.every((value, i) => Math.abs(value - head[i]! / norm) < 1e-12)).toBe(true);
    // A reduced vector, as asked, is renormalised too: Gemini leaves it unnormalised.
    respond(() => embeddings([Array.from({ length: 768 }, () => 0.02)]));
    const asked = await gemini.embed({ ...request, texts: ['A loop.'], dimension: 768 }, live());
    expect(asked.vectors[0]).toHaveLength(768);
    expect(Math.hypot(...asked.vectors[0]!)).toBeCloseTo(1, 10);
  });

  it('refuses a vector shorter than the 768 asked, any other length, and a full-size vector of a model it cannot cut (8F)', async () => {
    const ask = { ...request, texts: ['A loop.'], dimension: 768 };
    for (const length of [767, 1, 769, 1536, 3071, 3073]) {
      respond(() => embeddings([Array.from({ length }, () => 0.1)]));
      const error = await failure(gemini.embed(ask, live()));
      expect(error.kind, String(length)).toBe('malformed');
      expect(error.diagnostics.reason, String(length)).toBe('WRONG_DIMENSION');
    }
    // Only gemini-embedding-001's full size is known to be its reduced outputs' source.
    respond(() => embeddings([Array.from({ length: 3072 }, () => 0.1)]));
    const other = await failure(gemini.embed({ ...ask, model: 'gemini-embedding-002' }, live()));
    expect(other.diagnostics.reason).toBe('WRONG_DIMENSION');
  });

  it('gives each vector at unit length, in order, with Gemini’s own token count', async () => {
    respond(() =>
      embeddings(
        [
          [3, 0, 4, 0],
          [0, 2, 0, 0],
        ],
        12,
      ),
    );
    const result = await gemini.embed(request, live());
    expect(result).toEqual({
      vectors: [
        [0.6, 0, 0.8, 0],
        [0, 1, 0, 0],
      ],
      model: MODEL,
      usage: { inputTokens: 12 },
    });
  });

  it('estimates the tokens, and says so, when Gemini reports none', async () => {
    respond(() =>
      embeddings([
        [1, 0, 0, 0],
        [0, 1, 0, 0],
      ]),
    );
    const result = await gemini.embed(request, live());
    const estimate = request.texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
    expect(result.usage).toEqual({ inputTokens: estimate, estimated: true });
  });

  it('refuses what is not a vector of the dimension asked, for each text, as malformed', async () => {
    const cases: [() => Response, string][] = [
      [
        () =>
          embeddings([
            [1, 0, 0],
            [0, 1, 0],
          ]),
        'WRONG_DIMENSION',
      ],
      [() => embeddings([[1, 0, 0, 0]]), 'VECTOR_COUNT'],
      [
        () =>
          embeddings([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
          ]),
        'VECTOR_COUNT',
      ],
      [
        () =>
          embeddings([
            [1, 0, 0, 0],
            [0, 'x', 0, 0],
          ]),
        'INVALID_VECTOR_VALUE',
      ],
      [
        () =>
          embeddings([
            [1, 0, 0, 0],
            [0, null, 0, 0],
          ]),
        'INVALID_VECTOR_VALUE',
      ],
      [
        () =>
          embeddings([
            [1, 0, 0, 0],
            [0, 0, 0, 0],
          ]),
        'ZERO_VECTOR',
      ],
      [() => json({ embeddings: [{ values: [1, 0, 0, 0] }, {}] }), 'WRONG_DIMENSION'],
      [() => json({ nothing: true }), 'NOT_EMBEDDINGS'],
      [() => new Response('<html>not json</html>', { status: 200 }), 'NOT_JSON'],
    ];
    for (const [answer, reason] of cases) {
      respond(answer);
      const error = await failure(gemini.embed(request, live()));
      expect(error.kind, reason).toBe('malformed');
      expect(error.diagnostics.reason, reason).toBe(reason);
    }
  });

  it('fails in SI Academy’s words: limits, refusals, keys, models and outages', async () => {
    const cases: [() => Response, AiProviderError['kind']][] = [
      [
        () =>
          json(
            {
              error: {
                code: 429,
                status: 'RESOURCE_EXHAUSTED',
                details: [{ retryDelay: '21s' }],
              },
            },
            429,
          ),
        'rate_limited',
      ],
      [() => json({ error: { code: 400, status: 'INVALID_ARGUMENT' } }, 400), 'bad_request'],
      [() => json({ error: { code: 401, status: 'UNAUTHENTICATED' } }, 401), 'auth'],
      [() => json({ error: { code: 404, status: 'NOT_FOUND' } }, 404), 'configuration'],
      [() => json({ error: { code: 503, status: 'UNAVAILABLE' } }, 503), 'unavailable'],
      [() => json({ error: { code: 504, status: 'DEADLINE_EXCEEDED' } }, 504), 'timeout'],
    ];
    for (const [answer, kind] of cases) {
      respond(answer);
      expect((await failure(gemini.embed(request, live()))).kind).toBe(kind);
    }
    respond(cases[0]![0]);
    expect((await failure(gemini.embed(request, live()))).diagnostics.retryAfterSeconds).toBe(21);
  });

  it('makes no call for no texts, and none for a model code that is not one', async () => {
    respond(() => embeddings([]));
    expect(await gemini.embed({ ...request, texts: [] }, live())).toEqual({
      vectors: [],
      model: MODEL,
      usage: { inputTokens: 0 },
    });
    const error = await failure(gemini.embed({ ...request, model: '../other' }, live()));
    expect(error.kind).toBe('configuration');
    expect(calls).toHaveLength(0);
  });

  it('stops when the caller has gone', async () => {
    respond(
      (call) =>
        new Promise<Response>((_, reject) => {
          const signal = call.init.signal!;
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );
    const controller = new AbortController();
    const pending = gemini.embed(request, controller.signal);
    controller.abort(new Error('client went away'));
    expect((await failure(pending)).kind).toBe('cancelled');
  });

  it('never lets the key or the provider’s words into an error, a log line or a result', async () => {
    const outcomes: (() => Response)[] = [
      () =>
        embeddings(
          [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
          ],
          3,
        ),
      () =>
        json(
          {
            error: {
              code: 400,
              message: `API key ${KEY} not valid; text was "${request.texts[0]}"`,
            },
          },
          400,
        ),
      () => json({ error: { code: 401, message: `bad ${KEY}` } }, 401),
      () => json({ error: { code: 429, message: KEY } }, 429),
      () => new Response(`<html>${KEY}</html>`, { status: 200 }),
      () => {
        throw new TypeError(`fetch failed for ${KEY}`);
      },
    ];
    const seen: string[] = [];
    for (const outcome of outcomes) {
      respond(outcome);
      try {
        seen.push(JSON.stringify(await gemini.embed(request, live())));
      } catch (error) {
        const e = error as AiProviderError;
        seen.push(e.message, String(e.detail), String(e.stack), JSON.stringify(e), inspect(e));
      }
    }
    seen.push(...calls.map((c) => c.url), JSON.stringify(logged), inspect(logged, { depth: 8 }));
    seen.push(JSON.stringify(gemini), inspect(gemini, { showHidden: true, depth: 8 }));
    for (const text of seen) {
      expect(text).not.toContain(KEY);
      expect(text).not.toContain('text was');
    }
  });
});
