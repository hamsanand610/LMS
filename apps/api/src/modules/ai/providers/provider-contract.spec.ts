import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiProviderCapabilitiesSchema } from '@lms/shared';
import { envSchema } from '../../../core/config/env.js';
import {
  AI_FINISH_REASONS,
  type AiChatDelta,
  type AiChatRequest,
  type AiProvider,
} from './ai-provider.js';
import { FAKE_EMBEDDING_MODEL, FakeAiProvider, fakeEmbedding } from './fake.provider.js';
import { GeminiAiProvider } from './gemini.provider.js';
import { NoneAiProvider } from './none.provider.js';
import { createAiProvider } from './provider.factory.js';

/**
 * The contract every provider keeps (ADR-0024): the Gemini adapter passes the same tests as the
 * fake. Gemini answers here from a stand-in for `fetch` that follows its wire format and honours
 * aborts as fetch does; nothing reaches the network.
 */
const KEY = 'contract-test-key-0000';

/** A deterministic Gemini: echoes the last question, whole or as events, word by word. */
function geminiStandIn() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const signal = init?.signal ?? undefined;
    if (signal?.aborted) return Promise.reject(signal.reason);
    const url = String(input);
    // Embeddings (Phase 8C): one vector per request, of the dimension asked, left unnormalised as
    // gemini-embedding-001 leaves a reduced dimension — the adapter must scale each to unit length.
    if (url.endsWith(':batchEmbedContents')) {
      const asked = JSON.parse(String(init?.body)) as {
        requests: {
          content: { parts: { text: string }[] };
          embedContentConfig: { outputDimensionality: number };
        }[];
      };
      return Promise.resolve(
        Response.json({
          embeddings: asked.requests.map((r) => ({
            values: fakeEmbedding(
              r.content.parts.map((p) => p.text).join(''),
              r.embedContentConfig.outputDimensionality,
            ).map((value) => value * 3),
          })),
          usageMetadata: { promptTokenCount: 7 * asked.requests.length },
        }),
      );
    }
    // The model's description (health): no generation.
    if (!/:(stream)?[gG]enerateContent/.test(url)) {
      return Promise.resolve(Response.json({ name: 'models/gemini-3.8-flash' }));
    }
    const body = JSON.parse(String(init?.body)) as {
      contents: { role: string; parts: { text: string }[] }[];
    };
    const question = body.contents
      .filter((c) => c.role === 'user')
      .at(-1)!
      .parts.map((p) => p.text)
      .join(' ');
    const text = `Gemini answer to: ${question}`;
    const usage = { promptTokenCount: 10, candidatesTokenCount: 5 };
    if (url.endsWith(':generateContent')) {
      return Promise.resolve(
        Response.json({
          candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
          usageMetadata: usage,
        }),
      );
    }
    const words = text.split(/(?<= )/);
    const events = words.map((word, i) => ({
      candidates: [
        {
          content: { role: 'model', parts: [{ text: word }] },
          ...(i === words.length - 1 ? { finishReason: 'STOP' } : {}),
        },
      ],
      ...(i === words.length - 1 ? { usageMetadata: usage } : {}),
    }));
    const encoder = new TextEncoder();
    return Promise.resolve(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            for (const event of events) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\r\n\r\n`));
            }
            controller.close();
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      ),
    );
  });
}

const request: AiChatRequest = {
  task: 'chat',
  messages: [
    { role: 'system', content: 'You help learners.' },
    { role: 'user', content: 'What is inheritance in Java?' },
  ],
};

const live = () => new AbortController().signal;

async function collect(stream: AsyncIterable<AiChatDelta>): Promise<AiChatDelta[]> {
  const out: AiChatDelta[] = [];
  for await (const delta of stream) out.push(delta);
  return out;
}

const providers: [string, () => AiProvider][] = [
  ['fake', () => new FakeAiProvider({ AI_MODEL: '' })],
  [
    'gemini',
    () =>
      new GeminiAiProvider({
        GEMINI_API_KEY: KEY,
        GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1',
        AI_MODEL: 'gemini-3.8-flash',
      }),
  ],
];

describe.each(providers)('the AiProvider contract: %s', (name, make) => {
  let provider: AiProvider;
  beforeEach(() => {
    if (name === 'gemini') geminiStandIn();
    provider = make();
  });
  afterEach(() => vi.restoreAllMocks());

  it('answers with a result in SI Academy’s terms', async () => {
    const result = await provider.chat(request, live());
    expect(result.text).toContain('What is inheritance in Java?');
    expect(typeof result.model).toBe('string');
    expect(AI_FINISH_REASONS).toContain(result.finishReason);
    expect(Number.isInteger(result.usage.inputTokens) && result.usage.inputTokens >= 0).toBe(true);
    expect(Number.isInteger(result.usage.outputTokens) && result.usage.outputTokens >= 0).toBe(
      true,
    );
    expect(Object.keys(result).sort()).toEqual(['finishReason', 'model', 'text', 'usage']);
  });

  it('answers the same request the same way', async () => {
    expect(await provider.chat(request, live())).toEqual(await provider.chat(request, live()));
  });

  it('streams text, then the whole result exactly once, matching what was streamed', async () => {
    const deltas = await collect(provider.stream(request, live()));
    const done = deltas.filter((d) => d.type === 'done');
    expect(done).toHaveLength(1);
    expect(deltas.at(-1)?.type).toBe('done');
    const text = deltas.map((d) => (d.type === 'text' ? d.text : '')).join('');
    expect(text).toBe(done[0]!.type === 'done' ? done[0]!.result.text : '');
    expect(text).toBe((await provider.chat(request, live())).text);
  });

  it('stops when the caller has gone', async () => {
    const controller = new AbortController();
    controller.abort(new Error('client went away'));
    await expect(provider.chat(request, controller.signal)).rejects.toBeDefined();
    await expect(collect(provider.stream(request, controller.signal))).rejects.toBeDefined();
  });

  it('embeds: one unit vector per text, of the dimension asked, the same text alike (Phase 8C)', async () => {
    expect(provider.capabilities().embeddings).toBe(true);
    const model = provider.name === 'gemini' ? 'gemini-embedding-001' : FAKE_EMBEDDING_MODEL;
    const texts = [
      'Inheritance reuses a class.',
      'A loop repeats work.',
      'Inheritance reuses a class.',
    ];
    const result = await provider.embed(
      { texts, model, purpose: 'document', dimension: 768 },
      live(),
    );
    expect(result.model).toBe(model);
    expect(result.vectors).toHaveLength(texts.length);
    for (const vector of result.vectors) {
      expect(vector).toHaveLength(768);
      expect(Math.hypot(...vector)).toBeCloseTo(1, 6);
    }
    expect(result.vectors[0]).toEqual(result.vectors[2]);
    expect(result.vectors[0]).not.toEqual(result.vectors[1]);
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    const controller = new AbortController();
    controller.abort(new Error('client went away'));
    await expect(
      provider.embed({ texts, model, purpose: 'document', dimension: 768 }, controller.signal),
    ).rejects.toBeDefined();
  });

  it('describes what it can do in the strict shape, and reports its health without detail', async () => {
    expect(() => aiProviderCapabilitiesSchema.parse(provider.capabilities())).not.toThrow();
    expect(provider.capabilities().streaming).toBe(true);
    const health = await provider.health();
    expect(health).toEqual({ ok: true });
  });
});

describe('choosing the provider (ADR-0024)', () => {
  const REQUIRED = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'x'.repeat(40),
  };

  it('builds only the configured one: none by default, the fake, or Gemini', () => {
    vi.spyOn(globalThis, 'fetch');
    expect(createAiProvider(envSchema.parse(REQUIRED))).toBeInstanceOf(NoneAiProvider);
    expect(createAiProvider(envSchema.parse({ ...REQUIRED, AI_PROVIDER: 'fake' }))).toBeInstanceOf(
      FakeAiProvider,
    );
    const gemini = createAiProvider(
      envSchema.parse({
        ...REQUIRED,
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: KEY,
        AI_MODEL: 'gemini-3.8-flash',
      }),
    );
    expect(gemini).toBeInstanceOf(GeminiAiProvider);
    expect(gemini.name).toBe('gemini');
    // Building a provider calls nothing.
    expect(globalThis.fetch).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
