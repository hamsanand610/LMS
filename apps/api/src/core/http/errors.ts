import { ERROR_CODES, type ErrorCode } from '@lms/shared';

export interface FieldIssue {
  path: string;
  message: string;
  code?: string;
}

/**
 * Typed application error. The ProblemFilter turns it into an RFC 9457 response.
 * Services throw these; controllers never build responses for errors.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | string,
    public readonly title: string,
    public readonly detail?: string,
    public readonly issues?: FieldIssue[],
  ) {
    super(detail ?? title);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(issues: FieldIssue[], detail = 'One or more fields are invalid') {
    super(400, ERROR_CODES.VALIDATION_FAILED, 'Validation failed', detail, issues);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(
    detail = 'Sign in to continue',
    code: ErrorCode | string = ERROR_CODES.UNAUTHENTICATED,
  ) {
    super(401, code, 'Unauthenticated', detail);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(
      401,
      ERROR_CODES.INVALID_CREDENTIALS,
      'Invalid credentials',
      'The email or password is incorrect',
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(
    detail = 'You do not have access to this resource',
    code: ErrorCode | string = ERROR_CODES.FORBIDDEN,
  ) {
    super(403, code, 'Forbidden', detail);
  }
}

export class NotFoundError extends AppError {
  constructor(what = 'Resource') {
    super(404, ERROR_CODES.NOT_FOUND, 'Not found', `${what} was not found`);
  }
}

export class ConflictError extends AppError {
  constructor(detail: string, code: ErrorCode | string = ERROR_CODES.CONFLICT) {
    super(409, code, 'Conflict', detail);
  }
}

export class GoneError extends AppError {
  constructor(detail: string, code: ErrorCode | string = ERROR_CODES.TOKEN_EXPIRED) {
    super(410, code, 'Gone', detail);
  }
}

export class DomainRuleError extends AppError {
  constructor(detail: string, code = 'domain_rule') {
    super(422, code, 'Unprocessable', detail);
  }
}

export class RateLimitedError extends AppError {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      429,
      ERROR_CODES.RATE_LIMITED,
      'Too many requests',
      `Try again in ${retryAfterSeconds} seconds`,
    );
  }
}
