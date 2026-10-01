import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  isCommonPassword,
  passwordEngineName,
  verifyPassword,
  wasmEngine,
} from './password.js';

// Choosing the engine can take several seconds the first time (an operating system that refuses the
// native binding checks it first), so it is settled here rather than inside the first test's budget.
beforeAll(async () => {
  await passwordEngineName();
}, 60_000);

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

describe('the WebAssembly engine', () => {
  /*
   * A hash in the layout the native library writes (parameters in the order m, p, t), computed by
   * an independent implementation for a sample password that is not a credential of anything.
   */
  const NATIVE_LAYOUT =
    '$argon2id$v=19$m=65536,p=1,t=3$MDEyMzQ1Njc4OWFiY2RlZg$lMhvVBq9s9mqv+pZqgOWNUlIPpwLGnkzbna1TO5skX4';

  it('verifies a hash written in the native layout', async () => {
    const wasm = await wasmEngine();
    expect(await wasm.verify(NATIVE_LAYOUT, 'correct horse battery staple')).toBe(true);
    expect(await wasm.verify(NATIVE_LAYOUT, 'correct horse battery stapl')).toBe(false);
  });

  it('hashes with the same parameters and a fresh salt', async () => {
    const wasm = await wasmEngine();
    const [a, b] = await Promise.all([wasm.hash('Vx9#plumTree!'), wasm.hash('Vx9#plumTree!')]);
    expect(a).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
    expect(a).not.toBe(b);
    expect(await wasm.verify(a, 'Vx9#plumTree!')).toBe(true);
  });

  it('is interchangeable with whichever engine this machine selected', async () => {
    const wasm = await wasmEngine();
    // Selected engine → WebAssembly, and WebAssembly → selected engine (native wherever it loads).
    expect(await wasm.verify(await hashPassword('both-directions-1'), 'both-directions-1')).toBe(
      true,
    );
    expect(await verifyPassword(await wasm.hash('both-directions-2'), 'both-directions-2')).toBe(
      true,
    );
    expect(['native', 'wasm']).toContain(await passwordEngineName());
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
