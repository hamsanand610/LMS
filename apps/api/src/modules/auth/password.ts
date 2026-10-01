import { createHash, randomBytes } from 'node:crypto';

/** Argon2id parameters (OWASP-aligned for interactive logins). */
const ARGON = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
} as const;

/** Which implementation is hashing passwords in this process. */
export type PasswordEngineName = 'native' | 'wasm';

interface PasswordEngine {
  name: PasswordEngineName;
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

/** The `argon2` package: a native binding, the first choice wherever the platform loads it. */
async function nativeEngine(): Promise<PasswordEngine> {
  const { default: argon2 } = await import('argon2');
  return {
    name: 'native',
    hash: (password) =>
      argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: ARGON.memoryCost,
        timeCost: ARGON.timeCost,
        parallelism: ARGON.parallelism,
        hashLength: ARGON.hashLength,
      }),
    verify: (hash, password) => argon2.verify(hash, password),
  };
}

/**
 * The same algorithm in WebAssembly (`hash-wasm`): identical parameters and the same PHC string, so a
 * hash written by either engine is verified by both. Exported for the unit test that proves that.
 */
export async function wasmEngine(): Promise<PasswordEngine> {
  const { argon2id, argon2Verify } = await import('hash-wasm');
  return {
    name: 'wasm',
    hash: (password) =>
      argon2id({
        password,
        salt: randomBytes(ARGON.saltLength),
        memorySize: ARGON.memoryCost,
        iterations: ARGON.timeCost,
        parallelism: ARGON.parallelism,
        hashLength: ARGON.hashLength,
        outputType: 'encoded',
      }),
    verify: (hash, password) => argon2Verify({ password, hash }),
  };
}

/**
 * Some platforms refuse to load the native binding (Windows Smart App Control blocks unsigned
 * binaries it has no reputation for). Only that failure selects the WebAssembly engine; anything
 * else is a real fault and is thrown (ADR-0016).
 */
async function selectEngine(): Promise<PasswordEngine> {
  try {
    return await nativeEngine();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ERR_DLOPEN_FAILED') throw error;
    return wasmEngine();
  }
}

let engine: Promise<PasswordEngine> | null = null;
function passwordEngine(): Promise<PasswordEngine> {
  engine ??= selectEngine();
  return engine;
}

/** For the start-up log and the health page: which engine this process is using. */
export async function passwordEngineName(): Promise<PasswordEngineName> {
  return (await passwordEngine()).name;
}

export async function hashPassword(password: string): Promise<string> {
  return (await passwordEngine()).hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await (await passwordEngine()).verify(hash, password);
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
