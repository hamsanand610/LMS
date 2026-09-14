import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ExecutionLanguage } from '@lms/shared';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import type {
  ExecutionCaseResult,
  ExecutionDriver,
  ExecutionOutcome,
  ExecutionRequest,
} from './execution.driver.js';

/** Judge0's own numeric language ids for the languages this template offers. */
const LANGUAGE_IDS: Record<ExecutionLanguage, number> = {
  javascript: 93,
  python: 71,
};

/** Judge0 status ids that mean the program ran and produced the expected output. */
const ACCEPTED = 3;

interface Judge0Submission {
  status?: { id: number; description: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  time?: string | null;
}

/**
 * Runs code on a separate Judge0 service over a private network, which is why its verdicts are
 * trusted. Nothing is executed in this process: the code is posted to the service and the result
 * is read back (ADR-0007).
 */
@Injectable()
export class Judge0Driver implements ExecutionDriver {
  readonly name = 'judge0';
  readonly runsOnServer = true;
  readonly trust = 'trusted' as const;
  private readonly logger = new Logger(Judge0Driver.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  languages(): readonly ExecutionLanguage[] {
    return Object.keys(LANGUAGE_IDS) as ExecutionLanguage[];
  }

  async run(request: ExecutionRequest): Promise<ExecutionOutcome> {
    const started = Date.now();
    const results: ExecutionCaseResult[] = [];
    let compileError = '';

    for (const testCase of request.cases) {
      const submission = await this.submit(request, testCase.input);
      const stdout = (submission.stdout ?? '').replace(/\r\n/g, '\n').trimEnd();
      const expected = testCase.expectedOutput.replace(/\r\n/g, '\n').trimEnd();
      if (submission.compile_output) compileError = submission.compile_output;
      results.push({
        testCaseId: testCase.id,
        passed: submission.status?.id === ACCEPTED && stdout === expected,
        actualOutput: stdout.slice(0, 20_000),
        stderr: (submission.stderr ?? '').slice(0, 20_000),
        durationMs: Math.round(Number(submission.time ?? 0) * 1000),
      });
    }

    const failed = results.filter((r) => !r.passed).length;
    return {
      verdict: compileError ? 'error' : failed === 0 ? 'passed' : 'failed',
      driver: this.name,
      trust: this.trust,
      results,
      durationMs: Date.now() - started,
      compileError: compileError.slice(0, 10_000),
    };
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.config.JUDGE0_URL) return { ok: false, detail: 'JUDGE0_URL is not set' };
    try {
      const response = await fetch(`${this.config.JUDGE0_URL}/about`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok ? { ok: true } : { ok: false, detail: `HTTP ${response.status}` };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) };
    }
  }

  private async submit(request: ExecutionRequest, stdin: string): Promise<Judge0Submission> {
    const response = await fetch(
      `${this.config.JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.headers() },
        body: JSON.stringify({
          language_id: LANGUAGE_IDS[request.language],
          source_code: request.code,
          stdin,
          cpu_time_limit: Math.max(1, Math.ceil(request.timeLimitMs / 1000)),
          memory_limit: request.memoryLimitMb * 1024,
        }),
        signal: AbortSignal.timeout(request.timeLimitMs + 20_000),
      },
    );
    if (!response.ok) {
      this.logger.error(`Judge0 returned HTTP ${response.status}`);
      return { status: { id: 13, description: 'Internal Error' }, stderr: 'Judge0 unavailable' };
    }
    return (await response.json()) as Judge0Submission;
  }

  private headers(): Record<string, string> {
    return this.config.JUDGE0_TOKEN ? { 'X-Auth-Token': this.config.JUDGE0_TOKEN } : {};
  }
}
