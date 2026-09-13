import { Global, Module } from '@nestjs/common';
import { ScopeService } from './scope.service.js';

/** Batch-scope resolution, used by every module that honours the `batch` permission scope. */
@Global()
@Module({
  providers: [ScopeService],
  exports: [ScopeService],
})
export class ScopeModule {}
