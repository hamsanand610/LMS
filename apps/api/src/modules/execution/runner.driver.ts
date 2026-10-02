import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EXECUTION_LANGUAGES,
  caseWallMs,
  type ExecutionLanguage,
  type SandboxJob,
  type SandboxResult,
} from '@lms/shared';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { ExecutionUnavailableError, type ExecutionDriver } from './execution.driver.js';

/**
 * Sends jobs to the sandbox runner (apps/runner) over the private network, with the shared token.
 * The runner starts a fresh container per job with no network, a read-only root, no capabilities
 * and CPU, memory and process limits, which is why its results are trusted (ADR-0016).
 */
@Injectable()
export class RunnerDriver implements ExecutionDriver {
  readonly name = 'runner';
  readonly trust = 'trusted' as const;
  readonly available = true;
  private readonly logger = new Logger(RunnerDriver.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  languages(): readonly ExecutionLanguage[] {
    return EXECUTION_LANGUAGES;
  }

  async execute(job: SandboxJob): Promise<SandboxResult> {
    // Longer than the runner's own deadline, so the API never gives up first: every case's
    // wall-clock backstop (ADR-0016; a web check's checker included), then the compiler,
    // container start-up and the network.
    const budget =
      job.cases.reduce(
        (total, c) => total + caseWallMs(job.language, c.timeMs ?? job.limits.timeMs),
        0,
      ) + 60_000;
    let response: Response;
    try {
      response = await fetch(`${this.base()}/v1/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.RUNNER_TOKEN}`,
        },
        body: JSON.stringify(job),
        signal: AbortSignal.timeout(budget),
      });
    } catch (error) {
      this.logger.error({ err: describe(error) }, 'The sandbox runner could not be reached');
      throw new ExecutionUnavailableError();
    }
    if (response.status === 503) {
      throw new ExecutionUnavailableError(
        'Many answers are being run just now. Try again in a minute.',
      );
    }
    if (!response.ok) {
      // The runner answers with a reason code only; nothing of the job comes back in it.
      this.logger.error({ status: response.status }, 'The sandbox runner refused a job');
      throw new ExecutionUnavailableError();
    }
    return (await response.json()) as SandboxResult;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const response = await fetch(`${this.base()}/v1/health`, {
        headers: { Authorization: `Bearer ${this.config.RUNNER_TOKEN}` },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return { ok: true };
      return { ok: false, detail: `The runner answered ${response.status}` };
    } catch {
      return { ok: false, detail: 'The runner could not be reached' };
    }
  }

  private base(): string {
    return this.config.RUNNER_URL.replace(/\/$/, '');
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
