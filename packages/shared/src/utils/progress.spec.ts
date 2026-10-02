import { describe, expect, it } from 'vitest';
import { overallPercent } from './progress.js';

/** A small seeded generator, so the invariant checks below are repeatable. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe('the learner’s overall figure (Phase 2, D1)', () => {
  it('is nothing when there is nothing to average', () => {
    expect(overallPercent([])).toBe(0);
  });

  it('counts each course once and rounds the mean, as the staff reports do', () => {
    expect(overallPercent([100, 0])).toBe(50);
    expect(overallPercent([33, 33, 34])).toBe(33);
    expect(overallPercent([50, 51])).toBe(51);
    expect(overallPercent([100, 100, 0, 0, 0])).toBe(40);
  });

  it('holds each course to 0..100 before averaging', () => {
    expect(overallPercent([-20, 120])).toBe(50);
    expect(overallPercent([250])).toBe(100);
  });

  it('always lies between the lowest and the highest course, within rounding', () => {
    const random = seeded(2026);
    for (let run = 0; run < 500; run += 1) {
      const count = 1 + Math.floor(random() * 8);
      const percents = Array.from({ length: count }, () => Math.round(random() * 100));
      const overall = overallPercent(percents);
      expect(Number.isInteger(overall)).toBe(true);
      expect(overall).toBeGreaterThanOrEqual(Math.min(...percents));
      expect(overall).toBeLessThanOrEqual(Math.max(...percents));
    }
  });
});
