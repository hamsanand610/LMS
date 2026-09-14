import type { ExecutionLanguage, ExecutionVerdict, TrustLevel } from '@lms/shared';

/** One case a driver runs code against. */
export interface ExecutionCase {
  id: string;
  input: string;
  expectedOutput: string;
  weight: number;
  isSample: boolean;
}

export interface ExecutionRequest {
  language: ExecutionLanguage;
  code: string;
  cases: ExecutionCase[];
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface ExecutionCaseResult {
  testCaseId: string;
  passed: boolean;
  actualOutput: string;
  stderr: string;
  durationMs: number;
}

export interface ExecutionOutcome {
  verdict: ExecutionVerdict;
  driver: string;
  trust: TrustLevel;
  results: ExecutionCaseResult[];
  durationMs: number;
  compileError: string;
}

/**
 * How code gets run. Two drivers exist (ADR-0007):
 *
 * `browser-sandbox` runs nothing here at all — the learner's own browser runs the code in a
 * sandboxed worker and reports what happened, which is why its verdicts are recorded as
 * untrusted. `judge0` sends the code to a separate service, so its verdicts are trusted.
 *
 * The API process never compiles, evaluates or spawns learner code under either driver. A driver
 * whose `runsOnServer` is false must throw from `run`, and a test asserts that it does.
 */
export interface ExecutionDriver {
  readonly name: string;
  /** False for drivers that execute in the client; true for a service the API calls. */
  readonly runsOnServer: boolean;
  readonly trust: TrustLevel;
  /** Languages the driver can run. */
  languages(): readonly ExecutionLanguage[];
  run(request: ExecutionRequest): Promise<ExecutionOutcome>;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}

export const EXECUTION_DRIVER = Symbol('EXECUTION_DRIVER');
