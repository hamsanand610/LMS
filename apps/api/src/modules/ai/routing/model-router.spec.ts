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
import {
  AI_EMBEDDING_MODEL_REGISTRY,
  AI_MODEL_REGISTRY,
  type AiModelSpec,
} from './model-registry.js';
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
  fallbackProvider: AiProvider | null = null,
) {
  let now = 0;
  const circuits = new AiCircuitBreakers({ failureThreshold: 2, cooldownMs: 1000, now: () => now });
  const router = new ModelRouter(
    config,
    provider,
    registry,
    circuits,
    AI_EMBEDDING_MODEL_REGISTRY,
    fallbackProvider,
  );
  return { router, circuits, advance: (ms: number) => (now += ms) };
}

/** Groq standing in for Gemini (ADR-0038): the deployment approves course material as well. */
const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_KEY = 'router-test-groq-key-0000';
const withGroq = (env: Record<string, string> = {}) =>
  gemini({
    AI_FALLBACK_PROVIDER: 'groq',
    GROQ_API_KEY: GROQ_KEY,
    AI_FALLBACK_MODEL: GROQ_MODEL,
    AI_DATA_CLASSES: 'public,course,personal',
    ...env,
  });

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

    it('treats a streamed answer with no words as unreadable, never as a complete empty one', async () => {
      const silent: StreamScript = async function* (request) {
        yield { type: 'text', text: '  ' };
        yield { type: 'done', result: { ...ok(request, '  '), finishReason: 'stop' } };
      };
      const provider = new StubProvider('gemini', answers, silent);
      const { router } = routerFor(gemini(), provider);
      const attempts: AiAttempt[] = [];
      await expect(
        collect(router.stream(ask({ onAttempt: (attempt) => attempts.push(attempt) }), live())),
      ).rejects.toMatchObject({ kind: 'malformed', diagnostics: { reason: 'EMPTY_ANSWER' } });
      expect(attempts.map((attempt) => attempt.outcome)).toEqual(['malformed']);
      // A withheld answer is still the provider's verdict, not an unreadable one.
      const withheld: StreamScript = async function* (request) {
        yield { type: 'done', result: { ...ok(request, ''), finishReason: 'blocked' } };
      };
      const filtered = routerFor(gemini(), new StubProvider('gemini', answers, withheld));
      const deltas = await collect(filtered.router.stream(ask(), live()));
      expect(deltas.at(-1)).toMatchObject({ type: 'done', result: { finishReason: 'blocked' } });
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

    it('once its rest is over, lets exactly one probe through: a success closes the circuit, a failure rests the model again', async () => {
      let outcome: 'fail' | 'hold' | 'answer' = 'fail';
      const held: { release?: () => void } = {};
      const provider = new StubProvider('gemini', (request) => {
        if (outcome === 'fail') {
          return Promise.reject(new AiProviderError('unavailable', { httpStatus: 503 }));
        }
        if (outcome === 'hold') {
          return new Promise<AiChatResult>((resolve) => {
            held.release = () => resolve(ok(request));
          });
        }
        return Promise.resolve(ok(request));
      });
      const { router, circuits, advance } = routerFor(gemini(), provider);
      const busy = { kind: 'circuit_open', status: 503, code: AI_ERROR_CODES.BUSY };

      // 1. The circuit opens after the threshold of consecutive failures (two here).
      for (let i = 0; i < 2; i += 1) {
        await expect(router.chat(ask(), live())).rejects.toMatchObject({ kind: 'unavailable' });
      }
      expect(circuits.state('gemini', MAIN)).toBe('open');
      expect(router.serviceState()).toBe('unavailable');

      // 2. While the model rests, every call is refused before anything is sent.
      advance(999);
      await expect(router.chat(ask(), live())).rejects.toMatchObject(busy);
      await expect(collect(router.stream(ask(), live()))).rejects.toMatchObject(busy);
      expect(provider.calls).toHaveLength(2);

      // 3. Its rest over, the service takes a call again: one probe, and nothing beside it.
      advance(1);
      expect(circuits.state('gemini', MAIN)).toBe('half_open');
      expect(router.serviceState()).toBe('ready');
      outcome = 'hold';
      const probe = router.chat(ask(), live());
      expect(router.serviceState()).toBe('unavailable');
      await expect(router.chat(ask(), live())).rejects.toMatchObject(busy);
      await expect(collect(router.stream(ask(), live()))).rejects.toMatchObject(busy);
      expect(provider.calls).toHaveLength(3);

      // 4. The probe answers: the circuit closes, and calls go through again.
      held.release!();
      expect(await probe).toMatchObject({ model: MAIN, fallback: false });
      expect(circuits.state('gemini', MAIN)).toBe('closed');
      expect(router.serviceState()).toBe('ready');
      expect(JSON.stringify(logged)).toContain('AI model answering again');
      outcome = 'answer';
      await router.chat(ask(), live());
      expect(provider.calls).toHaveLength(4);

      // 5. A probe that fails rests the model again at once: one failure, not the threshold.
      outcome = 'fail';
      for (let i = 0; i < 2; i += 1) await router.chat(ask(), live()).catch(() => undefined);
      advance(1000);
      expect(router.serviceState()).toBe('ready');
      await expect(router.chat(ask(), live())).rejects.toMatchObject({ kind: 'unavailable' });
      expect(circuits.state('gemini', MAIN)).toBe('open');
      expect(router.serviceState()).toBe('unavailable');
      await expect(router.chat(ask(), live())).rejects.toMatchObject(busy);
      expect(provider.calls).toHaveLength(7);
    });

    it('counts a resting model as answering once its probe is free — the stand-in too — and none while every probe is out', () => {
      const { router, circuits, advance } = routerFor(
        gemini({ AI_FALLBACK_MODEL: LITE }),
        new StubProvider('gemini', answers),
      );
      const main = circuits.circuitOf('gemini', MAIN);
      const lite = circuits.circuitOf('gemini', LITE);
      for (const circuit of [main, lite, main, lite]) circuit.failed();
      expect(router.serviceState()).toBe('unavailable');
      advance(1000);
      expect(router.serviceState()).toBe('ready');
      // The task's model is on trial; the stand-in is free for its own probe.
      expect(main.tryAcquire()).toBe(true);
      expect(router.serviceState()).toBe('degraded');
      expect(lite.tryAcquire()).toBe(true);
      expect(router.serviceState()).toBe('unavailable');
      lite.succeeded();
      expect(router.serviceState()).toBe('degraded');
      main.succeeded();
      expect(router.serviceState()).toBe('ready');
    });
  });

  describe('Groq standing in for Gemini (ADR-0038)', () => {
    /** Gemini and Groq stand-ins, each answering as its script says. */
    const pair = (geminiScript: Script, groqScript: Script = answers, env = {}) => {
      const gemini = new StubProvider('gemini', geminiScript);
      const groq = new StubProvider('groq', groqScript);
      return { ...routerFor(withGroq(env), gemini, AI_MODEL_REGISTRY, groq), gemini, groq };
    };
    const groqFails = (kind: AiProviderError['kind']) => failsWith(kind, new Set([GROQ_MODEL]));

    it('builds only with the fallback provider the configuration names', () => {
      expect(() => routerFor(withGroq(), new StubProvider('gemini', answers))).toThrow(
        /the fallback provider built \(none\) is not AI_FALLBACK_PROVIDER \(groq\)/,
      );
      expect(() =>
        routerFor(
          gemini(),
          new StubProvider('gemini', answers),
          AI_MODEL_REGISTRY,
          new StubProvider('groq', answers),
        ),
      ).toThrow(/the fallback provider built \(groq\) is not AI_FALLBACK_PROVIDER \(none\)/);
    });

    it('lets Gemini answer, and calls Groq for nothing', async () => {
      const { router, gemini, groq } = pair(answers);
      expect(await router.chat(ask(), live())).toMatchObject({
        provider: 'gemini',
        model: MAIN,
        fallback: false,
      });
      expect(gemini.calls).toHaveLength(1);
      expect(groq.calls).toHaveLength(0);
      expect(router.serviceState()).toBe('ready');
    });

    it.each([
      ['unavailable (a 5xx, or the network)', 'unavailable'],
      ['at its limit or out of quota (429)', 'rate_limited'],
    ] as const)('lets Groq answer the very same request when Gemini is %s', async (_, kind) => {
      const attempts: AiAttempt[] = [];
      const { router, gemini, groq } = pair(failsWith(kind));
      const request = ask({
        maxOutputTokens: 1_000_000,
        temperature: 0.2,
        onAttempt: (attempt) => attempts.push(attempt),
      });
      expect(await router.chat(request, live())).toMatchObject({
        provider: 'groq',
        model: GROQ_MODEL,
        fallback: true,
        text: `Answer from ${GROQ_MODEL}`,
      });
      // The same turns Gemini was given, within Groq's own output limit.
      expect(groq.calls).toEqual([
        {
          task: 'chat',
          messages: gemini.calls[0]!.messages,
          model: GROQ_MODEL,
          maxOutputTokens: 65_536,
          temperature: 0.2,
        },
      ]);
      expect(attempts.map((a) => [a.provider, a.model, a.fallback, a.outcome])).toEqual([
        ['gemini', MAIN, false, kind],
        ['groq', GROQ_MODEL, true, 'ok'],
      ]);
    });

    it('lets Groq answer when Gemini is too slow, within a deadline of its own', async () => {
      const gemini = new StubProvider('gemini', hangs);
      const groq = new StubProvider('groq', answers);
      const { router } = routerFor(
        { ...withGroq(), AI_TIMEOUT_MS: 50 },
        gemini,
        AI_MODEL_REGISTRY,
        groq,
      );
      expect(await router.chat(ask(), live())).toMatchObject({ provider: 'groq', fallback: true });
      // Each slow in turn: each its own deadline, and the last one's failure.
      const slow = new StubProvider('groq', hangs);
      const both = routerFor({ ...withGroq(), AI_TIMEOUT_MS: 50 }, gemini, AI_MODEL_REGISTRY, slow);
      await expect(both.router.chat(ask(), live())).rejects.toMatchObject({
        kind: 'timeout',
        target: { provider: 'groq', model: GROQ_MODEL },
      });
    });

    it.each(['auth', 'configuration', 'bad_request', 'malformed'] as const)(
      'never asks Groq when Gemini fails for %s, which another model would not change',
      async (kind) => {
        const { router, gemini, groq } = pair(failsWith(kind));
        await expect(router.chat(ask(), live())).rejects.toMatchObject({
          kind,
          target: { provider: 'gemini', model: MAIN },
        });
        expect(gemini.calls).toHaveLength(1);
        expect(groq.calls).toHaveLength(0);
      },
    );

    it('never asks Groq once the caller has gone', async () => {
      const { router, groq } = pair(hangs);
      const caller = new AbortController();
      setTimeout(() => caller.abort(), 5);
      await expect(router.chat(ask(), caller.signal)).rejects.toMatchObject({ kind: 'cancelled' });
      expect(groq.calls).toHaveLength(0);
    });

    it('never sends Groq what its approval does not cover: a learner’s own work stays with Gemini', async () => {
      const { router, groq } = pair(failsWith('unavailable'));
      await expect(router.chat(ask({ dataClass: 'personal' }), live())).rejects.toMatchObject({
        kind: 'unavailable',
        target: { provider: 'gemini' },
      });
      expect(groq.calls).toHaveLength(0);
      expect(await router.chat(ask({ dataClass: 'course' }), live())).toMatchObject({
        provider: 'groq',
      });
      expect(router.refusalFor(ask({ dataClass: 'restricted' }))).toBe('restricted_data');
    });

    it('lets Groq serve while Gemini’s model rests, and probes Gemini once its rest is over', async () => {
      const failing = new Set([MAIN]);
      const { router, circuits, advance, gemini, groq } = pair(failsWith('unavailable', failing));
      for (let i = 0; i < 2; i += 1) await router.chat(ask(), live());
      expect(circuits.state('gemini', MAIN)).toBe('open');
      expect(circuits.state('groq', GROQ_MODEL)).toBe('closed');
      expect(router.serviceState()).toBe('degraded');
      gemini.calls.length = 0;
      groq.calls.length = 0;
      expect(await router.chat(ask(), live())).toMatchObject({ provider: 'groq', fallback: true });
      expect([gemini.calls.length, groq.calls.length]).toEqual([0, 1]);
      advance(1000);
      failing.clear();
      expect(await router.chat(ask(), live())).toMatchObject({
        provider: 'gemini',
        fallback: false,
      });
      expect(circuits.state('gemini', MAIN)).toBe('closed');
      expect(router.serviceState()).toBe('ready');
    });

    it('fails cleanly, calling no one twice, when Gemini fails and Groq rests', async () => {
      const { router, circuits, gemini, groq } = pair(failsWith('unavailable'));
      for (let i = 0; i < 2; i += 1) circuits.circuitOf('groq', GROQ_MODEL).failed();
      await expect(router.chat(ask(), live())).rejects.toMatchObject({
        kind: 'circuit_open',
        status: 503,
        code: AI_ERROR_CODES.BUSY,
        target: { provider: 'groq', model: GROQ_MODEL },
      });
      expect([gemini.calls.length, groq.calls.length]).toEqual([1, 0]);
      // Gemini failing again rests it too: then nothing is called at all.
      await router.chat(ask(), live()).catch(() => undefined);
      expect(router.serviceState()).toBe('unavailable');
      await expect(router.chat(ask(), live())).rejects.toMatchObject({ kind: 'circuit_open' });
      expect([gemini.calls.length, groq.calls.length]).toEqual([2, 0]);
    });

    it('ends with Groq’s own failure when Groq fails too: one call each, and no loop', async () => {
      const { router, gemini, groq } = pair(failsWith('unavailable'), groqFails('rate_limited'));
      await expect(router.chat(ask(), live())).rejects.toMatchObject({
        kind: 'rate_limited',
        target: { provider: 'groq', model: GROQ_MODEL },
      });
      expect([gemini.calls.length, groq.calls.length]).toEqual([1, 1]);
    });

    it('never lets Groq’s failures rest Gemini’s model', async () => {
      const failing = new Set([MAIN]);
      const { router, circuits } = pair(
        failsWith('unavailable', failing),
        groqFails('unavailable'),
      );
      await router.chat(ask(), live()).catch(() => undefined);
      failing.clear();
      await router.chat(ask(), live());
      failing.add(MAIN);
      await router.chat(ask(), live()).catch(() => undefined);
      expect(circuits.state('groq', GROQ_MODEL)).toBe('open');
      expect(circuits.state('gemini', MAIN)).toBe('closed');
      failing.clear();
      expect(await router.chat(ask(), live())).toMatchObject({ provider: 'gemini' });
      expect(router.serviceState()).toBe('ready');
    });

    it('recovers each provider’s model on its own: one probe each once its rest is over', async () => {
      const geminiFailing = new Set([MAIN]);
      const groqFailing = new Set([GROQ_MODEL]);
      const { router, circuits, advance, gemini, groq } = pair(
        failsWith('unavailable', geminiFailing),
        failsWith('unavailable', groqFailing),
      );
      for (let i = 0; i < 2; i += 1) await router.chat(ask(), live()).catch(() => undefined);
      expect(router.serviceState()).toBe('unavailable');
      advance(1000);
      expect(circuits.state('gemini', MAIN)).toBe('half_open');
      expect(circuits.state('groq', GROQ_MODEL)).toBe('half_open');
      expect(router.serviceState()).toBe('ready');
      // Gemini still down, Groq back: Gemini's probe fails and rests it again; Groq's closes its own.
      groqFailing.clear();
      gemini.calls.length = 0;
      groq.calls.length = 0;
      expect(await router.chat(ask(), live())).toMatchObject({ provider: 'groq', fallback: true });
      expect([gemini.calls.length, groq.calls.length]).toEqual([1, 1]);
      expect(circuits.state('gemini', MAIN)).toBe('open');
      expect(circuits.state('groq', GROQ_MODEL)).toBe('closed');
      expect(router.serviceState()).toBe('degraded');
    });

    it('streams Groq’s whole answer when Gemini fails before writing, never one stitched from both', async () => {
      const { router } = pair(failsWith('unavailable'));
      const deltas = await collect(router.stream(ask(), live()));
      expect(deltas.at(-1)).toMatchObject({
        type: 'done',
        result: { provider: 'groq', model: GROQ_MODEL, fallback: true },
      });
      expect(deltas.map((d) => (d.type === 'text' ? d.text : '')).join('')).toBe(
        `Answer from ${GROQ_MODEL}`,
      );

      const failsMidway: StreamScript = async function* () {
        yield { type: 'text', text: 'Half ' };
        throw new AiProviderError('unavailable', { httpStatus: 503 });
      };
      const groq = new StubProvider('groq', answers);
      const mid = routerFor(
        withGroq(),
        new StubProvider('gemini', answers, failsMidway),
        AI_MODEL_REGISTRY,
        groq,
      );
      const seen: AiRoutedDelta[] = [];
      await expect(
        (async () => {
          for await (const delta of mid.router.stream(ask(), live())) seen.push(delta);
        })(),
      ).rejects.toMatchObject({ kind: 'unavailable', target: { provider: 'gemini' } });
      expect(seen).toEqual([{ type: 'text', text: 'Half ' }]);
      expect(groq.calls).toHaveLength(0);
    });

    it('allows for the stand-in’s own deadline in the longest a call may take', () => {
      const one = routerFor(gemini(), new StubProvider('gemini', answers));
      expect(one.router.longestCallMs()).toBe(60_000);
      const { router } = pair(answers);
      expect(router.longestCallMs()).toBe(120_000);
    });

    it('sets aside a stand-in the institute saved before Groq, and keeps its other choices — its narrowing above all', () => {
      const { router } = pair(answers);
      const saved = {
        model: 'gemini-3.5-flash',
        taskModels: {},
        fallbackModel: LITE,
        dataClasses: ['public'] as const,
        budget: null,
      };
      expect(router.useInstituteRouting(saved)).toEqual([
        "fallbackModel (AI settings) is set aside: the deployment's fallback provider stands in (AI_FALLBACK_PROVIDER=groq, AI_FALLBACK_MODEL)",
      ]);
      expect(router.approvedDataClasses()).toEqual(['public']);
      expect(router.currentModels()).toMatchObject({
        main: 'gemini-3.5-flash',
        fallback: GROQ_MODEL,
      });
      // A stand-in cannot be chosen anew while Groq stands in.
      expect(router.checkInstituteRouting(saved)).toEqual([
        "fallbackModel (AI settings) cannot be chosen while the deployment's fallback provider stands in (AI_FALLBACK_PROVIDER=groq, AI_FALLBACK_MODEL)",
      ]);
      expect(router.standInChoosable()).toBe(false);
    });

    it('logs every call under its own provider, the stand-in marked — and neither key, ever', async () => {
      const { router } = pair(failsWith('unavailable'));
      await router.chat(ask(), live());
      const text = JSON.stringify(logged);
      expect(text).toContain('"provider":"gemini","model":"gemini-3.8-flash","fallback":false');
      expect(text).toContain('"provider":"groq","model":"openai/gpt-oss-120b","fallback":true');
      for (const key of ['router-test-key-0000', GROQ_KEY]) expect(text).not.toContain(key);
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
      const { router, circuits, advance } = routerFor(gemini(), provider);
      for (let i = 0; i < 2; i += 1) await router.chat(ask(), live()).catch(() => undefined);
      advance(1000);
      failing.clear();
      // The probe: a stream whose reader stops after the first words.
      for await (const delta of router.stream(ask(), live())) {
        expect(delta.type).toBe('text');
        break;
      }
      // No verdict: the model is still on trial, and its probe slot is free again, so the service
      // takes the next call — which may probe, and whose answer closes the circuit.
      expect(circuits.state('gemini', MAIN)).toBe('half_open');
      expect(router.serviceState()).toBe('ready');
      await router.chat(ask(), live());
      expect(circuits.state('gemini', MAIN)).toBe('closed');
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

  describe('the institute’s AI settings (Phase 7D)', () => {
    const institute = {
      model: null,
      taskModels: {},
      fallbackModel: null,
      dataClasses: null,
      budget: null,
    } as const;

    it('routes by the institute’s choices once they can be routed, and back to the deployment’s', async () => {
      const provider = new StubProvider('gemini', answers);
      const { router } = routerFor(gemini({ AI_DATA_CLASSES: 'public,course' }), provider);
      expect(router.useInstituteRouting({ ...institute, model: LITE })).toEqual([]);
      expect((await router.chat(ask(), live())).model).toBe(LITE);
      expect(router.modelFor('chat')?.id).toBe(LITE);
      expect(router.currentModels()).toMatchObject({ main: LITE, fallback: null });

      router.useInstituteRouting({ ...institute, dataClasses: ['public'] });
      expect(router.approvedDataClasses()).toEqual(['public']);
      expect(router.refusalFor(ask({ dataClass: 'course' }))).toBe('data_class_not_approved');

      router.useInstituteRouting(null);
      expect(router.modelFor('chat')?.id).toBe(MAIN);
      expect(router.approvedDataClasses()).toEqual(['public', 'course']);
    });

    it('never half-applies choices it cannot route: the deployment’s routing stays, and it says why', () => {
      const { router } = routerFor(gemini(), new StubProvider('gemini', answers));
      const problems = router.useInstituteRouting({
        ...institute,
        model: LITE,
        taskModels: { title: 'gemini-9-ultra' },
      });
      expect(problems).toEqual([expect.stringContaining('taskModels.title (AI settings)')]);
      expect(router.modelFor('chat')?.id).toBe(MAIN);
      expect(router.checkInstituteRouting({ ...institute, model: LITE })).toEqual([]);
    });

    it('lists the provider’s models, and the routed ones without a price', () => {
      const { router } = routerFor(
        gemini({ AI_FALLBACK_MODEL: LITE, AI_MODEL_COSTS: `${MAIN}=0.50/3.00` }),
        new StubProvider('gemini', answers),
      );
      expect(router.availableModels().every((m) => m.provider === 'gemini')).toBe(true);
      expect(router.unpricedModels()).toEqual([LITE]);
      const fake = routerFor(
        configWith({ AI_PROVIDER: 'fake' }),
        new FakeAiProvider(configWith({})),
      );
      expect(fake.router.availableModels().map((m) => m.id)).toEqual([FAKE_MODEL]);
    });
  });
});
