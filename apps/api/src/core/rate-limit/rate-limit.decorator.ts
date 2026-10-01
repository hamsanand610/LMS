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
  /**
   * With `ip+body`: requests allowed for one value of the body field from every address together,
   * so spreading the attempts on one account over many addresses does not multiply them.
   */
  valuePoints?: number;
  /** With `ip+body`: requests allowed from one address across every value of the body field. */
  ipPoints?: number;
}

/** Per-route rate limit; routes without it get the default per-caller limit. */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
