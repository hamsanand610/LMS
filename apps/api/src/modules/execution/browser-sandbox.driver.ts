import { Injectable } from '@nestjs/common';
import { EXECUTION_LANGUAGES, type ExecutionLanguage } from '@lms/shared';
import type { ExecutionDriver, ExecutionOutcome, ExecutionRequest } from './execution.driver.js';

/**
 * The demo driver. The learner's browser runs the code inside a sandboxed worker at an opaque
 * origin — JavaScript directly, Python through Pyodide — and posts back what happened. This class
 * therefore has nothing to execute: `run` always throws.
 *
 * That is the point of ADR-0007. The API process must never compile, evaluate or spawn learner
 * code, so the only thing a browser-driven result can be is a claim, recorded as untrusted and
 * badged as such wherever it is shown. Configure a Judge0 host to get verdicts worth trusting.
 */
@Injectable()
export class BrowserSandboxDriver implements ExecutionDriver {
  readonly name = 'browser-sandbox';
  readonly runsOnServer = false;
  readonly trust = 'untrusted' as const;

  languages(): readonly ExecutionLanguage[] {
    return EXECUTION_LANGUAGES;
  }

  run(_request: ExecutionRequest): Promise<ExecutionOutcome> {
    return Promise.reject(
      new Error(
        'The browser-sandbox driver never runs code on the server; the client reports its results',
      ),
    );
  }

  healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    return Promise.resolve({ ok: true, detail: 'runs in the learner’s browser' });
  }
}
