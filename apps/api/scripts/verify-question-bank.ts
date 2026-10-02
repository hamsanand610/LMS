/**
 * Proves the seeded question bank in the sandbox. Every coding and SQL question's reference
 * solution must pass every case in every language it offers; the starter code's outcome is
 * recorded too. Nothing runs in this process: jobs go to the sandbox runner (apps/runner), exactly
 * as the API sends them, and are judged with the API's own comparison.
 *
 *   pnpm --filter @lms/api verify:questions              check the bank
 *   pnpm --filter @lms/api verify:questions -- --write   check, and save the outcomes the seed uses
 *   pnpm --filter @lms/api verify:questions -- --write --only slug-a,slug-b
 *                                                        re-check some questions after editing them
 *
 * Starts a private runner on 127.0.0.1 with a one-off token (never printed), unless RUNNER_URL
 * and RUNNER_TOKEN point at one already running. Needs Docker and the `lms-sandbox:1` image
 * (`docker build -t lms-sandbox:1 infra/sandbox`).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BANK,
  runSettings,
  type CodingQuestion,
  type SqlQuestion,
} from '../prisma/seed/content/index.js';
import {
  fingerprintOf,
  loadVerifiedRuns,
  VERIFIED_RUNS_PATH,
  type VerifiedOutcome,
  type VerifiedRuns,
} from '../prisma/seed/content/verified.js';
import type { AppConfig } from '../src/core/config/env.js';
import type { PrismaService } from '../src/core/prisma/prisma.service.js';
import { ExecutionService, type Problem } from '../src/modules/execution/execution.service.js';
import { RunnerDriver } from '../src/modules/execution/runner.driver.js';

const here = dirname(fileURLToPath(import.meta.url));
const RUNNER_ENTRY = resolve(here, '..', '..', 'runner', 'dist', 'main.js');

type Outcome = VerifiedOutcome;

function problemOf(question: CodingQuestion | SqlQuestion): Problem {
  const settings = runSettings(question);
  return {
    questionId: question.slug,
    type: question.type,
    languages: settings.languages,
    timeLimitMs: settings.timeLimitMs,
    memoryLimitMb: settings.memoryLimitMb,
    compareMode: settings.compareMode,
    setupSql: settings.setupSql,
    sqlCheck: settings.sqlCheck,
    starterCode: settings.starterCode,
    referenceSolution: settings.referenceSolution,
    cases: question.cases.map((c, index) => ({
      id: `case-${index + 1}`,
      position: index,
      input: c.input,
      expectedOutput: c.expected,
      isSample: c.sample ?? false,
      weight: c.weight ?? 1,
      label: c.label ?? '',
      explanation: c.explanation ?? '',
      enabled: true,
      timeLimitMs: null,
      memoryLimitMb: null,
    })),
  };
}

async function startRunner(): Promise<{ url: string; token: string; child: ChildProcess | null }> {
  const url = process.env['RUNNER_URL'];
  const token = process.env['RUNNER_TOKEN'];
  if (url && token) return { url, token, child: null };
  if (!existsSync(RUNNER_ENTRY)) {
    throw new Error('The runner is not built. Run: pnpm --filter @lms/runner build');
  }
  const port = String(4190 + Math.floor(Math.random() * 50));
  const secret = randomBytes(32).toString('base64url');
  const child = spawn(process.execPath, [RUNNER_ENTRY], {
    env: {
      ...process.env,
      RUNNER_TOKEN: secret,
      RUNNER_PORT: port,
      RUNNER_HOST: '127.0.0.1',
      RUNNER_CONCURRENCY: '2',
    },
    stdio: ['ignore', 'ignore', 'inherit'],
    windowsHide: true,
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(`${base}/livez`);
      if (response.ok) return { url: base, token: secret, child };
    } catch {
      // Not listening yet.
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  child.kill();
  throw new Error('The runner did not start');
}

/** `--only a,b` checks just those questions and, with --write, merges them into the saved outcomes. */
function onlyArgument(): Set<string> | null {
  const index = process.argv.indexOf('--only');
  if (index === -1) return null;
  const slugs = (process.argv[index + 1] ?? '').split(',').filter(Boolean);
  const unknown = slugs.filter((slug) => !BANK.some((q) => q.slug === slug));
  if (slugs.length === 0 || unknown.length > 0) {
    throw new Error(
      `--only takes question slugs from the bank${unknown.length ? `; unknown: ${unknown.join(', ')}` : ''}`,
    );
  }
  return new Set(slugs);
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const only = onlyArgument();
  const runner = await startRunner();
  const driver = new RunnerDriver({
    RUNNER_URL: runner.url,
    RUNNER_TOKEN: runner.token,
  } as AppConfig);
  // The database is never touched: only evaluate() is used, which builds jobs and compares outputs.
  const execution = new ExecutionService(null as unknown as PrismaService, driver);

  const questions: VerifiedRuns['questions'] = {};
  const failures: string[] = [];
  let checked = 0;
  try {
    const health = await driver.healthCheck();
    if (!health.ok)
      throw new Error(`The sandbox is not ready: ${health.detail ?? 'unknown reason'}`);

    for (const question of BANK) {
      if (question.type !== 'coding' && question.type !== 'sql') continue;
      if (only && !only.has(question.slug)) continue;
      const problem = problemOf(question);
      const settings = runSettings(question);
      questions[question.slug] = { fingerprint: fingerprintOf(question), languages: {} };
      for (const language of problem.languages) {
        const solution = settings.referenceSolution[language];
        if (!solution?.trim()) {
          failures.push(`${question.slug} [${language}]: no reference solution`);
          continue;
        }
        const evaluation = await execution.evaluate(problem, language, solution);
        checked += 1;
        const outcome: Outcome = {
          passed: evaluation.passed,
          total: evaluation.total,
          verdict: evaluation.verdict,
          durationMs: evaluation.durationMs,
          memoryKb: evaluation.memoryKb,
        };
        if (evaluation.passed !== evaluation.total) {
          for (const c of evaluation.cases.filter((x) => !x.passed)) {
            failures.push(
              `${question.slug} [${language}] ${c.case.id}${c.case.label ? ` (${c.case.label})` : ''}: ${c.verdict}` +
                `\n    expected: ${JSON.stringify(c.case.expectedOutput).slice(0, 300)}` +
                `\n    printed:  ${JSON.stringify(c.stdout).slice(0, 300)}` +
                (c.stderr ? `\n    stderr:   ${JSON.stringify(c.stderr).slice(0, 300)}` : '') +
                (evaluation.compileOutput
                  ? `\n    compiler: ${JSON.stringify(evaluation.compileOutput).slice(0, 300)}`
                  : ''),
            );
          }
        }
        let starterOutcome: Outcome | null = null;
        const starter = settings.starterCode[language];
        if (starter?.trim()) {
          const started = await execution.evaluate(problem, language, starter);
          starterOutcome = {
            passed: started.passed,
            total: started.total,
            verdict: started.verdict,
            durationMs: started.durationMs,
            memoryKb: started.memoryKb,
          };
        }
        questions[question.slug]!.languages[language] = {
          solution: outcome,
          starter: starterOutcome,
        };
        process.stdout.write(
          `${evaluation.passed === evaluation.total ? 'ok  ' : 'FAIL'} ${question.slug} [${language}] ${evaluation.passed}/${evaluation.total}` +
            `${starterOutcome ? ` (starter ${starterOutcome.passed}/${starterOutcome.total})` : ''}\n`,
        );
      }
    }
  } finally {
    runner.child?.kill();
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} problem(s):\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log(`\nEvery reference solution passes every case (${checked} language runs).`);
  if (write) {
    const previous = only ? loadVerifiedRuns() : null;
    const record: VerifiedRuns = {
      generatedAt: new Date().toISOString(),
      image: 'lms-sandbox:1',
      driver: 'runner',
      // A partial check keeps what was verified before for the questions it did not run.
      questions: { ...(previous?.questions ?? {}), ...questions },
    };
    writeFileSync(VERIFIED_RUNS_PATH, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`Outcomes saved to ${VERIFIED_RUNS_PATH}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
