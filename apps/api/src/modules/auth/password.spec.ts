import { describe, expect, it } from 'vitest';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  isCommonPassword,
  verifyPassword,
} from './password.js';

describe('password hashing', () => {
  it('verifies the original password and rejects others', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse batter')).toBe(false);
  });

  it('produces a different hash for the same password (random salt)', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password-1'),
      hashPassword('same-password-1'),
    ]);
    expect(a).not.toBe(b);
  });

  it('treats a malformed stored hash as a failed verification instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
});

describe('opaque tokens', () => {
  it('generates unique url-safe tokens of at least 32 bytes', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateOpaqueToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    }
  });

  it('hashes tokens deterministically with sha256 (hex)', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abd')).not.toBe(hashToken('abc'));
  });
});

describe('common password deny-list', () => {
  it('matches case-insensitively', () => {
    expect(isCommonPassword('Password123')).toBe(true);
    expect(isCommonPassword('student123')).toBe(true);
    expect(isCommonPassword('Vx9#plumTree!')).toBe(false);
  });
});
