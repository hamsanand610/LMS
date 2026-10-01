export interface EnqueueOptions {
  /** Delay before the job becomes available, in seconds. */
  delaySeconds?: number;
  /** Unique key: a second job with the same key is ignored while the first is queued/active. */
  singletonKey?: string;
  /** Retry attempts on failure (default 3). */
  retryLimit?: number;
  /** Seconds between retries (with backoff). */
  retryDelaySeconds?: number;
  /** Priority (higher runs first). */
  priority?: number;
}

export interface JobMeta {
  id: string;
  name: string;
  /** Retries so far: 0 on the first run. */
  attempt: number;
  /** True when a failure now will not be retried, so the handler must settle the work itself. */
  final: boolean;
}

export interface JobHandler<T = unknown> {
  (payload: T, meta: JobMeta): Promise<void>;
}

/** Abstraction over the queue backend. Default implementation: pg-boss on PostgreSQL. */
export interface QueueDriver {
  start(): Promise<void>;
  stop(): Promise<void>;
  ensureQueue(name: string): Promise<void>;
  enqueue<T>(name: string, payload: T, options?: EnqueueOptions): Promise<string | null>;
  work<T>(name: string, handler: JobHandler<T>, options?: { concurrency?: number }): Promise<void>;
  schedule<T>(name: string, cron: string, payload?: T): Promise<void>;
  unschedule(name: string): Promise<void>;
  stats(): Promise<{ queued: number; active: number; failed: number }>;
  retryFailed(jobId: string): Promise<boolean>;
}

export const QUEUE_DRIVER = Symbol('QUEUE_DRIVER');
