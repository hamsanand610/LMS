import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/** What a sealed value starts with: the scheme and its version, so a later one can be told apart. */
const PREFIX = 'sealed:v1:';

/**
 * The key secrets stored in the database are sealed with (Phase 6): DATA_ENCRYPTION_KEY when set,
 * otherwise one derived from JWT_ACCESS_SECRET for this purpose only. Either way a database dump
 * alone no longer gives away an integration's password.
 */
export function secretKey(config: { DATA_ENCRYPTION_KEY: string; JWT_ACCESS_SECRET: string }) {
  const material = config.DATA_ENCRYPTION_KEY || config.JWT_ACCESS_SECRET;
  return Buffer.from(hkdfSync('sha256', material, 'lms', 'stored-secrets', 32));
}

/** AES-256-GCM: a fresh nonce per value, and the tag that proves it was not altered. */
export function sealSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

/** The plain value of a sealed one; null when it does not open with this key (or was altered). */
export function openSecret(sealed: string, key: Buffer): string | null {
  if (!isSealed(sealed)) return null;
  const raw = Buffer.from(sealed.slice(PREFIX.length), 'base64url');
  if (raw.length < 28) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function isSealed(value: string): boolean {
  return value.startsWith(PREFIX);
}
