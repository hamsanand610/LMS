import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_ERROR_CODES, aiProviderCapabilitiesSchema } from '@lms/shared';
import type { AiChatDelta, AiChatRequest } from './ai-provider.js';
import { FAKE_MODEL, FakeAiProvider } from './fake.provider.js';
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

    it('does not pretend to embed: that belongs to Phase 8 (ADR-0027)', async () => {
      expect(fake.capabilities().embeddings).toBe(false);
      await expect(fake.embed()).rejects.toMatchObject({ code: AI_ERROR_CODES.UNAVAILABLE });
    });

    it('is healthy, needs no key, and its capabilities fit the strict shape', async () => {
      expect(await fake.health()).toEqual({ ok: true });
      expect(() => aiProviderCapabilitiesSchema.parse(fake.capabilities())).not.toThrow();
    });
  });
});
