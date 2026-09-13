import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { PgBossQueueDriver } from '../src/core/queue/pgboss.driver.js';

/**
 * The application tests run with WORKER_MODE=none, where jobs execute inline; that path never
 * touches pg-boss. These tests drive the real driver against the test database so a mistake in the
 * options handed to pg-boss cannot hide behind the inline path again.
 */
describe('pg-boss queue driver', () => {
  let driver: PgBossQueueDriver;
  const queue = `test.queue.${Date.now()}`;

  beforeAll(async () => {
    driver = new PgBossQueueDriver(inject('databaseUrl'));
    await driver.start();
  }, 60_000);

  afterAll(async () => {
    await driver.stop();
  });

  it('accepts a job with no options at all', async () => {
    const id = await driver.enqueue(queue, { hello: 'world' });
    expect(id).toBeTruthy();
  });

  it('accepts the options the application actually passes', async () => {
    const id = await driver.enqueue(
      queue,
      { attempt: 1 },
      { retryLimit: 5, retryDelaySeconds: 60 },
    );
    expect(id).toBeTruthy();
  });

  it('accepts a delay, a singleton key and a priority', async () => {
    const id = await driver.enqueue(
      queue,
      { kind: 'full' },
      { delaySeconds: 30, singletonKey: 'only-one', retryLimit: 1, priority: 5 },
    );
    expect(id).toBeTruthy();
  });

  it('runs a registered handler and reports queue counts', async () => {
    const seen: string[] = [];
    await driver.work<{ marker: string }>(queue, async (payload) => {
      seen.push(payload.marker);
    });
    await driver.enqueue(queue, { marker: 'processed' });
    await expect.poll(() => seen, { timeout: 20_000, interval: 500 }).toContain('processed');

    const stats = await driver.stats();
    expect(stats.failed).toBe(0);
  }, 30_000);
});
