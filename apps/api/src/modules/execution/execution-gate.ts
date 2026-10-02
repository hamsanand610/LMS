import { Injectable } from '@nestjs/common';
import { AppError } from '../../core/http/errors.js';

/** A second run while the first is still going (ADR-0021). */
export class ExecutionBusyError extends AppError {
  constructor() {
    super(
      429,
      'execution_in_progress',
      'Too many requests',
      'Your last run is still going. Wait for it to finish, then try again.',
    );
  }
}

/**
 * One execution at a time per person (ADR-0021). Lab runs, submits and checks, playground and
 * preview runs, and the runs of an assignment answer all pass through here, so one learner's tabs
 * cannot take both of the runner's slots while everybody else waits. The gate opens again however
 * the run ends.
 *
 * It lives in this process, like the rate limiter: with more than one API instance each would let
 * a person run once (Roadmap Phases 6 and 12 bring a shared store).
 */
@Injectable()
export class ExecutionGate {
  private readonly running = new Set<string>();

  async run<T>(userId: string, task: () => Promise<T>): Promise<T> {
    if (this.running.has(userId)) throw new ExecutionBusyError();
    this.running.add(userId);
    try {
      return await task();
    } finally {
      this.running.delete(userId);
    }
  }

  /** Whether a person has a run in progress; for tests and diagnostics. */
  isRunning(userId: string): boolean {
    return this.running.has(userId);
  }
}
