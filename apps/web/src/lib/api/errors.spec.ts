import type { ProblemDetails } from '@lms/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';

const problem = (overrides: Partial<ProblemDetails> = {}): ProblemDetails => ({
  type: 'about:blank',
  title: 'Unprocessable Entity',
  status: 422,
  code: 'validation_failed',
  detail: 'One or more fields are invalid',
  ...overrides,
});

describe('what an API error tells the person', () => {
  it('says what to fix when the form was refused field by field', () => {
    const error = new ApiError(
      422,
      problem({
        errors: [
          { path: 'url', message: 'Use a link that starts with https://' },
          { path: 'title', message: 'Give it a title' },
        ],
      }),
    );
    expect(error.message).toBe('Use a link that starts with https:// Give it a title');
    expect(error.fieldErrors).toEqual({
      url: 'Use a link that starts with https://',
      title: 'Give it a title',
    });
  });

  it('says a repeated field message once', () => {
    const error = new ApiError(
      422,
      problem({
        errors: [
          { path: 'cases.0.input', message: 'Too long' },
          { path: 'cases.1.input', message: 'Too long' },
        ],
      }),
    );
    expect(error.message).toBe('Too long');
  });

  it('falls back to the detail, then the title, then the status', () => {
    expect(new ApiError(409, problem({ detail: 'Already taken' })).message).toBe('Already taken');
    expect(new ApiError(404, problem({ detail: undefined, title: 'Not found' })).message).toBe(
      'Not found',
    );
    expect(new ApiError(502, null).message).toBe('Request failed with status 502');
    expect(new ApiError(502, null).code).toBe('http_502');
  });
});
