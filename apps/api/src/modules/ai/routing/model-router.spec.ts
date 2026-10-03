import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_ERROR_CODES, type AiProviderCapabilities, type AiProviderName } from '@lms/shared';
import { type AppConfig, envSchema } from '../../../core/config/env.js';
import {
  type AiChatDelta,
  type AiChatRequest,
  type AiChatResult,
  type AiProvider,
  AiProviderError,
  AiUnavailableError,
} from '../providers/ai-provider.js';
import { FAKE_MODEL, FakeAiProvider } from '../providers/fake.provider.js';
import { NoneAiProvider } from '../providers/none.provider.js';
import { AiCircuitBreakers } from './circuit-breaker.js';
import { AI_MODEL_REGISTRY, type AiModelSpec } from './model-registry.js';
import {
  type AiAttempt,
  type AiRoutedChatRequest,
  type AiRoutedDelta,
  ModelRouter,
} from './model-router.js';

const REQUIRED = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
};
const configWith = (env: Record<string, string>): AppConfig =>
  envSchema.parse({ ...REQUIRED, ...env });
const gemini = (env: Record<string, string> = {}) =>
  configWith({
    AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'router-test-key-0000',
    AI_MODEL: 'gemini-3.8-flash',
    ...env,
  });
const MAIN = 'gemini-3.8-flash';
const LITE = 'gemini-3.5-flash-lite';

type Script = (request: AiChatRequest, signal: AbortSignal) => Promise<AiChatResult>;
type StreamScript = (request: AiChatRequest, signal: AbortSignal) => AsyncIterable<AiChatDelta>;

/** A provider whose every answer the test decides; it records what it was asked. */
class StubProvider implements AiProvider {
  readonly calls: AiChatRequest[] = [];

  constructor(
    readonly name: AiProviderName,
    private readonly script: Script,
    private readonly streamScript?: StreamScript,
  ) {}

  capabilities(): AiProviderCapabilities {
    return { streaming: true, embeddings: false, structuredOutput: false, maxContextTokens: 1 };
  }

  chat(request: AiChatRequest, signal: AbortSignal): Promise<AiChatResult> {
    this.calls.push(request);
    return this.script(request, signal);
  }

  async *stream(request: AiChatRequest, signal: AbortSignal): AsyncGenerator<AiChatDelta> {
    this.calls.push(request);
    if (this.streamScript) {
      yield* this.streamScript(request, signal);
      return;
    }
    const result = await this.script(request, signal);
    for (const piece of result.text.split(/(?<= )/)) yield { type: 'text', text: piece };
    yield { type: 'done', result };
  }

  embed(): Promise<never> {
    return Promise.reject(new AiUnavailableError());
  }

  health(): Promise<{ ok: boolean }> {
    return Promise.resolve({ ok: true });
  }
}

const ok = (request: AiChatRequest, text = `Answer from ${request.model}`): AiChatResult => ({
  text,
  model: request.model ?? '?',
  finishReason: 'stop',
  usage: { inputTokens: 10, outputTokens: 4 },
});
const answers: Script = (request) => Promise.resolve(ok(request));
const failsWith =
  (kind: AiProviderError['kind'], models: ReadonlySet<string> = new Set([MAIN])): Script =>
  (request) =>
    models.has(request.model!)
      ? Promise.reject(new AiProviderError(kind, { httpStatus: 503 }))
      : Promise.resolve(ok(request));
/** Never answers; rejects as a provider does when its signal aborts. */
const hangs = (_: AiChatRequest, signal: AbortSignal) =>
  new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

function routerFor(
  config: AppConfig,
  provider: AiProvider,
  registry: readonly AiModelSpec[] = AI_MODEL_REGISTRY,
) {
  let now = 0;
  const circuits = new AiCircuitBreakers({ failureThreshold: 2, cooldownMs: 1000, now: () => now });
  const router = new ModelRouter(config, provider, registry, circuits);
  return { router, advance: (ms: number) => (now += ms) };
}

const ask = (overrides: Partial<AiRoutedChatRequest> = {}): AiRoutedChatRequest => ({
  task: 'chat',
  feature: 'workspace',
  dataClass: 'public',
  userId: 'user-1',
  organizationId: 'org-1',
  messages: [{ role: 'user', content: 'What is a class?' }],
  ...overrides,
});
const live = () => new AbortController().signal;

async function collect(stream: AsyncIterable<AiRoutedDelta>): Promise<AiRoutedDelta[]> {
  const out: AiRoutedDelta[] = [];
  for await (const delta of stream) out.push(delta);
  return out;
}

