import { Injectable } from '@nestjs/common';
import type { ExecutionLanguage, SandboxJob, SandboxResult } from '@lms/shared';
import { ExecutionUnavailableError, type ExecutionDriver } from './execution.driver.js';

/**
 * `EXECUTION_DRIVER=none` (and the older name `browser-sandbox`): nothing runs anywhere.
 *
 * Before ADR-0016 the learner's browser ran code and reported back; that meant sending hidden
 * cases to the browser and trusting its answer, so it is gone. Without a sandbox, Run is
 * unavailable and a coding answer is stored for a person to mark.
 */
@Injectable()
export class NoExecutionDriver implements ExecutionDriver {
  readonly name = 'none';
  readonly trust = 'untrusted' as const;
  readonly available = false;

  languages(): readonly ExecutionLanguage[] {
    return [];
  }

  execute(_job: SandboxJob): Promise<SandboxResult> {
    return Promise.reject(
      new ExecutionUnavailableError('Code execution is not set up on this installation.'),
    );
  }

  healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    return Promise.resolve({ ok: false, detail: 'No code execution is configured' });
  }
}
