import { describe, expect, it } from 'vitest';
import { withoutPathSecrets } from './logger.module.js';

describe('request paths in the log', () => {
  it('replaces an invitation token and keeps the rest of the path', () => {
    expect(withoutPathSecrets('/api/v1/auth/invitations/AbC-123_xyz/accept')).toBe(
      '/api/v1/auth/invitations/[redacted]/accept',
    );
    expect(withoutPathSecrets('/api/v1/auth/invitations/AbC-123_xyz?x=1')).toBe(
      '/api/v1/auth/invitations/[redacted]?x=1',
    );
    expect(withoutPathSecrets('/api/v1/courses')).toBe('/api/v1/courses');
    expect(withoutPathSecrets(undefined)).toBeUndefined();
  });
});
