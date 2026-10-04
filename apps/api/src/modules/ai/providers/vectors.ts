import { AiProviderError } from './ai-provider.js';

/**
 * A vector at unit length (Phase 8C; ADR-0035), so that cosine distance and inner product agree.
 * A value that is not a finite number, or a vector with no length, is not an embedding: the
 * provider answered with something unreadable.
 */
export function unitVector(values: readonly unknown[]): number[] {
  let sum = 0;
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new AiProviderError('malformed', { reason: 'INVALID_VECTOR_VALUE' });
    }
    sum += value * value;
  }
  const norm = Math.sqrt(sum);
  if (!(norm > 0) || !Number.isFinite(norm)) {
    throw new AiProviderError('malformed', { reason: 'ZERO_VECTOR' });
  }
  return values.map((value) => (value as number) / norm);
}

/**
 * A provider's vectors, checked before anything keeps them: exactly one per text, each of the
 * requested dimension, every value finite, none without length — each scaled to unit length.
 */
export function checkedVectors(vectors: unknown, count: number, dimension: number): number[][] {
  if (!Array.isArray(vectors) || vectors.length !== count) {
    throw new AiProviderError('malformed', { reason: 'VECTOR_COUNT' });
  }
  return vectors.map((vector) => {
    if (!Array.isArray(vector) || vector.length !== dimension) {
      throw new AiProviderError('malformed', { reason: 'WRONG_DIMENSION' });
    }
    return unitVector(vector);
  });
}
