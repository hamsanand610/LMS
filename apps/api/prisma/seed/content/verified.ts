/**
 * Outcomes the verification suite recorded when it ran the bank in the sandbox
 * (`pnpm --filter @lms/api verify:questions -- --write` → verified-runs.json).
 *
 * The seed never runs code. It marks a runnable question (coding, SQL, debugging or web) as
 * validated, and records a seeded learner's run of it, only from this file — and only while the
 * question still matches the fingerprint it had when it was run. A question edited since is left as
 * a draft for an author to check again.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { casesOf, runSettings, type RunnableQuestion } from './index.js';

export interface VerifiedOutcome {
  passed: number;
  total: number;
  verdict: string;
  durationMs: number | null;
  memoryKb: number | null;
}

export interface VerifiedQuestion {
  fingerprint: string;
  languages: Record<string, { solution: VerifiedOutcome; starter: VerifiedOutcome | null }>;
}

export interface VerifiedRuns {
  generatedAt: string;
  image: string;
  driver: string;
  questions: Record<string, VerifiedQuestion>;
}

export const VERIFIED_RUNS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'verified-runs.json',
);

/** Everything that decides how a question's code is judged; any change means it must run again. */
export function fingerprintOf(question: RunnableQuestion): string {
  const settings = runSettings(question);
  const material = JSON.stringify({
    type: question.type,
    languages: settings.languages,
    timeLimitMs: settings.timeLimitMs,
    memoryLimitMb: settings.memoryLimitMb,
    compareMode: settings.compareMode,
    setupSql: settings.setupSql,
    sqlCheck: settings.sqlCheck,
    solution: settings.referenceSolution,
    starter: settings.starterCode,
    cases: casesOf(question).map((c) => [c.input, c.expected, c.weight ?? 1]),
  });
  return createHash('sha256').update(material).digest('hex').slice(0, 24);
}

export function loadVerifiedRuns(): VerifiedRuns | null {
  if (!existsSync(VERIFIED_RUNS_PATH)) return null;
  return JSON.parse(readFileSync(VERIFIED_RUNS_PATH, 'utf8')) as VerifiedRuns;
}

/**
 * The recorded runs of a question, when they are current: every language's reference solution
 * passed every case, against the question exactly as it is now — and, for a debugging lab, the
 * code with the bug failed at least one, so there is something to fix.
 */
export function currentVerification(
  runs: VerifiedRuns | null,
  question: RunnableQuestion,
): VerifiedQuestion | null {
  const entry = runs?.questions[question.slug];
  if (!entry || entry.fingerprint !== fingerprintOf(question)) return null;
  const languages = runSettings(question).languages;
  const cases = casesOf(question).length;
  const complete = languages.every((language) => {
    const outcome = entry.languages[language]?.solution;
    const starter = entry.languages[language]?.starter;
    return (
      outcome !== undefined &&
      outcome.passed === outcome.total &&
      outcome.total === cases &&
      (question.type !== 'debugging' || (starter != null && starter.passed < starter.total))
    );
  });
  return complete ? entry : null;
}
