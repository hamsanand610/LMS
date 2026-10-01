import { Logger } from '@nestjs/common';
import { PgBoss, type Job } from 'pg-boss';
import type { EnqueueOptions, JobHandler, QueueDriver } from './queue.driver.js';

/** pg-boss driver: jobs and schedules live in the application's PostgreSQL database (schema `pgboss`). */
export class PgBossQueueDriver implements QueueDriver {
  private readonly logger = new Logger(PgBossQueueDriver.name);
  private readonly boss: PgBoss;
  private started = false;
  private readonly knownQueues = new Set<string>();

  constructor(connectionString: string) {
    this.boss = new PgBoss({ connectionString, schema: 'pgboss' });
    this.boss.on('error', (error: Error) => this.logger.error({ err: error }, 'pg-boss error'));
  }

  async start(): Promise<void> {
    if (this.started) return;
    await this.boss.start();
    this.started = true;
    this.logger.log('pg-boss started');
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    await this.boss.stop({ graceful: true, timeout: 10_000 });
    this.started = false;
  }

  async ensureQueue(name: string): Promise<void> {
    if (this.knownQueues.has(name)) return;
    await this.boss.createQueue(name);
    this.knownQueues.add(name);
  }

  async enqueue<T>(name: string, payload: T, options: EnqueueOptions = {}): Promise<string | null> {
    await this.ensureQueue(name);
    // pg-boss validates each key it is given, so an option that was not asked for must be absent
    // rather than present-and-undefined ("priority must be an integer" otherwise).
    const sendOptions: Record<string, unknown> = {
      retryLimit: options.retryLimit ?? 3,
      retryDelay: options.retryDelaySeconds ?? 30,
      retryBackoff: true,
    };
    if (options.delaySeconds !== undefined) sendOptions['startAfter'] = options.delaySeconds;
    if (options.singletonKey !== undefined) sendOptions['singletonKey'] = options.singletonKey;
    if (options.priority !== undefined) sendOptions['priority'] = options.priority;
    return this.boss.send(name, payload as object, sendOptions);
  }

  async work<T>(
    name: string,
    handler: JobHandler<T>,
    options: { concurrency?: number } = {},
  ): Promise<void> {
    await this.ensureQueue(name);
    await this.boss.work<T>(
      name,
      // The retry count and limit come with each job only when asked for.
      { batchSize: options.concurrency ?? 1, includeMetadata: true },
      async (jobs: Job<T>[]) => {
        for (const job of jobs) {
          const meta = job as { retryCount?: number; retryLimit?: number };
          const attempt = meta.retryCount ?? 0;
          await handler(job.data, {
            id: job.id,
            name: job.name,
            attempt,
            final: attempt >= (meta.retryLimit ?? 0),
          });
        }
      },
    );
  }

  async schedule<T>(name: string, cron: string, payload?: T): Promise<void> {
    await this.ensureQueue(name);
    await this.boss.schedule(name, cron, (payload ?? {}) as object, { tz: 'Asia/Kolkata' });
  }

  async unschedule(name: string): Promise<void> {
    await this.boss.unschedule(name);
  }

  async stats(): Promise<{ queued: number; active: number; failed: number }> {
    const queues = await this.boss.getQueues();
    let queued = 0;
    let active = 0;
    let failed = 0;
    for (const q of queues) {
      queued += Number((q as { queuedCount?: number }).queuedCount ?? 0);
      active += Number((q as { activeCount?: number }).activeCount ?? 0);
      failed += Number((q as { failedCount?: number }).failedCount ?? 0);
    }
    return { queued, active, failed };
  }

  async retryFailed(jobId: string): Promise<boolean> {
    // pg-boss needs the queue name to resume; callers pass "queue:id".
    const [queue, id] = jobId.split(':');
    if (!queue || !id) return false;
    await this.boss.retry(queue, id);
    return true;
  }
}
