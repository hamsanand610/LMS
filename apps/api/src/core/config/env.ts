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

  EMAIL_DRIVER: z.enum(['smtp', 'none']).default('smtp'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_SECURE: booleanFromString,
  EMAIL_FROM: z.string().default('LMS <no-reply@localhost>'),

  EXECUTION_DRIVER: z.enum(['browser-sandbox', 'judge0']).default('browser-sandbox'),
  JUDGE0_URL: z.string().default(''),
  JUDGE0_TOKEN: z.string().default(''),

  SEED_ADMIN_EMAIL: z.string().default('superadmin@demo.local'),
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
  if (config.APP_ENV === 'production') {
    if (!config.COOKIE_SECURE) throw new Error('COOKIE_SECURE must be true in production');
    if (config.JWT_ACCESS_SECRET.startsWith('change-me')) {
      throw new Error('JWT_ACCESS_SECRET still has the placeholder value');
    }
  }
  return config;
}

export const APP_CONFIG = Symbol('APP_CONFIG');
