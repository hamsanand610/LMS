import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ValidationError, type FieldIssue } from './errors.js';

/** Minimal structural type of a Standard Schema issue (avoids a direct dependency on the spec package). */
interface StandardIssue {
  message: string;
  path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>;
}

export function issuesToFieldIssues(issues: readonly StandardIssue[]): FieldIssue[] {
  return issues.map((issue) => ({
    path: (issue.path ?? [])
      .map((segment) =>
        typeof segment === 'object' && segment !== null && 'key' in segment ? segment.key : segment,
      )
      .map(String)
      .join('.'),
    message: issue.message,
  }));
}

/**
 * Global pipe: validates every `@Body/@Query/@Param({ schema })` argument against its Zod schema
 * and returns the parsed (coerced, defaulted, transformed) value to the handler.
 */
export function createValidationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    transform: true,
    validateCustomDecorators: false,
    exceptionFactory: (issues) =>
      new ValidationError(issuesToFieldIssues(issues as readonly StandardIssue[])),
  });
}
