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
export { NoExecutionDriver } from './no-execution.driver.js';
export { RunnerDriver } from './runner.driver.js';
export { Judge0Driver } from './judge0.driver.js';
export { outputsMatch, tablesMatch } from './compare.js';

/**
 * A practice problem counts as solved only through a submission the sandbox ran against every
 * case and passed. Runs a browser reported before ADR-0016 were untrusted and do not count.
 */
export const ACCEPTED_PRACTICE_RUN = {
  context: 'practice',
  verdict: 'passed',
  trust: 'trusted',
} as const;
