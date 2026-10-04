import { describe, expect, it } from 'vitest';
import { AiProviderError } from './ai-provider.js';
import { checkedVectors, unitVector } from './vectors.js';

function reasonOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AiProviderError);
    expect((error as AiProviderError).kind).toBe('malformed');
    return (error as AiProviderError).diagnostics.reason;
  }
  return undefined;
}

describe('embedding vectors (Phase 8C)', () => {
  it('scales a vector to unit length, keeping its direction', () => {
    const vector = unitVector([3, 4]);
    expect(vector).toEqual([0.6, 0.8]);
    expect(Math.hypot(...vector)).toBeCloseTo(1, 12);
  });

  it('refuses what has no direction or is not a number', () => {
    expect(reasonOf(() => unitVector([0, 0, 0]))).toBe('ZERO_VECTOR');
    expect(reasonOf(() => unitVector([1, Number.NaN]))).toBe('INVALID_VECTOR_VALUE');
    expect(reasonOf(() => unitVector([1, Number.POSITIVE_INFINITY]))).toBe('INVALID_VECTOR_VALUE');
    expect(reasonOf(() => unitVector([1, '2']))).toBe('INVALID_VECTOR_VALUE');
    expect(reasonOf(() => unitVector([1, null]))).toBe('INVALID_VECTOR_VALUE');
    // Large values whose squares overflow have no length either.
    expect(reasonOf(() => unitVector([1e200, 1e200]))).toBe('ZERO_VECTOR');
  });

  it('takes exactly one vector per text, each of the dimension asked', () => {
    expect(
      checkedVectors(
        [
          [1, 0],
          [0, 2],
        ],
        2,
        2,
      ),
    ).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(reasonOf(() => checkedVectors([[1, 0]], 2, 2))).toBe('VECTOR_COUNT');
    expect(
      reasonOf(() =>
        checkedVectors(
          [
            [1, 0],
            [0, 1],
            [1, 1],
          ],
          2,
          2,
        ),
      ),
    ).toBe('VECTOR_COUNT');
    expect(
      reasonOf(() =>
        checkedVectors(
          [
            [1, 0],
            [0, 1, 0],
          ],
          2,
          2,
        ),
      ),
    ).toBe('WRONG_DIMENSION');
    expect(reasonOf(() => checkedVectors([[1, 0], undefined], 2, 2))).toBe('WRONG_DIMENSION');
    expect(reasonOf(() => checkedVectors({ 0: [1, 0] }, 1, 2))).toBe('VECTOR_COUNT');
    expect(reasonOf(() => checkedVectors(undefined, 1, 2))).toBe('VECTOR_COUNT');
  });
});
