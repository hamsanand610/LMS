import type { ProblemDetails } from '@lms/shared';

/** Thrown by the API client for any non-2xx response; carries the problem+json body when present. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetails | null,
  ) {
    super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
  }

  get code(): string {
    return this.problem?.code ?? `http_${this.status}`;
  }

  /** Field-level issues keyed by path (for forms). */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const issue of this.problem?.errors ?? []) {
      if (!(issue.path in out)) out[issue.path] = issue.message;
    }
    return out;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
