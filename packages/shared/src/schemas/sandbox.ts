import { z } from 'zod';
import { EXECUTION_LANGUAGES, type ExecutionLanguage } from './questions.js';

/**
 * The contract between the API's `runner` driver and the sandbox runner service (apps/runner),
 * and between the runner and the harness inside each container (infra/sandbox/harness.py).
 *
 * A job carries inputs only. Expected outputs never leave the API: it compares what the program
 * printed with what it holds, so nothing inside a container can learn what a hidden case expects.
 */
export const SANDBOX_LIMITS = {
  maxCases: 50,
  maxCodeChars: 64_000,
  maxStdinChars: 200_000,
  maxTotalStdinChars: 2_000_000,
  minTimeMs: 100,
  maxTimeMs: 30_000,
  minMemoryMb: 16,
  maxMemoryMb: 512,
  minOutputBytes: 1024,
  maxOutputBytes: 1_048_576,
  /** Every case's time allowance together; a longer job is refused rather than cut off. */
  maxTotalTimeMs: 120_000,
} as const;

/**
 * What each runtime needs before the learner's first line runs, added to a case's CPU allowance:
 * the JVM, an interpreter, or jsdom and the page for a web check. Mirrors STARTUP_MS in
 * infra/sandbox/harness.py.
 */
export const SANDBOX_STARTUP_MS: Record<ExecutionLanguage, number> = {
  java: 1500,
  python: 400,
  javascript: 500,
  php: 400,
  sql: 500,
  web: 4000,
};

/** The wall clock a web check's checker may take once the page is done (ADR-0019). */
export const WEB_CHECK_WALL_MS = 25_000;

/**
 * The most one case may take on the wall clock, mirroring harness.py: a case is judged on CPU
 * time, and the wall clock only stops code that waits instead of computing, at twice the CPU
 * allowance plus two seconds. A web check adds its checker. The runner and the API size their
 * deadlines on this, so neither gives up before the harness does.
 */
export function caseWallMs(language: ExecutionLanguage, timeMs: number): number {
  const checker = language === 'web' ? WEB_CHECK_WALL_MS : 0;
  return 2 * (timeMs + SANDBOX_STARTUP_MS[language]) + 2000 + checker;
}

export const sandboxCaseSchema = z.object({
  id: z.string().min(1).max(64),
  stdin: z.string().max(SANDBOX_LIMITS.maxStdinChars),
  /** Overrides the job's limits for this case. */
  timeMs: z.number().int().min(SANDBOX_LIMITS.minTimeMs).max(SANDBOX_LIMITS.maxTimeMs).optional(),
  memoryMb: z
    .number()
    .int()
    .min(SANDBOX_LIMITS.minMemoryMb)
    .max(SANDBOX_LIMITS.maxMemoryMb)
    .optional(),
});

export const sandboxJobSchema = z
  .object({
    language: z.enum(EXECUTION_LANGUAGES),
    code: z.string().min(1).max(SANDBOX_LIMITS.maxCodeChars),
    cases: z.array(sandboxCaseSchema).min(1).max(SANDBOX_LIMITS.maxCases),
    limits: z.object({
      timeMs: z.number().int().min(SANDBOX_LIMITS.minTimeMs).max(SANDBOX_LIMITS.maxTimeMs),
      memoryMb: z.number().int().min(SANDBOX_LIMITS.minMemoryMb).max(SANDBOX_LIMITS.maxMemoryMb),
      outputBytes: z
        .number()
        .int()
        .min(SANDBOX_LIMITS.minOutputBytes)
        .max(SANDBOX_LIMITS.maxOutputBytes),
    }),
    /** SQL only: the schema and rows every case starts from, and a check query for DML answers. */
    sql: z
      .object({
        setup: z.string().max(200_000),
        check: z.string().max(20_000),
      })
      .optional(),
  })
  .refine(
    (job) =>
      job.cases.reduce((total, c) => total + (c.timeMs ?? job.limits.timeMs), 0) <=
      SANDBOX_LIMITS.maxTotalTimeMs,
    { path: ['cases'], message: 'The cases together may run for at most two minutes' },
  )
  .refine(
    (job) =>
      job.cases.reduce((total, c) => total + c.stdin.length, 0) <=
      SANDBOX_LIMITS.maxTotalStdinChars,
    { path: ['cases'], message: 'The cases together carry too much input' },
  )
  .refine((job) => (job.language === 'sql') === (job.sql !== undefined), {
    path: ['sql'],
    message: 'An SQL job carries its setup, and only an SQL job does',
  });
export type SandboxJob = z.infer<typeof sandboxJobSchema>;

/** One case as the harness reports it: what the program did, not whether it was right. */
export interface SandboxCaseResult {
  id: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: number | null;
  timedOut: boolean;
  memoryExceeded: boolean;
  durationMs: number;
  memoryKb: number;
  truncated: boolean;
}

export interface SandboxResult {
  harness: number;
  compile: { ok: boolean; output: string; durationMs: number };
  cases: SandboxCaseResult[];
}
