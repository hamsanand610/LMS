import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_ERROR_CODES, aiProviderCapabilitiesSchema } from '@lms/shared';
import type { AiChatDelta, AiChatRequest } from './ai-provider.js';
import {
  FAKE_EMBEDDING_MODEL,
  FAKE_MODEL,
  FakeAiProvider,
  fakeEmbedding,
} from './fake.provider.js';
import { NoneAiProvider } from './none.provider.js';

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

describe('AI providers (Phase 7A, ADR-0024)', () => {
  // No provider may reach the network in this phase: the global fetch is watched in every test.
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  afterEach(() => {
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockClear();
  });

  describe('none', () => {
    const none = new NoneAiProvider();

    it('refuses every call the same way, as unavailable', async () => {
      for (const call of [() => none.chat(), () => collect(none.stream()), () => none.embed()]) {
        await expect(call()).rejects.toMatchObject({
          status: 503,
          code: AI_ERROR_CODES.UNAVAILABLE,
        });
      }
    });

    it('reports itself as not ready, with nothing it can do', async () => {
      expect(await none.health()).toEqual({ ok: false, detail: 'No AI provider is configured' });
      expect(aiProviderCapabilitiesSchema.parse(none.capabilities())).toEqual({
        streaming: false,
        embeddings: false,
        structuredOutput: false,
        maxContextTokens: 0,
      });
    });
  });

  describe('fake', () => {
    const fake = new FakeAiProvider({ AI_MODEL: '' });

    it('answers the same request the same way, from the last thing the user wrote', async () => {
      const first = await fake.chat(request, live());
      const second = await fake.chat(request, live());
      expect(first).toEqual(second);
      expect(first).toEqual({
        text: 'Fake chat answer to: What is inheritance in Java?',
        model: FAKE_MODEL,
        finishReason: 'stop',
        usage: { inputTokens: 8, outputTokens: 9 },
      });
    });

    it('uses the model asked for, then the configured one', async () => {
      expect((await fake.chat({ ...request, model: 'chosen' }, live())).model).toBe('chosen');
      const configured = new FakeAiProvider({ AI_MODEL: 'configured' });
      expect((await configured.chat(request, live())).model).toBe('configured');
    });

    it('streams the same answer word by word, then the whole result once', async () => {
      const deltas = await collect(fake.stream(request, live()));
      const done = deltas.at(-1);
      expect(done?.type).toBe('done');
      const text = deltas
        .filter((d): d is Extract<AiChatDelta, { type: 'text' }> => d.type === 'text')
        .map((d) => d.text)
        .join('');
      expect(text).toBe((await fake.chat(request, live())).text);
      expect(deltas.filter((d) => d.type === 'done')).toHaveLength(1);
    });

    it('stops when the caller aborts', async () => {
      const controller = new AbortController();
      controller.abort(new Error('client went away'));
      await expect(fake.chat(request, controller.signal)).rejects.toThrow('client went away');
      await expect(collect(fake.stream(request, controller.signal))).rejects.toThrow(
        'client went away',
      );
    });

    it('paces its words when asked to (AI_FAKE_DELAY_MS), and stops mid-pause when the caller leaves', async () => {
      const paced = new FakeAiProvider({ AI_MODEL: '', AI_FAKE_DELAY_MS: 20 });
      const started = Date.now();
      const deltas = await collect(paced.stream(request, live()));
      const words = deltas.filter((d) => d.type === 'text').length;
      expect(Date.now() - started).toBeGreaterThanOrEqual(words * 10);
      expect(deltas).toEqual(await collect(fake.stream(request, live())));
      const controller = new AbortController();
      setTimeout(() => controller.abort(new Error('client went away')), 30);
      await expect(collect(paced.stream(request, controller.signal))).rejects.toThrow(
        'client went away',
      );
    });

    it('embeds offline and deterministically (Phase 8C): the same text, the same unit vector', async () => {
      expect(fake.capabilities().embeddings).toBe(true);
      const asked = { model: FAKE_EMBEDDING_MODEL, purpose: 'document' as const, dimension: 768 };
      const result = await fake.embed({ ...asked, texts: ['one', 'two', 'one'] }, live());
      expect(result.vectors[0]).toEqual(result.vectors[2]);
      expect(result.vectors[0]).not.toEqual(result.vectors[1]);
      for (const vector of result.vectors) {
        expect(vector).toHaveLength(768);
        expect(Math.hypot(...vector)).toBeCloseTo(1, 6);
      }
      expect(result.usage).toEqual({ inputTokens: 3, estimated: true });
      const small = await fake.embed({ ...asked, dimension: 16, texts: ['one'] }, live());
      expect(small.vectors[0]).toHaveLength(16);
      const again = await new FakeAiProvider({ AI_MODEL: '' }).embed(
        { ...asked, texts: ['one'] },
        live(),
      );
      expect(again.vectors[0]).toEqual(result.vectors[0]);
      const controller = new AbortController();
      controller.abort(new Error('client went away'));
      await expect(fake.embed({ ...asked, texts: ['one'] }, controller.signal)).rejects.toThrow(
        'client went away',
      );
    });

    it('embeds by the words a text holds (Phase 8D): shared words close, no words never zero', () => {
      const cosine = (a: string, b: string) => {
        const [x, y] = [fakeEmbedding(a, 768), fakeEmbedding(b, 768)];
        return x.reduce((sum, value, i) => sum + value * y[i]!, 0);
      };
      // The same words in any order, case or with the commonest words added: the same vector.
      expect(fakeEmbedding('Loops repeat a block', 768)).toEqual(
        fakeEmbedding('a BLOCK repeat loops', 768),
      );
      expect(fakeEmbedding('the loop', 768)).toEqual(fakeEmbedding('loop', 768));
      // Plurals and -ing meet their stem.
      expect(fakeEmbedding('classes', 768)).toEqual(fakeEmbedding('class', 768));
      expect(fakeEmbedding('inheriting', 768)).toEqual(fakeEmbedding('inherit', 768));
      // Words in common bring texts closer than none do.
      expect(
        cosine('subclass reuses superclass methods', 'how a subclass reuses methods'),
      ).toBeGreaterThan(cosine('subclass reuses superclass methods', 'tomato soup with basil'));
      // A text of no words still has a direction, and every vector has unit length.
      for (const text of ['...', '!!', 'one']) {
        expect(Math.hypot(...fakeEmbedding(text, 768))).toBeCloseTo(1, 9);
      }
      expect(fakeEmbedding('...', 768)).not.toEqual(fakeEmbedding('!!', 768));
    });

    it('is healthy, needs no key, and its capabilities fit the strict shape', async () => {
      expect(await fake.health()).toEqual({ ok: true });
      expect(() => aiProviderCapabilitiesSchema.parse(fake.capabilities())).not.toThrow();
    });
  });
});
