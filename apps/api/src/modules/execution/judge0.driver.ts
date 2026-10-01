import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  CodeLanguage,
  ExecutionLanguage,
  SandboxCaseResult,
  SandboxJob,
  SandboxResult,
} from '@lms/shared';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { ExecutionUnavailableError, type ExecutionDriver } from './execution.driver.js';

/** Judge0 CE's own language ids for the languages it can run here. SQL is the runner's alone. */
const LANGUAGE_IDS: Record<CodeLanguage, number> = {
  java: 62,
  python: 71,
  javascript: 93,
  php: 68,
};

/** Judge0 status ids. */
const STATUS = { TIME_LIMIT: 5, COMPILATION_ERROR: 6, INTERNAL_ERROR: 13 } as const;

interface Judge0Submission {
  status?: { id: number; description: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  exit_code?: number | null;
  exit_signal?: number | null;
  time?: string | null;
  memory?: number | null;
}

/**
 * Runs code on a Judge0 host over a private network. As with the runner, only the code and the
 * inputs are sent; the output comes back and is compared here (ADR-0016).
 */
@Injectable()
export class Judge0Driver implements ExecutionDriver {
  readonly name = 'judge0';
  readonly trust = 'trusted' as const;
  readonly available = true;
  private readonly logger = new Logger(Judge0Driver.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  languages(): readonly ExecutionLanguage[] {
    return Object.keys(LANGUAGE_IDS) as ExecutionLanguage[];
  }

  async execute(job: SandboxJob): Promise<SandboxResult> {
    if (job.language === 'sql') {
      throw new ExecutionUnavailableError('SQL answers need the sandbox runner.');
    }
    const cases: SandboxCaseResult[] = [];
    let compile = { ok: true, output: '', durationMs: 0 };
    for (const testCase of job.cases) {
      const timeMs = testCase.timeMs ?? job.limits.timeMs;
      const memoryMb = testCase.memoryMb ?? job.limits.memoryMb;
      const submission = await this.submit(
        job.language,
        job.code,
        testCase.stdin,
        timeMs,
        memoryMb,
      );
      const statusId = submission.status?.id ?? STATUS.INTERNAL_ERROR;
      if (statusId === STATUS.INTERNAL_ERROR) throw new ExecutionUnavailableError();
      if (statusId === STATUS.COMPILATION_ERROR) {
        compile = {
          ok: false,
          output: (submission.compile_output ?? '').slice(0, 16_384),
          durationMs: 0,
        };
        return { harness: 0, compile, cases: [] };
      }
      const stdout = submission.stdout ?? '';
      cases.push({
        id: testCase.id,
        stdout: stdout.slice(0, job.limits.outputBytes),
        stderr: (submission.stderr ?? '').slice(0, job.limits.outputBytes),
        exitCode: submission.exit_code ?? (statusId === 3 || statusId === 4 ? 0 : 1),
        signal: submission.exit_signal ?? null,
        timedOut: statusId === STATUS.TIME_LIMIT,
        memoryExceeded: false,
        durationMs: Math.round(Number(submission.time ?? 0) * 1000),
        memoryKb: submission.memory ?? 0,
        truncated: stdout.length > job.limits.outputBytes,
      });
    }
    return { harness: 0, compile, cases };
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.config.JUDGE0_URL) return { ok: false, detail: 'JUDGE0_URL is not set' };
    try {
      const response = await fetch(`${this.config.JUDGE0_URL}/about`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok ? { ok: true } : { ok: false, detail: `HTTP ${response.status}` };
    } catch {
      return { ok: false, detail: 'Judge0 could not be reached' };
    }
  }

  private async submit(
    language: CodeLanguage,
    code: string,
    stdin: string,
    timeMs: number,
    memoryMb: number,
  ): Promise<Judge0Submission> {
    let response: Response;
    try {
      response = await fetch(
        `${this.config.JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...this.headers() },
          body: JSON.stringify({
            language_id: LANGUAGE_IDS[language],
            source_code: code,
            stdin,
            cpu_time_limit: Math.max(1, Math.ceil(timeMs / 1000)),
            memory_limit: memoryMb * 1024,
          }),
          signal: AbortSignal.timeout(timeMs + 20_000),
        },
      );
    } catch {
      throw new ExecutionUnavailableError();
    }
    if (!response.ok) {
      this.logger.error({ status: response.status }, 'Judge0 refused a submission');
      throw new ExecutionUnavailableError();
    }
    return (await response.json()) as Judge0Submission;
  }

  private headers(): Record<string, string> {
    return this.config.JUDGE0_TOKEN ? { 'X-Auth-Token': this.config.JUDGE0_TOKEN } : {};
  }
}
