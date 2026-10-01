import { describe, expect, it } from 'vitest';
import { addDaysToDateKey, type ActivityDay } from '@lms/shared';
import { streakFrom } from './consistency.service.js';

/** Days ending today, oldest first, active where `pattern` has a 1 (the last entry is today). */
function history(today: string, pattern: number[]): ActivityDay[] {
  return pattern.map((count, index) => ({
    date: addDaysToDateKey(today, index - (pattern.length - 1)),
    count,
  }));
}

describe('the learning streak (ADR-0014 §5)', () => {
  const today = '2026-09-27';

  it('counts consecutive active days ending today', () => {
    const streak = streakFrom(history(today, [0, 1, 1, 1]), today);
    expect(streak.current).toBe(3);
    expect(streak.activeToday).toBe(true);
  });

  it('keeps yesterday’s run alive until today is over', () => {
    const streak = streakFrom(history(today, [1, 1, 1, 0]), today);
    expect(streak.current).toBe(3);
    expect(streak.activeToday).toBe(false);
  });

  it('breaks on a missed day', () => {
    const streak = streakFrom(history(today, [1, 1, 0, 0]), today);
    expect(streak.current).toBe(0);
    expect(streak.lastActiveOn).toBe(addDaysToDateKey(today, -2));
  });

  it('remembers the longest run and the active days', () => {
    const streak = streakFrom(history(today, [1, 1, 1, 1, 0, 1, 1]), today);
    expect(streak.longest).toBe(4);
    expect(streak.current).toBe(2);
    expect(streak.activeDays).toBe(6);
  });

  it('is zero with no activity at all', () => {
    const streak = streakFrom(history(today, [0, 0, 0]), today);
    expect(streak).toMatchObject({ current: 0, longest: 0, activeDays: 0, lastActiveOn: null });
  });
});
