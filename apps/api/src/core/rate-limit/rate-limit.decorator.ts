import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'lms:rate-limit';

export interface RateLimitOptions {
  /** Requests allowed within the window. */
  points: number;
  /** Window length in seconds (fixed window). */
  durationSec: number;
  /** Key strategy: per client IP, per authenticated user (falls back to IP), or IP + a body field (e.g. email). */
  keyBy: 'ip' | 'user' | 'ip+body';
  /** Body field used with `ip+body`. */
  bodyField?: string;
}

/** Per-route rate limit; routes without it get the default per-caller limit. */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
