/** Public surface of the execution adapter. */
export { ExecutionModule } from './execution.module.js';
export { ExecutionService, type CodingGrade } from './execution.service.js';
export {
  EXECUTION_DRIVER,
  type ExecutionCase,
  type ExecutionCaseResult,
  type ExecutionDriver,
  type ExecutionOutcome,
  type ExecutionRequest,
} from './execution.driver.js';
export { BrowserSandboxDriver } from './browser-sandbox.driver.js';
export { Judge0Driver } from './judge0.driver.js';