describe('the model router (Phase 7B)', () => {
  let logged: unknown[][];
  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
  });
  afterEach(() => vi.restoreAllMocks());

  describe('routing', () => {
    it('sends each task to its own model, else AI_MODEL, and says who answered', async () => {
      const provider = new StubProvider('gemini', answers);
      const { router } = routerFor(gemini({ AI_TASK_MODELS: `title=${LITE}` }), provider);
      const chat = await router.chat(ask(), live());
      await router.chat(ask({ task: 'title' }), live());
      expect(provider.calls.map((c) => c.model)).toEqual([MAIN, LITE]);
      expect(chat).toMatchObject({
        text: `Answer from ${MAIN}`,
        model: MAIN,
        provider: 'gemini',
        fallback: false,
        finishReason: 'stop',
        estimatedCostUsd: null,
      });
      expect(chat.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('caps the output at the model’s limit, and refuses what cannot fit its input', async () => {
      const provider = new StubProvider('gemini', answers);
      const { router } = routerFor(gemini(), provider);
      await router.chat(ask({ maxOutputTokens: 1_000_000 }), live());
      await router.chat(ask({ maxOutputTokens: 300 }), live());
      expect(provider.calls.map((c) => c.maxOutputTokens)).toEqual([65_536, 300]);
      const tooLong = ask({ messages: [{ role: 'user', content: 'x'.repeat(4 * 1_048_576 + 8) }] });
      await expect(router.chat(tooLong, live())).rejects.toMatchObject({
        kind: 'bad_request',
        diagnostics: { reason: 'CONTEXT_TOO_LARGE' },
      });
      expect(provider.calls).toHaveLength(2);
    });

    it('with no provider, answers unavailable and calls nothing', async () => {
      const none = new NoneAiProvider();
      const chat = vi.spyOn(none, 'chat');
      const { router } = routerFor(configWith({}), none);
      expect(router.configured).toBe(false);
      expect(router.serviceState()).toBe('off');
      await expect(router.chat(ask(), live())).rejects.toBeInstanceOf(AiUnavailableError);
      await expect(collect(router.stream(ask(), live()))).rejects.toMatchObject({
        status: 503,
        code: AI_ERROR_CODES.UNAVAILABLE,
      });
      expect(chat).not.toHaveBeenCalled();
    });

    it('never sends restricted data, and other classes only once the deployment approves them', async () => {
      const provider = new StubProvider('gemini', answers);
      const { router: publicOnly } = routerFor(gemini(), provider);
      for (const dataClass of ['restricted', 'personal', 'course'] as const) {
        await expect(publicOnly.chat(ask({ dataClass }), live()), dataClass).rejects.toMatchObject({
          status: 503,
          code: AI_ERROR_CODES.UNAVAILABLE,
        });
      }
      expect(provider.calls).toHaveLength(0);
      await publicOnly.chat(ask({ dataClass: 'public' }), live());

      const { router: approved } = routerFor(
        gemini({ AI_DATA_CLASSES: 'public,course,personal' }),
        provider,
      );
      await approved.chat(ask({ dataClass: 'personal' }), live());
      await expect(approved.chat(ask({ dataClass: 'restricted' }), live())).rejects.toBeInstanceOf(
        AiUnavailableError,
      );
      expect(provider.calls).toHaveLength(2);
      expect(JSON.stringify(logged)).toContain('"reason":"restricted_data"');
    });

    it('refuses a capability the model lacks, before any call — or at start-up', async () => {
      const provider = new StubProvider('gemini', answers);
      const noStreaming = AI_MODEL_REGISTRY.map((m) =>
        m.id === MAIN ? { ...m, streaming: false } : m,
      );
      const { router } = routerFor(gemini(), provider, noStreaming);
      await expect(collect(router.stream(ask(), live()))).rejects.toMatchObject({
        code: AI_ERROR_CODES.UNAVAILABLE,
      });
      expect(provider.calls).toHaveLength(0);
      await router.chat(ask(), live());

      const noHints = AI_MODEL_REGISTRY.map((m) =>
        m.id === MAIN ? { ...m, tasks: m.tasks.filter((t) => t !== 'hint') } : m,
      );
      expect(() => routerFor(gemini(), provider, noHints)).toThrow(
        /gemini-3\.8-flash does not handle the hint task/,
      );
    });

    it('adds the configured price to the answer (ADR-0029)', async () => {
      const provider = new StubProvider('gemini', answers);
      const { router } = routerFor(gemini({ AI_MODEL_COSTS: `${MAIN}=0.50/3.00` }), provider);
      const result = await router.chat(ask(), live());
      expect(result.estimatedCostUsd).toBeCloseTo((10 * 0.5 + 4 * 3) / 1_000_000, 12);
    });
  });

  describe('fallback', () => {
    it('lets the same provider’s fallback model answer when the task’s model is overloaded or at its limit', async () => {
      for (const kind of ['unavailable', 'rate_limited'] as const) {
        const provider = new StubProvider('gemini', failsWith(kind));
        const { router } = routerFor(gemini({ AI_FALLBACK_MODEL: LITE }), provider);
        const result = await router.chat(ask(), live());
        expect(result, kind).toMatchObject({ model: LITE, fallback: true, provider: 'gemini' });
        expect(provider.calls.map((c) => c.model)).toEqual([MAIN, LITE]);
      }
    });

    it('does not fall back on a key, configuration, request or unreadable-answer failure', async () => {
      for (const kind of ['auth', 'configuration', 'bad_request', 'malformed'] as const) {
        const provider = new StubProvider('gemini', failsWith(kind));
        const { router } = routerFor(gemini({ AI_FALLBACK_MODEL: LITE }), provider);
        await expect(router.chat(ask(), live()), kind).rejects.toMatchObject({
          kind,
          target: { provider: 'gemini', model: MAIN },
        });
        expect(provider.calls.map((c) => c.model)).toEqual([MAIN]);
      }
    });

    it('never stitches a streamed answer from two models', async () => {
      const halfThenFail: StreamScript = async function* (request) {
        if (request.model === MAIN) {
          yield { type: 'text', text: 'Half ' };
          throw new AiProviderError('unavailable');
        }
        yield { type: 'text', text: 'Whole' };
        yield { type: 'done', result: ok(request, 'Whole') };
      };
      const provider = new StubProvider('gemini', answers, halfThenFail);
      const { router } = routerFor(gemini({ AI_FALLBACK_MODEL: LITE }), provider);
      const seen: AiRoutedDelta[] = [];
      await expect(
        (async () => {
          for await (const delta of router.stream(ask(), live())) seen.push(delta);
        })(),
      ).rejects.toMatchObject({ kind: 'unavailable' });
      expect(seen).toEqual([{ type: 'text', text: 'Half ' }]);
      expect(provider.calls.map((c) => c.model)).toEqual([MAIN]);
    });

    it('lets the fallback stream the whole answer when the task’s model failed before writing', async () => {
      const provider = new StubProvider('gemini', failsWith('unavailable'));
      const { router } = routerFor(gemini({ AI_FALLBACK_MODEL: LITE }), provider);
      const deltas = await collect(router.stream(ask(), live()));
      expect(deltas.at(-1)).toMatchObject({
        type: 'done',
        result: { model: LITE, fallback: true },
      });
      expect(deltas.map((d) => (d.type === 'text' ? d.text : '')).join('')).toBe(
        `Answer from ${LITE}`,
      );
    });

    it('never falls back to the fake, and has no other provider to reach', () => {
      const provider = new StubProvider('gemini', answers);
      expect(() => routerFor(gemini({ AI_FALLBACK_MODEL: FAKE_MODEL }), provider)).toThrow(
        /AI_FALLBACK_MODEL names "fake-1", which the model registry does not list for gemini/,
      );
      // The router calls the one provider the process built, and it must be the configured one.
      expect(() => routerFor(gemini(), new FakeAiProvider({ AI_MODEL: '' }))).toThrow(
        /the provider built \(fake\) is not AI_PROVIDER \(gemini\)/,
      );
    });
  });

  describe('circuits', () => {
    it('rests a failing model and answers from the fallback, then probes the model once', async () => {
      const failing = new Set([MAIN]);
      const provider = new StubProvider('gemini', failsWith('unavailable', failing));
      const { router, advance } = routerFor(gemini({ AI_FALLBACK_MODEL: LITE }), provider);
      expect(router.serviceState()).toBe('ready');
      await router.chat(ask(), live());
      await router.chat(ask(), live());
      expect(router.serviceState()).toBe('degraded');
      expect(JSON.stringify(logged)).toContain('AI model resting after repeated failures');

      provider.calls.length = 0;
      expect(await router.chat(ask(), live())).toMatchObject({ model: LITE, fallback: true });
      expect(provider.calls.map((c) => c.model)).toEqual([LITE]);

      advance(1000);
      failing.clear();
      provider.calls.length = 0;
      expect(await router.chat(ask(), live())).toMatchObject({ model: MAIN, fallback: false });
      expect(provider.calls.map((c) => c.model)).toEqual([MAIN]);
      expect(router.serviceState()).toBe('ready');
      expect(JSON.stringify(logged)).toContain('AI model answering again');
    });

    it('says busy without calling a resting model when there is no fallback', async () => {
      const provider = new StubProvider('gemini', failsWith('unavailable'));
      const { router } = routerFor(gemini(), provider);
      for (let i = 0; i < 2; i += 1) {
        await expect(router.chat(ask(), live())).rejects.toMatchObject({ kind: 'unavailable' });
      }
      expect(router.serviceState()).toBe('unavailable');
      await expect(router.chat(ask(), live())).rejects.toMatchObject({
        kind: 'circuit_open',
        status: 503,
        code: AI_ERROR_CODES.BUSY,
      });
      expect(provider.calls).toHaveLength(2);
    });
  });

  describe('deadline and cancellation', () => {
    it('abandons a call that outlives AI_TIMEOUT_MS — whole or streamed — and counts it against the model', async () => {
      const slowStream: StreamScript = async function* (request, signal) {
        yield { type: 'text', text: 'Slow ' };
        await hangs(request, signal);
      };
      const provider = new StubProvider('gemini', hangs, slowStream);
      const { router } = routerFor({ ...gemini(), AI_TIMEOUT_MS: 50 }, provider);
      await expect(router.chat(ask(), live())).rejects.toMatchObject({
        kind: 'timeout',
        status: 504,
        code: AI_ERROR_CODES.TIMEOUT,
      });
      const seen: AiRoutedDelta[] = [];
      await expect(
        (async () => {
          for await (const delta of router.stream(ask(), live())) seen.push(delta);
        })(),
      ).rejects.toMatchObject({ kind: 'timeout' });
      expect(seen).toEqual([{ type: 'text', text: 'Slow ' }]);
      expect(router.serviceState()).toBe('unavailable');
    });

    it('treats the caller leaving as theirs: cancelled, no failure counted, no fallback', async () => {
      const provider = new StubProvider('gemini', hangs);
      const { router } = routerFor(gemini({ AI_FALLBACK_MODEL: LITE }), provider);
      for (let i = 0; i < 3; i += 1) {
        const caller = new AbortController();
        setTimeout(() => caller.abort(), 5);
        await expect(router.chat(ask(), caller.signal)).rejects.toMatchObject({
          kind: 'cancelled',
        });
      }
      expect(router.serviceState()).toBe('ready');
      expect(provider.calls.map((c) => c.model)).toEqual([MAIN, MAIN, MAIN]);
    });

    it('turns any provider’s abort into a cancellation — the fake rejects with the raw reason', async () => {
      const { router } = routerFor(
        configWith({ AI_PROVIDER: 'fake' }),
        new FakeAiProvider({ AI_MODEL: '' }),
      );
      const gone = new AbortController();
      gone.abort(new Error('client went away'));
      await expect(router.chat(ask(), gone.signal)).rejects.toMatchObject({
        kind: 'cancelled',
        target: { provider: 'fake', model: FAKE_MODEL },
      });
      expect(await router.chat(ask(), live())).toMatchObject({
        provider: 'fake',
        model: FAKE_MODEL,
      });
    });

    it('frees a resting model’s probe when the reader stops early, without a verdict', async () => {
      const failing = new Set([MAIN]);
      const provider = new StubProvider('gemini', failsWith('unavailable', failing));
      const { router, advance } = routerFor(gemini(), provider);
      for (let i = 0; i < 2; i += 1) await router.chat(ask(), live()).catch(() => undefined);
      advance(1000);
      failing.clear();
      // The probe: a stream whose reader stops after the first words.
      for await (const delta of router.stream(ask(), live())) {
        expect(delta.type).toBe('text');
        break;
      }
      expect(router.serviceState()).not.toBe('ready');
      // The probe slot is free again: the next call may probe, and its answer closes the circuit.
      await router.chat(ask(), live());
      expect(router.serviceState()).toBe('ready');
      expect(JSON.stringify(logged)).toContain('AI call cancelled');
    });
  });

  describe('records', () => {
    it('logs every call with who, what and how it went — never the question, the answer or a key', async () => {
      const provider = new StubProvider('gemini', (request) =>
        request.task === 'hint'
          ? Promise.reject(
              new AiProviderError('unavailable', {
                httpStatus: 503,
                providerStatus: 'UNAVAILABLE',
              }),
            )
          : Promise.resolve(ok(request, 'The secret answer text')),
      );
      const { router } = routerFor(gemini(), provider);
      const question = [{ role: 'user' as const, content: 'My private question about my salary' }];
      await router.chat(ask({ messages: question }), live());
      await router
        .chat(ask({ task: 'hint', feature: 'lab_hints', messages: question }), live())
        .catch(() => undefined);
      const who = { dataClass: 'public', userId: 'user-1', organizationId: 'org-1' };
      expect(logged).toContainEqual([
        {
          ai: expect.objectContaining({
            ...who,
            provider: 'gemini',
            model: MAIN,
            task: 'chat',
            feature: 'workspace',
            outcome: 'ok',
            finishReason: 'stop',
            inputTokens: 10,
            outputTokens: 4,
            fallback: false,
          }),
        },
        'AI call',
      ]);
      expect(logged).toContainEqual([
        {
          ai: expect.objectContaining({
            ...who,
            task: 'hint',
            feature: 'lab_hints',
            outcome: 'unavailable',
            httpStatus: 503,
            providerStatus: 'UNAVAILABLE',
          }),
        },
        'AI call failed',
      ]);
      const text = JSON.stringify(logged);
      for (const secret of ['private question', 'secret answer', 'router-test-key-0000']) {
        expect(text).not.toContain(secret);
      }
    });
  });

  describe('what the gateway asks of it (Phase 7C)', () => {
    it('says whether, and why, it would refuse a request, without calling or logging anything', () => {
      const provider = new StubProvider('gemini', answers);
      const { router } = routerFor(gemini({ AI_DATA_CLASSES: 'public' }), provider);
      const ask = (dataClass: AiRoutedChatRequest['dataClass']) => ({
        task: 'chat' as const,
        feature: 'workspace' as const,
        dataClass,
        userId: 'user-1',
        organizationId: 'org-1',
      });
      expect(router.refusalFor(ask('public'), true)).toBeNull();
      expect(router.refusalFor(ask('personal'), true)).toBe('data_class_not_approved');
      expect(router.refusalFor(ask('course'), true)).toBe('data_class_not_approved');
      expect(router.refusalFor(ask('restricted'), true)).toBe('restricted_data');
      const noStreaming = AI_MODEL_REGISTRY.map((m) =>
        m.id === MAIN ? { ...m, streaming: false } : m,
      );
      expect(
        routerFor(gemini(), provider, noStreaming).router.refusalFor(ask('public'), true),
      ).toBe('streaming_not_supported');
      const none = routerFor(configWith({}), new NoneAiProvider()).router;
      expect(none.refusalFor(ask('public'))).toBe('not_configured');
      expect(provider.calls).toHaveLength(0);
      expect(logged).toEqual([]);
    });

    it('tells the caller of every call made — and only of calls made', async () => {
      const failing = new Set([MAIN]);
      const provider = new StubProvider('gemini', failsWith('unavailable', failing));
      const { router } = routerFor(gemini({ AI_FALLBACK_MODEL: LITE }), provider);
      const attempts: AiAttempt[] = [];
      await router.chat(ask({ onAttempt: (a) => attempts.push(a) }), live());
      expect(attempts).toEqual([
        expect.objectContaining({
          model: MAIN,
          outcome: 'unavailable',
          usage: null,
          fallback: false,
        }),
        expect.objectContaining({
          model: LITE,
          outcome: 'ok',
          fallback: true,
          usage: { inputTokens: 10, outputTokens: 4 },
        }),
      ]);

      // A resting model is not called, so it is not an attempt.
      await router.chat(ask(), live());
      attempts.length = 0;
      await router.chat(ask({ onAttempt: (a) => attempts.push(a) }), live());
      expect(attempts.map((a) => a.model)).toEqual([LITE]);
    });

    it('reports a stream the reader stopped as a cancelled call', async () => {
      const provider = new StubProvider('gemini', answers);
      const { router } = routerFor(gemini(), provider);
      const attempts: AiAttempt[] = [];
      for await (const delta of router.stream(
        ask({ onAttempt: (a) => attempts.push(a) }),
        live(),
      )) {
        expect(delta.type).toBe('text');
        break;
      }
      expect(attempts).toEqual([expect.objectContaining({ model: MAIN, outcome: 'cancelled' })]);
    });
  });
});
