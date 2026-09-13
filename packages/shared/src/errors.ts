/**
 * Stable machine-readable error codes used in RFC 9457 problem responses (`type` and `code`).
 * The web app maps these to user-facing messages.
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'validation_failed',
  UNAUTHENTICATED: 'unauthenticated',
  INVALID_CREDENTIALS: 'invalid_credentials',
  ACCOUNT_LOCKED: 'account_locked',
  ACCOUNT_INACTIVE: 'account_inactive',
  FORBIDDEN: 'forbidden',
  MODULE_DISABLED: 'module_disabled',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  TOKEN_EXPIRED: 'token_expired',
  TOKEN_USED: 'token_used',
  RATE_LIMITED: 'rate_limited',
  INTERNAL: 'internal_error',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Shape of every error response (application/problem+json). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: ErrorCode | string;
  requestId?: string;
  errors?: { path: string; message: string; code?: string }[];
}
