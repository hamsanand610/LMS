import { describe, expect, it } from 'vitest';
import { isSealed, openSecret, sealSecret, secretKey } from './secret-box.js';

describe('stored secrets (Phase 6)', () => {
  const key = secretKey({ DATA_ENCRYPTION_KEY: '', JWT_ACCESS_SECRET: 'j'.repeat(40) });

  it('seals a value so the stored text does not contain it, and opens it again', () => {
    const sealed = sealSecret('smtp-password-123', key);
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain('smtp-password-123');
    expect(openSecret(sealed, key)).toBe('smtp-password-123');
  });

  it('uses a fresh nonce, so one value never seals to the same text twice', () => {
    expect(sealSecret('same', key)).not.toBe(sealSecret('same', key));
  });

  it('opens nothing with another key, or once altered', () => {
    const sealed = sealSecret('value', key);
    const other = secretKey({
      DATA_ENCRYPTION_KEY: 'd'.repeat(40),
      JWT_ACCESS_SECRET: 'j'.repeat(40),
    });
    expect(openSecret(sealed, other)).toBeNull();
    const altered = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'BB' : 'AA');
    expect(openSecret(altered, key)).toBeNull();
    expect(openSecret('plain text', key)).toBeNull();
  });
});
