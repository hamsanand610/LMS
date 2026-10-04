import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_EMBEDDING_DIMENSION } from '@lms/shared';
import { envSchema } from '../../../core/config/env.js';
import { FAKE_EMBEDDING_MODEL } from '../providers/fake.provider.js';
import {
  AI_EMBEDDING_MODEL_REGISTRY,
  AI_MODEL_REGISTRY,
  resolveEmbeddingRouting,
  resolveRouting,
} from './model-registry.js';

const REQUIRED = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
};
const configWith = (env: Record<string, string>) => envSchema.parse({ ...REQUIRED, ...env });
const gemini = (env: Record<string, string> = {}) =>
  configWith({
    AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'routing-test-key-0000',
    AI_MODEL: 'gemini-3.8-flash',
    ...env,
  });
const resolve = (env: Record<string, string>, base = configWith) =>
  resolveEmbeddingRouting(base(env), AI_EMBEDDING_MODEL_REGISTRY);

/** How the configuration chooses the embedding model and dimension (Phase 8C; ADR-0035). */
describe('embedding routing (Phase 8C)', () => {
  it('embeds with nothing while no provider is configured', () => {
    expect(resolve({})).toEqual({ routing: null, problems: [] });
    expect(resolve({ AI_EMBEDDING_MODEL: 'gemini-embedding-001' }).problems).toEqual([
      'No AI provider is configured (AI_PROVIDER=none): AI_EMBEDDING_MODEL names none',
    ]);
  });

  it('takes each provider’s own model by default, at the schema’s dimension', () => {
    expect(resolve({ AI_PROVIDER: 'fake' }).routing).toMatchObject({
      model: { id: FAKE_EMBEDDING_MODEL, provider: 'fake' },
      dimension: KNOWLEDGE_EMBEDDING_DIMENSION,
      batchSize: 32,
    });
    const chosen = resolveEmbeddingRouting(gemini(), AI_EMBEDDING_MODEL_REGISTRY);
    expect(chosen.problems).toEqual([]);
    expect(chosen.routing).toMatchObject({
      model: {
        id: 'gemini-embedding-001',
        provider: 'gemini',
        minDimension: 128,
        maxDimension: 3072,
        inputTokens: 2048,
      },
      dimension: 768,
    });
  });

  it('refuses a dimension the schema does not store: that is a migration, never a setting', () => {
    const { problems } = resolveEmbeddingRouting(
      gemini({ AI_EMBEDDING_DIMENSION: '1536' }),
      AI_EMBEDDING_MODEL_REGISTRY,
    );
    expect(problems).toEqual([
      'AI_EMBEDDING_DIMENSION is 1536, but the knowledge base stores vector(768): another dimension needs a migration first (ADR-0035)',
    ]);
  });

  it('refuses a model the registry does not list for the provider, or another provider’s', () => {
    expect(
      resolve({ AI_PROVIDER: 'fake', AI_EMBEDDING_MODEL: 'gemini-embedding-001' }).problems,
    ).toEqual([
      'AI_EMBEDDING_MODEL names "gemini-embedding-001", which the embedding registry does not list for fake (it lists fake-embedding-1)',
    ]);
    const unknown = resolveEmbeddingRouting(
      gemini({ AI_EMBEDDING_MODEL: 'text-embedding-004' }),
      AI_EMBEDDING_MODEL_REGISTRY,
    );
    expect(unknown.routing).toBeNull();
    expect(unknown.problems[0]).toContain('does not list for gemini');
  });

  it('refuses a dimension the model cannot give', () => {
    const narrow = [{ ...AI_EMBEDDING_MODEL_REGISTRY[1]!, maxDimension: 512 }];
    expect(resolveEmbeddingRouting(gemini(), narrow).problems).toEqual([
      'gemini-embedding-001 gives 128 to 512 dimensions, not 768',
    ]);
  });

  it('bounds the batch, and lets AI_MODEL_COSTS price an embedding model', () => {
    expect(() => configWith({ AI_EMBEDDING_BATCH_SIZE: '101' })).toThrow();
    expect(() => configWith({ AI_EMBEDDING_BATCH_SIZE: '0' })).toThrow();
    const priced = resolveRouting(
      gemini({ AI_MODEL_COSTS: 'gemini-3.8-flash=0.5/3,gemini-embedding-001=0.15/0' }),
      AI_MODEL_REGISTRY,
    );
    expect(priced.problems).toEqual([]);
    expect(priced.routing.costs.get('gemini-embedding-001')).toEqual({
      inputUsdPerMillion: 0.15,
      outputUsdPerMillion: 0,
    });
  });
});
