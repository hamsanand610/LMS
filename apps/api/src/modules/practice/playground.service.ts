import { Injectable, Logger } from '@nestjs/common';
import type { PlaygroundRunInput, PlaygroundRunOutcome } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { ExecutionService } from '../execution/index.js';
import { ExecutionGate } from '../execution/index.js';

/**
 * The code playground (ADR-0021): any code language the sandbox offers, run on the learner's own
 * input with no problem attached. It runs in the sandbox like everything else (ADR-0016), one run
 * at a time per person, and nothing it does is recorded; drafts are kept by LabDraftsService.
 */
@Injectable()
export class PlaygroundService {
  private readonly logger = new Logger(PlaygroundService.name);

  constructor(
    private readonly execution: ExecutionService,
    private readonly gate: ExecutionGate,
  ) {}

  async run(input: PlaygroundRunInput, user: AuthUser): Promise<PlaygroundRunOutcome> {
    const started = Date.now();
    const outcome = await this.gate.run(user.id, () =>
      this.execution.runFree(input.language, input.code, input.stdin),
    );
    this.logger.debug(
      {
        event: 'playground.run',
        userId: user.id,
        language: input.language,
        verdict: outcome.verdict,
        ms: Date.now() - started,
      },
      'Playground run',
    );
    return outcome;
  }
}
