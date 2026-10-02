import type { ProblemDetails } from '@lms/shared';

/**
 * What to tell the person. A refused form carries a sentence per field ("Use a link that starts
 * with https://"); those say what to fix, where the summary ("One or more fields are invalid")
 * does not, so they are the message whenever there are any.
 */
function messageOf(status: number, problem: ProblemDetails | null): string {
  const issues = problem?.errors ?? [];
  if (issues.length > 0) return [...new Set(issues.map((issue) => issue.message))].join(' ');
  return problem?.detail ?? problem?.title ?? `Request failed with status ${status}`;
}

/** Thrown by the API client for any non-2xx response; carries the problem+json body when present. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetails | null,
  ) {
    super(messageOf(status, problem));
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
