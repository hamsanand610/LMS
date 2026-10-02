import { LAB_TYPES } from '@lms/shared';
/** Public surface of the execution adapter. */
export { ExecutionModule } from './execution.module.js';
export {
  ExecutionService,
  type EvaluatedCase,
  type Evaluation,
  type Problem,
  type ProblemCase,
} from './execution.service.js';
export {
  EXECUTION_DRIVER,
  ExecutionUnavailableError,
  type ExecutionDriver,
} from './execution.driver.js';
export { ExecutionBusyError, ExecutionGate } from './execution-gate.js';
export { NoExecutionDriver } from './no-execution.driver.js';
export { RunnerDriver } from './runner.driver.js';
export { Judge0Driver } from './judge0.driver.js';
export { outputsMatch, tablesMatch } from './compare.js';

/**
 * A practice problem counts as solved only through a submission the sandbox ran against every
 * case and passed. Runs a browser reported before ADR-0016 were untrusted and do not count.
 */
/**
 * A lab a learner may open: published, a lab type, and with a reference solution that passes its
 * cases as they stand. An edit clears the validation, so an edited lab leaves the learner's view
 * until its author checks it again (ADR-0018). The catalogue, search and the progress page all
 * count labs with this one filter.
 */
export const LIVE_LAB = {
  deletedAt: null,
  status: 'published' as const,
  type: { in: [...LAB_TYPES] },
  validation: { path: ['ok'], equals: true },
};

export const ACCEPTED_PRACTICE_RUN = {
  context: 'practice',
  verdict: 'passed',
  trust: 'trusted',
} as const;
