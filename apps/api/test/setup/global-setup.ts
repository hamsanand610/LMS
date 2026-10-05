import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { Client } from 'pg';
import type { TestProject } from 'vitest/node';

const apiRoot = resolve(import.meta.dirname, '..', '..');

/**
 * TEST_DATABASE_URL wins; otherwise the local DATABASE_URL with the database name replaced by
 * lms_test. Only that address is read from apps/api/.env: the rest of a developer's file (an AI
 * provider, its keys, a measured evidence floor) never reaches the tests, which set what they need
 * themselves — as in CI, where there is no file.
 */
function resolveTestDatabaseUrl(): string {
  const explicit = process.env['TEST_DATABASE_URL'];
  if (explicit) return explicit;
  const envFile = resolve(apiRoot, '.env');
  const base =
    process.env['DATABASE_URL'] ??
    (existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8'))['DATABASE_URL'] : undefined);
  if (!base)
    throw new Error(
      'Set TEST_DATABASE_URL (or DATABASE_URL in apps/api/.env) to run the API tests',
    );
  const url = new URL(base);
  url.pathname = '/lms_test';
  return url.toString();
}

async function ensureDatabase(testUrl: string): Promise<void> {
  const target = new URL(testUrl);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  const admin = new URL(testUrl);
  admin.pathname = '/postgres';
  admin.search = '';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount === 0)
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  } finally {
    await client.end();
  }
}

/**
 * Empties the test database before the migrations run. Without it the fixtures each spec creates
 * accumulate between runs, and assertions about what an account can see drift until they fail.
 */
async function resetSchema(testUrl: string): Promise<void> {
  const client = new Client({ connectionString: testUrl });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
}

function run(command: string, env: NodeJS.ProcessEnv): void {
  execSync(command, { cwd: apiRoot, env, stdio: 'inherit' });
}

export default async function setup(project: TestProject): Promise<void> {
  const databaseUrl = resolveTestDatabaseUrl();
  const jwtSecret = randomBytes(32).toString('base64url');
  const password = `${randomBytes(12).toString('base64url')}-Tt1!`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: jwtSecret,
    LMS_TEST_PASSWORD: password,
    APP_ENV: 'local',
    WORKER_MODE: 'none',
    EMAIL_DRIVER: 'none',
    LOG_LEVEL: 'warn',
  };

  await ensureDatabase(databaseUrl);
  await resetSchema(databaseUrl);
  run('pnpm exec prisma migrate deploy', env);
  run('pnpm exec tsx prisma/seed/base.ts', env);
  run('pnpm exec tsx test/setup/seed-users.ts', env);

  project.provide('databaseUrl', databaseUrl);
  project.provide('jwtSecret', jwtSecret);
  project.provide('password', password);
}
