/**
 * Separate worker process (WORKER_MODE=separate): boots the same modules as the API without an
 * HTTP listener and runs the registered job handlers. Started through apps/worker.
 *
 *   node dist/worker.js        (built)      ·   tsx src/worker.ts   (development)
 */
process.env['LMS_PROCESS_ROLE'] = 'worker';

const { NestFactory } = await import('@nestjs/core');
const { Logger } = await import('nestjs-pino');
const { AppModule } = await import('./app.module.js');
const { APP_CONFIG } = await import('./core/config/env.js');

const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
const logger = app.get(Logger);
app.useLogger(logger);
app.enableShutdownHooks();

const config = app.get(APP_CONFIG);
if (config.WORKER_MODE !== 'separate') {
  logger.warn(
    `WORKER_MODE is "${config.WORKER_MODE}"; the separate worker only makes sense with WORKER_MODE=separate on both API and worker`,
  );
}
logger.log(`Worker running (${config.APP_ENV}, client ${config.CLIENT_KEY}); press Ctrl+C to stop`);
