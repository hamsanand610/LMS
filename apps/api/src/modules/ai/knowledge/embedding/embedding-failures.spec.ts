import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_EMBEDDING_FAILURES } from '@lms/shared';
import { ConflictError } from '../../../../core/http/errors.js';
import { AiProviderError, AiUnavailableError } from '../../providers/ai-provider.js';
import { embeddingFailureOf } from './embedding.service.js';

/** How a stopped embedding run names its failure (Phase 8C; ADR-0035): a code, never words. */
describe('embedding failures (Phase 8C)', () => {
  it('names each provider failure by its kind', () => {
    const cases: [AiProviderError, string][] = [
      [new AiProviderError('rate_limited', { retryAfterSeconds: 30 }), 'provider_rate_limited'],
      [new AiProviderError('unavailable', { httpStatus: 503 }), 'provider_unavailable'],
      [new AiProviderError('circuit_open'), 'provider_unavailable'],
      [new AiProviderError('timeout'), 'provider_timeout'],
      [new AiProviderError('cancelled'), 'processing_timeout'],
      [new AiProviderError('auth', { httpStatus: 401 }), 'provider_auth'],
      [new AiProviderError('configuration', { httpStatus: 404 }), 'provider_configuration'],
      [new AiProviderError('bad_request', { httpStatus: 400 }), 'provider_bad_request'],
    ];
    for (const [error, code] of cases) {
      expect(embeddingFailureOf(error, 'embedding'), error.kind).toBe(code);
    }
  });

  it('tells a vector of the wrong size from one that is no vector, and both from other bad answers', () => {
    const malformed = (reason: string) => new AiProviderError('malformed', { reason });
    expect(embeddingFailureOf(malformed('WRONG_DIMENSION'), 'embedding')).toBe('wrong_dimension');
    expect(embeddingFailureOf(malformed('VECTOR_COUNT'), 'embedding')).toBe('wrong_dimension');
    expect(embeddingFailureOf(malformed('INVALID_VECTOR_VALUE'), 'embedding')).toBe(
      'invalid_vector',
    );
    expect(embeddingFailureOf(malformed('ZERO_VECTOR'), 'embedding')).toBe('invalid_vector');
    expect(embeddingFailureOf(malformed('NOT_JSON'), 'embedding')).toBe('provider_malformed');
    expect(embeddingFailureOf(new AiProviderError('malformed'), 'embedding')).toBe(
      'provider_malformed',
    );
  });

  it('names the rest by what refused it, or by where the run was', () => {
    expect(embeddingFailureOf(new AiUnavailableError(), 'embedding')).toBe(
      'embeddings_unavailable',
    );
    expect(embeddingFailureOf(new ConflictError('Changed meanwhile.'), 'recording')).toBe(
      'persist_failed',
    );
    expect(embeddingFailureOf(new Error('socket hang up'), 'embedding')).toBe(
      'provider_unavailable',
    );
    for (const stage of ['checking', 'recording', 'finishing'] as const) {
      expect(embeddingFailureOf(new Error('connection lost'), stage)).toBe('persist_failed');
    }
  });

  it('only ever names a failure the shared list knows', () => {
    const errors = [
      new AiProviderError('rate_limited'),
      new AiProviderError('malformed', { reason: 'WRONG_DIMENSION' }),
      new AiUnavailableError(),
      new Error('x'),
      'not even an error',
    ];
    for (const error of errors) {
      for (const stage of ['checking', 'embedding', 'recording', 'finishing'] as const) {
        expect(KNOWLEDGE_EMBEDDING_FAILURES).toContain(embeddingFailureOf(error, stage));
      }
    }
  });
});
