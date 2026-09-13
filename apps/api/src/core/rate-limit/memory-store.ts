export interface RateLimitStore {
  /** Increments the counter for `key` in a window of `durationMs`; returns the count and the reset time. */
  hit(key: string, durationMs: number): Promise<{ count: number; resetAt: number }>;
}

/** Fixed-window counters in process memory (single-instance deployments; a PostgreSQL store can replace it). */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = Date.now();

  async hit(key: string, durationMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    this.sweep(now);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + durationMs };
      this.buckets.set(key, fresh);
      return fresh;
    }
    bucket.count += 1;
    return bucket;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
