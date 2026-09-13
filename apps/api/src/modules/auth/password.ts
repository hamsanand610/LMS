import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';

/** Argon2id parameters (OWASP-aligned for interactive logins). */
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/** Opaque token for refresh/invitation/reset links: 32 random bytes, base64url. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Tokens are stored hashed; a database leak must not expose usable tokens. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Small deny-list of the most common passwords; the length rule does the rest. */
const COMMON_PASSWORDS = new Set([
  'password12',
  'password123',
  'password1234',
  'qwerty12345',
  '1234567890',
  '12345678910',
  'iloveyou123',
  'admin12345',
  'welcome123',
  'letmein123',
  'abcd123456',
  'india12345',
  'student123',
  'trainer123',
]);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}
