import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { EXECUTION_DRIVER, type ExecutionDriver } from './execution.driver.js';
import { ExecutionService } from './execution.service.js';
import { Judge0Driver } from './judge0.driver.js';
import { NoExecutionDriver } from './no-execution.driver.js';
import { RunnerDriver } from './runner.driver.js';

/**
 * Code execution (ADR-0007, ADR-0016). No permissions, no navigation and no manifest: this is
 * machinery the assessment modules share, in the same way they share storage, and the driver is
 * chosen by configuration.
 */
@Module({
  providers: [
    RunnerDriver,
    Judge0Driver,
    NoExecutionDriver,
    {
      provide: EXECUTION_DRIVER,
      inject: [APP_CONFIG, RunnerDriver, Judge0Driver, NoExecutionDriver],
      useFactory: (
        config: AppConfig,
        runner: RunnerDriver,
        judge0: Judge0Driver,
        none: NoExecutionDriver,
      ): ExecutionDriver =>
        config.EXECUTION_DRIVER === 'runner'
          ? runner
          : config.EXECUTION_DRIVER === 'judge0'
            ? judge0
            : none,
    },
    ExecutionService,
  ],
  exports: [ExecutionService, EXECUTION_DRIVER],
})
export class ExecutionModule {}
