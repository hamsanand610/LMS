import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ACCESS_COOKIE } from '../auth/auth-user.js';
import type { RateLimitOptions } from './rate-limit.decorator.js';
import { RateLimitGuard } from './rate-limit.guard.js';

/**
 * The counter has to tell callers apart even before they are authenticated, or everybody behind
 * one campus network shares a bucket and a whole classroom is throttled as though it were a single
 * client; and it has to keep a made-up session cookie from being a way around the limit.
 */
describe('rate limit keys', () => {
  const guard = new RateLimitGuard(new Reflector());
  const byUser: RateLimitOptions = { points: 10, durationSec: 1, keyBy: 'user' };

  /** `buckets` is private; this is the behaviour it exists for, so it is tested through it. */
  const bucketsFor = (req: unknown, options: RateLimitOptions = byUser, scope = 'default') =>
    (
      guard as unknown as {
        buckets: (r: unknown, o: RateLimitOptions, s: string) => { key: string; points: number }[];
      }
    ).buckets(req, options, scope);
  const keyFor = (req: unknown): string => bucketsFor(req)[0]!.key;

  it('counts two sessions from one address separately', () => {
    const first = keyFor({
      cookies: { [ACCESS_COOKIE]: 'token-one' },
      socket: { remoteAddress: '10.0.0.1' },
    });
    const second = keyFor({
      cookies: { [ACCESS_COOKIE]: 'token-two' },
      socket: { remoteAddress: '10.0.0.1' },
    });
    expect(first).not.toBe(second);
    expect(first.startsWith('session:')).toBe(true);
  });

  it('is stable for one session', () => {
    const req = {
      cookies: { [ACCESS_COOKIE]: 'token-one' },
      socket: { remoteAddress: '10.0.0.1' },
    };
    expect(keyFor(req)).toBe(keyFor(req));
  });

  it('never puts the cookie itself into the key', () => {
    const key = keyFor({ cookies: { [ACCESS_COOKIE]: 'a-secret-token' }, socket: {} });
    expect(key).not.toContain('a-secret-token');
  });

  it('caps every session from one address together, so invented cookies do not multiply it', () => {
    const [, ceiling] = bucketsFor({
      cookies: { [ACCESS_COOKIE]: 'made-up' },
      socket: { remoteAddress: '10.0.0.5' },
    });
    expect(ceiling).toEqual({ key: 'ipcap:10.0.0.5:default', points: 100 });
  });

  it('falls back to the address when there is no session at all', () => {
    expect(bucketsFor({ cookies: {}, socket: { remoteAddress: '10.0.0.9' } })).toEqual([
      { key: 'ip:10.0.0.9:default', points: 10 },
    ]);
  });

  it('prefers the resolved user once authentication has run', () => {
    const key = keyFor({
      user: { id: 'user-1' },
      cookies: { [ACCESS_COOKIE]: 'token-one' },
      socket: { remoteAddress: '10.0.0.1' },
    });
    expect(key).toBe('user:user-1:default');
  });

  it('counts one account the same however its address is typed', () => {
    const options: RateLimitOptions = {
      points: 5,
      durationSec: 900,
      keyBy: 'ip+body',
      bodyField: 'email',
      valuePoints: 5,
      ipPoints: 150,
    };
    const socket = { remoteAddress: '10.0.0.2' };
    const plain = bucketsFor({ body: { email: 'anika@siacademy.example' }, socket }, options, 'r');
    const noisy = bucketsFor(
      { body: { email: '  Anika@SIAcademy.example ' }, socket },
      options,
      'r',
    );
    expect(noisy).toEqual(plain);
    expect(plain.map((b) => b.points)).toEqual([5, 5, 150]);
    expect(JSON.stringify(plain)).not.toContain('anika');
  });
});
