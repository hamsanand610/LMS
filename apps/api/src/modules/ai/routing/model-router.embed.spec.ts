import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiProviderCapabilities, AiProviderName } from '@lms/shared';
import { type AppConfig, envSchema } from '../../../core/config/env.js';
import {
  type AiEmbedRequest,
  type AiEmbedResult,
  type AiProvider,
  AiProviderError,
  AiUnavailableError,
} from '../providers/ai-provider.js';
import { FAKE_EMBEDDING_MODEL, fakeEmbedding } from '../providers/fake.provider.js';
import { AiCircuitBreakers } from './circuit-breaker.js';
import { AI_EMBEDDING_MODEL_REGISTRY, AI_MODEL_REGISTRY } from './model-registry.js';
import { type AiAttempt, type AiEmbedRouteRequest, ModelRouter } from './model-router.js';

const REQUIRED = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
};
const fake = (env: Record<string, string> = {}): AppConfig =>
  envSchema.parse({
    ...REQUIRED,
    AI_PROVIDER: 'fake',
    AI_DATA_CLASSES: 'public,course',
    AI_TIMEOUT_MS: '1000',
    ...env,
  });

type Script = (request: AiEmbedRequest, signal: AbortSignal) => Promise<AiEmbedResult>;

/** A provider whose every embedding the test decides; it records what it was asked. */
class EmbedStub implements AiProvider {
  readonly calls: AiEmbedRequest[] = [];
  constructor(
    readonly name: AiProviderName,
    private readonly script: Script,
    private readonly embeds = true,
  ) {}
  capabilities(): AiProviderCapabilities {
    return {
      streaming: true,
      embeddings: this.embeds,
      structuredOutput: false,
      maxContextTokens: 1,
    };
  }
  chat(): Promise<never> {
    return Promise.reject(new AiUnavailableError());
  }
  stream(): AsyncIterable<never> {
    return {
      [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new AiUnavailableError()) }),
    };
  }
  embed(request: AiEmbedRequest, signal: AbortSignal): Promise<AiEmbedResult> {
    this.calls.push(request);
    return this.script(request, signal);
  }
  health(): Promise<{ ok: boolean }> {
    return Promise.resolve({ ok: true });
  }
}

/** Vectors three times too long, as gemini-embedding-001 leaves a reduced dimension. */
const vectorsOf =
  (scale = 3): Script =>
  (request) =>
    Promise.resolve({
      vectors: request.texts.map((text) =>
        fakeEmbedding(text, request.dimension).map((v) => v * scale),
      ),
      model: request.model,
      usage: { inputTokens: 40 },
    });

const hangs: Script = (_, signal) =>
  new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

function routerFor(
  config: AppConfig,
  provider: AiProvider,
  registry = AI_EMBEDDING_MODEL_REGISTRY,
) {
  const circuits = new AiCircuitBreakers({ failureThreshold: 2, cooldownMs: 60_000, now: () => 0 });
  return new ModelRouter(config, provider, AI_MODEL_REGISTRY, circuits, registry);
}

const ask = (overrides: Partial<AiEmbedRouteRequest> = {}): AiEmbedRouteRequest => ({
  feature: 'knowledge',
  dataClass: 'course',
  userId: 'user-1',
  organizationId: 'org-1',
  purpose: 'document',
  texts: ['Inheritance reuses a class.', 'A loop repeats work.'],
  ...overrides,
});

const live = () => new AbortController().signal;

async function failure(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected the call to fail');
}

