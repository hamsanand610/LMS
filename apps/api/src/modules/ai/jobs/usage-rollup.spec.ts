import { describe, expect, it } from 'vitest';
import { ROLLUP_GRACE_MS, daysToSettle, sameFigures } from './usage-rollup.service.js';

const figures = {
  requests: 2,
  inputTokens: 80,
  outputTokens: 20,
  totalTokens: 100,
  estimatedRequests: 1,
  estimatedCostMicros: 120,
};

describe('the usage roll-up’s days (Phase 7D)', () => {
  it('settles only days that have closed in the institute’s time zone, after the grace', () => {
    // 00:20 in Kolkata on 5 October is 18:50 UTC on 4 October.
    const justAfterMidnight = new Date('2026-10-04T18:50:00Z');
    expect(daysToSettle(justAfterMidnight, 'Asia/Kolkata', '2026-10-02')).toEqual([
      '2026-10-03',
      '2026-10-04',
    ]);
    // Ten minutes after midnight the day before is still within the grace: not yet.
    const tooSoon = new Date(new Date('2026-10-04T18:30:00Z').getTime() + 10 * 60_000);
    expect(daysToSettle(tooSoon, 'Asia/Kolkata', '2026-10-02')).toEqual(['2026-10-03']);
    expect(ROLLUP_GRACE_MS).toBe(15 * 60_000);
  });

  it('counts days in the institute’s zone, not the server’s', () => {
    // 18:50 UTC on 4 October: already the 5th in Kolkata, still the 4th in New York.
    const now = new Date('2026-10-04T18:50:00Z');
    expect(daysToSettle(now, 'Asia/Kolkata', '2026-10-03')).toEqual(['2026-10-04']);
    expect(daysToSettle(now, 'America/New_York', '2026-10-03')).toEqual([]);
    expect(daysToSettle(now, 'America/New_York', '2026-10-01')).toEqual([
      '2026-10-02',
      '2026-10-03',
    ]);
  });

  it('settles nothing twice, and catches up a long pause a month at a time', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    expect(daysToSettle(now, 'Asia/Kolkata', '2026-10-03')).toEqual([]);
    const behind = daysToSettle(now, 'Asia/Kolkata', '2026-06-30');
    expect(behind).toHaveLength(31);
    expect(behind[0]).toBe('2026-07-01');
    expect(behind.at(-1)).toBe('2026-07-31');
  });

  it('compares every figure, estimates included', () => {
    expect(sameFigures(figures, { ...figures })).toBe(true);
    for (const key of Object.keys(figures) as (keyof typeof figures)[]) {
      expect(sameFigures(figures, { ...figures, [key]: figures[key] + 1 }), key).toBe(false);
    }
  });
});
