import {
  EXECUTION_LANGUAGES,
  type ExecutionLanguage,
  type SandboxCaseResult,
  type SandboxJob,
  type SandboxResult,
} from '@lms/shared';
import {
  ExecutionUnavailableError,
  type ExecutionDriver,
} from '../../src/modules/execution/index.js';

/**
 * A stand-in for the sandbox in the API tests. It executes nothing: the "program" is read for
 * markers that say how it behaves, so every path through run, submit and evaluation can be
 * exercised without Docker. The real sandbox has its own suite (apps/runner, test:sandbox).
 *
 *   @echo (the default)  prints its input back
 *   @sum                 prints the sum of the integers in its input
 *   @wrong               prints something no case expects
 *   @timeout @crash @oom runs out of time, throws, runs out of memory
 *   @unavailable         the sandbox cannot be reached
 *   // compile-error     does not compile
 *   -- result: {json}    (SQL) prints this result table for every case
 */
export class FakeExecutionDriver implements ExecutionDriver {
  readonly name = 'runner';
  readonly trust = 'trusted' as const;
  readonly available = true;
  /** Every job seen, so a test can check what was (and was not) sent to the sandbox. */
  readonly jobs: SandboxJob[] = [];

  languages(): readonly ExecutionLanguage[] {
    return EXECUTION_LANGUAGES;
  }

  async execute(job: SandboxJob): Promise<SandboxResult> {
    this.jobs.push(job);
    if (job.code.includes('@unavailable')) throw new ExecutionUnavailableError();
    if (job.code.includes('compile-error')) {
      return {
        harness: 1,
        compile: { ok: false, output: 'Main.java:1: error: ; expected', durationMs: 5 },
        cases: [],
      };
    }
    return {
      harness: 1,
      compile: { ok: true, output: '', durationMs: 0 },
      cases: job.cases.map((c) => this.runCase(job, c.id, c.stdin)),
    };
  }

  healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    return Promise.resolve({ ok: true });
  }

  private runCase(job: SandboxJob, id: string, stdin: string): SandboxCaseResult {
    const base: SandboxCaseResult = {
      id,
      stdout: '',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      memoryExceeded: false,
      durationMs: 12,
      memoryKb: 20_480,
      truncated: false,
    };
    const code = job.code;
    if (job.language === 'sql') {
      const match = /--\s*result:\s*(\{.*\})/.exec(code);
      return { ...base, stdout: match?.[1] ?? '{"columns":[],"rows":[]}' };
    }
    if (code.includes('@timeout')) return { ...base, timedOut: true, exitCode: null, signal: 9 };
    if (code.includes('@oom')) return { ...base, memoryExceeded: true, exitCode: 1 };
    if (code.includes('@crash')) {
      return {
        ...base,
        exitCode: 1,
        stderr: 'Exception in thread "main" java.lang.RuntimeException',
      };
    }
    if (code.includes('@wrong')) return { ...base, stdout: 'not what anyone expects\n' };
    if (code.includes('@sum')) {
      const total = (stdin.match(/-?\d+/g) ?? []).reduce((n, v) => n + Number(v), 0);
      return { ...base, stdout: `${total}\n` };
    }
    return { ...base, stdout: stdin };
  }
}
