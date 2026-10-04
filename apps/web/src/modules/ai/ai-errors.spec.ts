import { describe, expect, it } from 'vitest';
import { AI_ERROR_CODES } from '@lms/shared';
import { ApiError } from '@/lib/api/errors';
import { aiErrorMessage, aiStreamErrorMessage } from './ai-errors';

const refused = (status: number, code: string, detail = 'SERVER-DETAIL-MARKER') =>
  new ApiError(status, { type: 'about:blank', title: 'Refused', status, code, detail });

describe('what SI Academy AI’s refusals say (Phase 7E)', () => {
  it('says each refusal in the product’s own words, never the server’s text', () => {
    const cases: [ApiError, RegExp][] = [
      [refused(429, AI_ERROR_CODES.QUOTA_EXCEEDED), /limit for now/],
      [refused(409, AI_ERROR_CODES.GENERATION_IN_PROGRESS), /still being written/],
      [refused(403, AI_ERROR_CODES.NOT_ALLOWED), /timed test/],
      [refused(403, AI_ERROR_CODES.FEATURE_DISABLED), /switched off/],
      [refused(403, 'module_disabled'), /switched off for your institute/],
      [refused(403, AI_ERROR_CODES.DATA_NOT_APPROVED), /not approved/],
      [refused(400, AI_ERROR_CODES.RESTRICTED_CONTENT), /password, key or token/],
      [refused(503, AI_ERROR_CODES.UNAVAILABLE), /not available right now/],
      [refused(503, AI_ERROR_CODES.BUSY), /busy/],
      [refused(504, AI_ERROR_CODES.TIMEOUT), /too long/],
      [refused(422, AI_ERROR_CODES.HINT_NEEDS_ATTEMPT), /Submit an attempt first/],
      [refused(422, AI_ERROR_CODES.SUBJECT_NOT_SUPPORTED), /cannot be asked about that/],
      [refused(403, 'module_locked'), /still locked/],
      [refused(403, 'forbidden'), /not open to you/],
      [refused(404, 'not_found'), /no longer available/],
    ];
    for (const [error, expected] of cases) {
      const message = aiErrorMessage(error);
      expect(message, error.code).toMatch(expected);
      expect(message, error.code).not.toContain('SERVER-DETAIL-MARKER');
    }
  });

  it('falls back to a general sentence for anything it does not know — a provider’s error included', () => {
    const message = aiErrorMessage(
      refused(502, 'gemini_upstream_error', 'Gemini said: quota project-123'),
    );
    expect(message).toBe('Something went wrong with SI Academy AI. Try again.');
    expect(aiErrorMessage(new Error('boom'))).toBe(
      'Something went wrong with SI Academy AI. Try again.',
    );
  });

  it('tells a dropped connection and an ended session apart', () => {
    expect(aiErrorMessage(new TypeError('Failed to fetch'))).toMatch(/could not be reached/);
    expect(aiErrorMessage(new ApiError(401, null))).toMatch(/Sign in again/);
  });

  it('keeps a form’s own sentence for a question it refused', () => {
    const invalid = new ApiError(400, {
      type: 'about:blank',
      title: 'Invalid',
      status: 400,
      code: 'validation_failed',
      errors: [{ path: 'content', message: 'Write a question' }],
    });
    expect(aiErrorMessage(invalid)).toBe('Write a question');
  });

  it('reads an error event inside a stream by its code alone', () => {
    expect(aiStreamErrorMessage(AI_ERROR_CODES.TIMEOUT)).toMatch(/too long/);
    expect(aiStreamErrorMessage('anything_else')).toMatch(/Something went wrong/);
    expect(aiStreamErrorMessage(undefined)).toMatch(/Something went wrong/);
  });
});
