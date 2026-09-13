import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { JobsService } from './jobs.service.js';
import { PgBossQueueDriver } from './pgboss.driver.js';
import { QUEUE_DRIVER, type QueueDriver } from './queue.driver.js';

@Global()
@Module({
  providers: [
    {
      provide: QUEUE_DRIVER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): QueueDriver => new PgBossQueueDriver(config.DATABASE_URL),
    },
    JobsService,
  ],
  exports: [JobsService, QUEUE_DRIVER],
})
export class QueueModule {}
