/**
 * Content promotion (prisma/seed/content.ts) in a database of its own, an institute with only its
 * base seed, as production has: the bank, its terms and the assignment definitions arrive (the
 * assignments as drafts), nothing about people does, and a second run creates nothing. The demo
 * seed refuses production outright.
 *
 * The shared test database is left alone: the promotion would add the whole bank to it.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { ASSIGNMENTS, BANK, TECHNOLOGY_TERMS, TOPIC_TERMS } from '../prisma/seed/content/index.js';

const apiRoot = resolve(import.meta.dirname, '..');

function databaseUrl(name: string): string {
  const url = new URL(inject('databaseUrl'));
  url.pathname = `/${name}`;
  return url.toString();
}

async function recreate(url: string): Promise<void> {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = '/postgres';
  admin.search = '';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
}

async function dropDatabase(url: string): Promise<void> {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = '/postgres';
  admin.search = '';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  } finally {
    await client.end();
  }
}

function run(command: string, env: NodeJS.ProcessEnv): string {
  return execSync(command, {
    cwd: apiRoot,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const RUNNABLE = new Set(['coding', 'sql', 'debugging', 'web']);

describe('content promotion into an institute with only its base seed', () => {
  const url = databaseUrl('lms_test_content');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: url,
    JWT_ACCESS_SECRET: inject('jwtSecret'),
    APP_ENV: 'local',
    WORKER_MODE: 'none',
    EMAIL_DRIVER: 'none',
    LOG_LEVEL: 'warn',
  };
  let db: Client;
  let firstRun = '';
  let secondRun = '';
  const count = async (sql: string, params: unknown[] = []): Promise<number> =>
    Number((await db.query<{ n: string }>(sql, params)).rows[0]!.n);

  beforeAll(async () => {
    await recreate(url);
    run('pnpm exec prisma migrate deploy', env);
    run('pnpm exec tsx prisma/seed/base.ts', env);
    db = new Client({ connectionString: url });
    await db.connect();
    firstRun = run('pnpm exec tsx prisma/seed/content.ts', env);
  }, 300_000);

  afterAll(async () => {
    await db?.end();
    await dropDatabase(url);
  });

  it('writes the whole bank, publishing a runnable question only with its verification', async () => {
    expect(firstRun).toContain(`${BANK.length} question(s)`);
    expect(await count('SELECT count(*) AS n FROM questions')).toBe(BANK.length);
    // Nothing that runs code is published without the sandbox's verification record.
    expect(
      await count(
        `SELECT count(*) AS n FROM questions
          WHERE type::text = ANY($1) AND status = 'published' AND validation IS NULL`,
        [[...RUNNABLE]],
      ),
    ).toBe(0);
    // Only a runnable question can be held back as a draft.
    expect(
      await count(
        `SELECT count(*) AS n FROM questions WHERE status = 'draft' AND NOT (type::text = ANY($1))`,
        [[...RUNNABLE]],
      ),
    ).toBe(0);
    expect(await count('SELECT count(*) AS n FROM questions WHERE author_id IS NOT NULL')).toBe(0);
    expect(await count('SELECT count(*) AS n FROM coding_problems')).toBeGreaterThan(0);
  });

  it('adds every technology and topic the bank uses', async () => {
    const { rows } = await db.query<{ taxonomy: string; key: string }>(
      `SELECT taxonomy, key FROM taxonomy_terms WHERE taxonomy IN ('subject', 'topic')`,
    );
    const present = new Set(rows.map((r) => `${r.taxonomy}:${r.key}`));
    for (const term of TECHNOLOGY_TERMS) expect(present).toContain(`subject:${term.key}`);
    for (const term of TOPIC_TERMS) expect(present).toContain(`topic:${term.key}`);
  });

  it('writes the assignment definitions as drafts, unattached and unpublished', async () => {
    expect(await count('SELECT count(*) AS n FROM assignments')).toBe(ASSIGNMENTS.length);
    expect(
      await count(
        `SELECT count(*) AS n FROM assignments
          WHERE status <> 'draft' OR created_by_id IS NOT NULL OR program_id IS NOT NULL
             OR course_id IS NOT NULL`,
      ),
    ).toBe(0);
    expect(await count('SELECT count(*) AS n FROM assignment_publications')).toBe(0);
    // Every question an assignment holds is published.
    expect(
      await count(
        `SELECT count(*) AS n FROM assignment_questions aq
           JOIN questions q ON q.id = aq.question_id WHERE q.status <> 'published'`,
      ),
    ).toBe(0);
  });

  it('writes nothing about people, and none of the demo’s courses, tests, placements or pages', async () => {
    for (const table of [
      'users',
      'programs',
      'batches',
      'enrollments',
      'courses',
      'tests',
      'test_schedules',
      'submissions',
      'test_attempts',
      'lesson_progress',
      'attendance_records',
      'notifications',
      'companies',
      'placement_drives',
      'content_pages',
    ])
      expect(await count(`SELECT count(*) AS n FROM "${table}"`), table).toBe(0);
    expect(
      await count(`SELECT count(*) AS n FROM audit_logs WHERE action = 'seed.content_promoted'`),
    ).toBe(1);
  });

  it('creates nothing on a second run', async () => {
    const before = {
      questions: await count('SELECT count(*) AS n FROM questions'),
      terms: await count('SELECT count(*) AS n FROM taxonomy_terms'),
      assignments: await count('SELECT count(*) AS n FROM assignments'),
    };
    secondRun = run('pnpm exec tsx prisma/seed/content.ts', env);
    expect(secondRun).toContain(
      '0 question(s), 0 taxonomy term(s) and 0 draft assignment(s) created',
    );
    expect(await count('SELECT count(*) AS n FROM questions')).toBe(before.questions);
    expect(await count('SELECT count(*) AS n FROM taxonomy_terms')).toBe(before.terms);
    expect(await count('SELECT count(*) AS n FROM assignments')).toBe(before.assignments);
    expect(
      await count(`SELECT count(*) AS n FROM audit_logs WHERE action = 'seed.content_promoted'`),
    ).toBe(1);
  }, 120_000);

  it('refuses to run the demo seed in production, before touching the database', async () => {
    let failure = '';
    try {
      run('pnpm exec tsx prisma/seed/demo.ts', {
        ...env,
        APP_ENV: 'production',
        LMS_ALLOW_PRODUCTION_SEED: '1',
        SEED_DEMO_PASSWORD: 'never-used-Demo1',
      });
    } catch (error) {
      failure = String((error as { stderr?: string }).stderr ?? error);
    }
    expect(failure).toContain('The demo seed never runs in production');
    expect(await count('SELECT count(*) AS n FROM users')).toBe(0);
  }, 120_000);
});
