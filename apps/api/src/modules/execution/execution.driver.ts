import type { ExecutionLanguage, SandboxJob, SandboxResult, TrustLevel } from '@lms/shared';
import { AppError } from '../../core/http/errors.js';

/**
 * How code gets run (ADR-0007, ADR-0016). A driver sends a job — code and inputs, never expected
 * outputs — to something outside this process and returns what the program did. The API process
 * itself never compiles, evaluates or spawns learner code, whichever driver is configured.
 *
 * - `runner`: the sandbox service (apps/runner), one locked-down container per job;
 * - `judge0`: a Judge0 host;
 * - `none`: nothing runs; coding answers wait for a person.
 */
export interface ExecutionDriver {
  readonly name: string;
  readonly trust: TrustLevel;
  /** False for `none`: there is nothing to send code to. */
  readonly available: boolean;
  languages(): readonly ExecutionLanguage[];
  execute(job: SandboxJob): Promise<SandboxResult>;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}

export const EXECUTION_DRIVER = Symbol('EXECUTION_DRIVER');

/** Nothing could run the code: no driver, or the sandbox is down or busy. Safe to retry later. */
export class ExecutionUnavailableError extends AppError {
  constructor(detail = 'Code cannot be run right now. Try again in a minute.') {
    super(503, 'execution_unavailable', 'Code execution unavailable', detail);
  }
}
