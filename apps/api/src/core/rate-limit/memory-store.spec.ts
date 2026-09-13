import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRateLimitStore } from './memory-store.js';

describe('MemoryRateLimitStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts hits within a fixed window and resets after it', async () => {
    const store = new MemoryRateLimitStore();
    const first = await store.hit('k', 1_000);
    expect(first.count).toBe(1);
    expect(first.resetAt).toBe(Date.now() + 1_000);
    expect((await store.hit('k', 1_000)).count).toBe(2);
    vi.advanceTimersByTime(999);
    expect((await store.hit('k', 1_000)).count).toBe(3);
    vi.advanceTimersByTime(2);
    expect((await store.hit('k', 1_000)).count).toBe(1);
  });

  it('keeps keys independent', async () => {
    const store = new MemoryRateLimitStore();
    await store.hit('a', 1_000);
    await store.hit('a', 1_000);
    expect((await store.hit('b', 1_000)).count).toBe(1);
  });
});
