import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';
import { LOG_REDACT_PATHS, withoutPathSecrets } from './logger.module.js';

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

describe('what the logger never prints', () => {
  function logged(entry: object): string {
    let out = '';
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        out += chunk.toString();
        done();
      },
    });
    pino({ redact: { paths: [...LOG_REDACT_PATHS], censor: '[redacted]' } }, sink).info(entry);
    return out;
  }

  it('hides an AI provider key and authorization header, wherever a failed call puts them', () => {
    const out = logged({
      apiKey: 'top-level-key-123',
      provider: {
        apiKey: 'nested-key-456',
        headers: {
          authorization: 'Bearer provider-token-789',
          'x-goog-api-key': 'goog-key-abc',
          'x-api-key': 'other-key-def',
        },
      },
      headers: { authorization: 'Bearer direct-token-ghi' },
      status: 503,
    });
    for (const secret of [
      'top-level-key-123',
      'nested-key-456',
      'provider-token-789',
      'goog-key-abc',
      'other-key-def',
      'direct-token-ghi',
    ]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('[redacted]');
    // What is not a secret is still logged.
    expect(out).toContain('"status":503');
  });

  it('still hides the request credentials it always hid', () => {
    const out = logged({
      req: { headers: { authorization: 'Bearer user-token', cookie: 'lms_at=abc' } },
    });
    expect(out).not.toContain('user-token');
    expect(out).not.toContain('lms_at=abc');
  });
});