describe('the router embeds (Phase 8C)', () => {
  let logged: unknown[][];
  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
  });
  afterEach(() => vi.restoreAllMocks());

  it('embeds a batch with the configured model, at the schema’s dimension, and tells the ledger', async () => {
    const provider = new EmbedStub('fake', vectorsOf());
    const router = routerFor(fake({ AI_MODEL_COSTS: `${FAKE_EMBEDDING_MODEL}=0.15/0` }), provider);
    expect(router.embeddingRouting()).toMatchObject({
      model: { id: FAKE_EMBEDDING_MODEL },
      dimension: 768,
    });
    const attempts: AiAttempt[] = [];
    const result = await router.embed(ask({ onAttempt: (a) => attempts.push(a) }), live());
    expect(provider.calls).toEqual([
      { texts: ask().texts, model: FAKE_EMBEDDING_MODEL, purpose: 'document', dimension: 768 },
    ]);
    expect(result).toMatchObject({ provider: 'fake', model: FAKE_EMBEDDING_MODEL, dimension: 768 });
    for (const vector of result.vectors) expect(Math.hypot(...vector)).toBeCloseTo(1, 9);
    expect(attempts).toEqual([
      expect.objectContaining({
        provider: 'fake',
        model: FAKE_EMBEDDING_MODEL,
        outcome: 'ok',
        usage: { inputTokens: 40, outputTokens: 0 },
        estimatedCostUsd: (40 * 0.15) / 1_000_000,
      }),
    ]);
  });

  it('refuses before any call what the provider may not be given', async () => {
    const provider = new EmbedStub('fake', vectorsOf());
    const router = routerFor(fake({ AI_DATA_CLASSES: 'public' }), provider);
    for (const dataClass of ['course', 'personal', 'restricted'] as const) {
      expect(router.embeddingRefusal(dataClass)).not.toBeNull();
      expect(await failure(router.embed(ask({ dataClass }), live()))).toBeInstanceOf(
        AiUnavailableError,
      );
    }
    expect(router.embeddingRefusal('public')).toBeNull();
    expect(provider.calls).toHaveLength(0);
  });

  it('refuses a batch larger than configured, an empty one, and a text too long for the model', async () => {
    const provider = new EmbedStub('fake', vectorsOf());
    const router = routerFor(fake({ AI_EMBEDDING_BATCH_SIZE: '2' }), provider);
    for (const texts of [['a', 'b', 'c'], []]) {
      const error = await failure(router.embed(ask({ texts }), live()));
      expect(error).toMatchObject({
        kind: 'bad_request',
        diagnostics: { reason: 'BATCH_TOO_LARGE' },
      });
    }
    const small = [{ ...AI_EMBEDDING_MODEL_REGISTRY[0]!, inputTokens: 4 }];
    const strict = routerFor(fake(), provider, small);
    expect(await failure(strict.embed(ask({ texts: ['x'.repeat(17)] }), live()))).toMatchObject({
      kind: 'bad_request',
    });
    expect(provider.calls).toHaveLength(0);
  });

  it('checks the provider’s vectors once more: the dimension, the count, every value', async () => {
    const answers: Script[] = [
      (r) =>
        Promise.resolve({
          vectors: r.texts.map(() => [1, 0, 0]),
          model: r.model,
          usage: { inputTokens: 1 },
        }),
      (r) =>
        Promise.resolve({
          vectors: [fakeEmbedding('x', 768)],
          model: r.model,
          usage: { inputTokens: 1 },
        }),
      (r) =>
        Promise.resolve({
          vectors: r.texts.map(() => [Number.NaN, ...fakeEmbedding('x', 767)]),
          model: r.model,
          usage: { inputTokens: 1 },
        }),
    ];
    const reasons: (string | undefined)[] = [];
    for (const answer of answers) {
      const attempts: AiAttempt[] = [];
      const router = routerFor(fake(), new EmbedStub('fake', answer));
      const error = await failure(
        router.embed(ask({ onAttempt: (a) => attempts.push(a) }), live()),
      );
      expect(error).toBeInstanceOf(AiProviderError);
      reasons.push((error as AiProviderError).diagnostics.reason);
      expect(attempts.map((a) => a.outcome)).toEqual(['malformed']);
    }
    expect(reasons).toEqual(['WRONG_DIMENSION', 'VECTOR_COUNT', 'INVALID_VECTOR_VALUE']);
  });

  it('ends at the deadline, rests a model that keeps failing, and never calls a provider that cannot embed', async () => {
    const slow = routerFor(fake(), new EmbedStub('fake', hangs));
    expect(await failure(slow.embed(ask(), live()))).toMatchObject({ kind: 'timeout' });

    const failing = new EmbedStub('fake', () =>
      Promise.reject(new AiProviderError('unavailable', { httpStatus: 503 })),
    );
    const resting = routerFor(fake(), failing);
    for (let i = 0; i < 2; i += 1) {
      expect(await failure(resting.embed(ask(), live()))).toMatchObject({ kind: 'unavailable' });
    }
    expect(await failure(resting.embed(ask(), live()))).toMatchObject({ kind: 'circuit_open' });
    expect(failing.calls).toHaveLength(2);

    const unable = new EmbedStub('fake', vectorsOf(), false);
    const router = routerFor(fake(), unable);
    expect(router.embeddingRouting()).toBeNull();
    expect(await failure(router.embed(ask(), live()))).toBeInstanceOf(AiUnavailableError);
    expect(unable.calls).toHaveLength(0);
  });

  it('logs each call by its numbers, never its texts', async () => {
    const router = routerFor(fake(), new EmbedStub('fake', vectorsOf()));
    await router.embed(ask({ texts: ['A private-looking sentence'] }), live());
    const text = JSON.stringify(logged);
    expect(text).toContain('"task":"embed"');
    expect(text).toContain('"feature":"knowledge"');
    expect(text).not.toContain('private-looking');
  });
});
