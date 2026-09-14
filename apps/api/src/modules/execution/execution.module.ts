import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { BrowserSandboxDriver } from './browser-sandbox.driver.js';
import { EXECUTION_DRIVER, type ExecutionDriver } from './execution.driver.js';
import { ExecutionService } from './execution.service.js';
import { Judge0Driver } from './judge0.driver.js';

/**
 * Code execution (ADR-0007). No permissions, no navigation and no manifest: this is machinery the
 * assessment modules share, in the same way they share storage, and it is chosen by configuration.
 */
@Module({
  providers: [
    BrowserSandboxDriver,
    Judge0Driver,
    {
      provide: EXECUTION_DRIVER,
      inject: [APP_CONFIG, BrowserSandboxDriver, Judge0Driver],
      useFactory: (
        config: AppConfig,
        browser: BrowserSandboxDriver,
        judge0: Judge0Driver,
      ): ExecutionDriver => (config.EXECUTION_DRIVER === 'judge0' ? judge0 : browser),
    },
    ExecutionService,
  ],
  exports: [ExecutionService, EXECUTION_DRIVER],
})
export class ExecutionModule {}
