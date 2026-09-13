import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import {
  type EnqueueOptions,
  type JobHandler,
  QUEUE_DRIVER,
  type QueueDriver,
} from './queue.driver.js';

interface Registration {
  name: string;
  handler: JobHandler<never>;
  concurrency?: number;
  cron?: string;
}

/**
 * Facade modules use to enqueue work and register handlers. Handlers run in this process when
 * WORKER_MODE=embedded, or in apps/worker when WORKER_MODE=separate.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(JobsService.name);
  private readonly registrations: Registration[] = [];

  constructor(
    @Inject(QUEUE_DRIVER) private readonly driver: QueueDriver,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Register a handler (call from a module's onModuleInit). */
  register<T>(
    name: string,
    handler: JobHandler<T>,
    options: { concurrency?: number; cron?: string } = {},
  ): void {
    this.registrations.push({ name, handler: handler as JobHandler<never>, ...options });
  }

  async enqueue<T>(name: string, payload: T, options?: EnqueueOptions): Promise<string | null> {
    return this.driver.enqueue(name, payload, options);
  }

  async stats(): Promise<{ queued: number; active: number; failed: number; mode: string }> {
    const s = await this.driver.stats();
    return { ...s, mode: this.config.WORKER_MODE };
  }

  async retry(jobId: string): Promise<boolean> {
    return this.driver.retryFailed(jobId);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.WORKER_MODE === 'none') return;
    await this.driver.start();
    const runWorkers =
      this.config.WORKER_MODE === 'embedded' || process.env['LMS_PROCESS_ROLE'] === 'worker';
    for (const reg of this.registrations) {
      await this.driver.ensureQueue(reg.name);
      if (reg.cron) await this.driver.schedule(reg.name, reg.cron);
      if (runWorkers) {
        await this.driver.work(reg.name, reg.handler as JobHandler<unknown>, {
          concurrency: reg.concurrency,
        });
      }
    }
    this.logger.log(
      `Queue ready (${this.registrations.length} handlers, workers ${runWorkers ? 'on' : 'off'})`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.driver.stop();
  }
}
