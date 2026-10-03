import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/**
 * Environment contract. Every variable is documented in apps/api/.env.example.
 * Parsing happens once at boot; the process refuses to start on invalid configuration.
 */
const booleanFromString = z
  .string()
  .default('false')
  .transform((v) => ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase()));

const csvList = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );

export const envSchema = z.object({
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_BASE_URL: z.url().default('http://localhost:4000'),
  WEB_BASE_URL: z.url().default('http://localhost:3000'),
  CLIENT_KEY: z
    .string()
    .regex(/^[a-z0-9-]{2,40}$/, 'CLIENT_KEY must be lowercase letters, digits or hyphens')
    .default('demo'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Connections the API keeps open to PostgreSQL. A dashboard asks for several things at once. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(2).max(100).default(20),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  COOKIE_SECURE: booleanFromString,
  COOKIE_DOMAIN: z.string().default(''),

  CORS_ORIGINS: csvList,

  WORKER_MODE: z.enum(['embedded', 'separate', 'none']).default('embedded'),
  QUEUE_DRIVER: z.enum(['pgboss']).default('pgboss'),

  STORAGE_DRIVER: z.enum(['s3']).default('s3'),
  S3_ENDPOINT: z.string().default(''),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_BUCKET_PRIVATE: z.string().default('lms-private'),
  S3_BUCKET_PUBLIC: z.string().default('lms-public'),
  S3_FORCE_PATH_STYLE: booleanFromString,
  /** Optional public base URL for the public bucket (CDN); defaults to the endpoint + bucket. */
  S3_PUBLIC_BASE_URL: z.string().default(''),
  /**
   * The address browsers use to reach the store, for signing upload and download links (Phase 6).
   * Empty: S3_ENDPOINT, which is right locally; in containers that is an internal host browsers
   * cannot reach, and outside local a link naming such a host is refused rather than handed out.
   */
  S3_PRESIGN_ENDPOINT: z.string().default(''),

  EMAIL_DRIVER: z.enum(['smtp', 'none']).default('smtp'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_SECURE: booleanFromString,
  EMAIL_FROM: z.string().default('LMS <no-reply@localhost>'),

  /**
   * Where learner code runs (ADR-0016): `runner` is the sandbox service in apps/runner; `judge0` a
   * Judge0 host; `none` runs nothing, and coding answers wait for a person instead.
   * `browser-sandbox` is the pre-ADR-0016 name for `none` and is read as it.
   */
  EXECUTION_DRIVER: z
    .enum(['runner', 'judge0', 'none', 'browser-sandbox'])
    .default('runner')
    .transform((value) => (value === 'browser-sandbox' ? 'none' : value)),
  RUNNER_URL: z.string().default('http://127.0.0.1:4100'),
  /** Shared with the runner; at least 32 characters. Never logged, never sent anywhere else. */
  RUNNER_TOKEN: z.string().default(''),
  JUDGE0_URL: z.string().default(''),
  JUDGE0_TOKEN: z.string().default(''),

  SEED_ADMIN_EMAIL: z.string().default('superadmin@siacademy.example'),
  SEED_ADMIN_PASSWORD: z.string().default(''),
  SEED_DEMO_PASSWORD: z.string().default(''),
});

export type AppConfig = z.infer<typeof envSchema>;

/** Loads apps/api/.env (if present) into process.env without overriding existing values, then validates. */
export function loadConfig(overrides: Record<string, string | undefined> = {}): AppConfig {
  const envFile = resolve(process.cwd(), '.env');
  if (existsSync(envFile) && process.env['LMS_SKIP_ENV_FILE'] !== '1') {
    // process.loadEnvFile never overrides variables that are already set.
    process.loadEnvFile(envFile);
  }
  const result = envSchema.safeParse({ ...process.env, ...overrides });
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  const config = result.data;
  const problems = sharedEnvironmentProblems(config);
  if (problems.length > 0) {
    throw new Error(
      `This configuration is only fit for local development:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  return config;
}

/**
 * The values infra/compose.yml and .env.example ship so a laptop works out of the box. They are
 * public, so an environment other people reach must never run on them.
 */
const LOCAL_DATABASE_PASSWORD = 'lms_dev_password';
const LOCAL_STORAGE_SECRET = 'lms_minio_password';

/** Why a staging or production process must not start with this configuration; empty when fine. */
export function sharedEnvironmentProblems(config: AppConfig): string[] {
  if (config.APP_ENV === 'local') return [];
  const problems: string[] = [];
  if (!config.COOKIE_SECURE)
    problems.push('COOKIE_SECURE must be true (the site is served over HTTPS)');
  if (config.JWT_ACCESS_SECRET.startsWith('change-me')) {
    problems.push('JWT_ACCESS_SECRET still has the placeholder value');
  }
  if (config.DATABASE_URL.includes(`:${LOCAL_DATABASE_PASSWORD}@`)) {
    problems.push('DATABASE_URL uses the local development password');
  }
  if (config.S3_SECRET_KEY === LOCAL_STORAGE_SECRET) {
    problems.push('S3_SECRET_KEY is the local development value');
  }
  if (config.EXECUTION_DRIVER === 'runner' && config.RUNNER_TOKEN.length < 32) {
    problems.push('RUNNER_TOKEN must be at least 32 characters');
  }
  // The example files' placeholders are long enough to pass every length check (Phase 6).
  for (const [name, value] of [
    ['JWT_ACCESS_SECRET', config.JWT_ACCESS_SECRET],
    ['S3_ACCESS_KEY', config.S3_ACCESS_KEY],
    ['S3_SECRET_KEY', config.S3_SECRET_KEY],
    ['RUNNER_TOKEN', config.RUNNER_TOKEN],
    ['DATABASE_URL', config.DATABASE_URL],
  ] as const) {
    if (value.includes('replace-me')) problems.push(`${name} still has the placeholder value`);
  }
  // Public files are linked straight from pages: their address must be one browsers reach.
  if (!isBrowserFacingUrl(config.S3_PUBLIC_BASE_URL)) {
    problems.push('S3_PUBLIC_BASE_URL must be a public https address (not an internal host)');
  }
  return problems;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Whether a URL is one a browser on the internet can use: https, a dotted host name, and neither
 * localhost nor a private address (Phase 6). `http://minio:9000` is not; `https://files.example.com` is.
 */
export function isBrowserFacingUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !host.includes('.') || host === 'localhost') return false;
  return !/^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}
