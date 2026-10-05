import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { APP_CONFIG, type AppConfig } from '../../src/core/config/env.js';
import { STORAGE_DRIVER } from '../../src/core/storage/storage.driver.js';
import { AI_PROVIDER, type AiProvider } from '../../src/modules/ai/index.js';
import { AI_FALLBACK_PROVIDER } from '../../src/modules/ai/providers/ai-provider.js';
import { AiCircuitBreakers } from '../../src/modules/ai/routing/circuit-breaker.js';
import { EXECUTION_DRIVER } from '../../src/modules/execution/index.js';
import { FakeExecutionDriver } from './fake-execution.driver.js';
import { MemoryStorageDriver } from './memory-storage.driver.js';

/**
 * Boots the complete application (all modules, guards, pipes and filters) against the test
 * database. Each test file gets its own instance, so in-memory rate-limit counters start fresh.
 * `aiProvider` stands in for SI Academy AI's provider (Phase 7C): its name must be the configured
 * `AI_PROVIDER`'s, as the router checks; `aiFallbackProvider` for the one that stands in for it
 * (ADR-0038), named as `AI_FALLBACK_PROVIDER`. `circuits` replaces the models' circuits, so a test
 * can keep their threshold and rest and still say what time it is.
 */
export async function createTestApp(
  options: {
    aiProvider?: AiProvider;
    aiFallbackProvider?: AiProvider;
    circuits?: AiCircuitBreakers;
  } = {},
): Promise<INestApplication> {
  Object.assign(process.env, {
    LMS_SKIP_ENV_FILE: '1',
    APP_ENV: 'local',
    CLIENT_KEY: 'demo',
    DATABASE_URL: inject('databaseUrl'),
    JWT_ACCESS_SECRET: inject('jwtSecret'),
    WORKER_MODE: 'none',
    EMAIL_DRIVER: 'none',
    LOG_LEVEL: 'error',
    WEB_BASE_URL: 'http://localhost:3000',
    CORS_ORIGINS: 'http://localhost:3000',
  });
  // Code is never really run in these tests: the stand-in reads markers in the "program" instead.
  // Files the server writes (exports) go to memory, so the tests need PostgreSQL and nothing else.
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EXECUTION_DRIVER)
    .useValue(new FakeExecutionDriver())
    .overrideProvider(STORAGE_DRIVER)
    .useValue(new MemoryStorageDriver());
  if (options.aiProvider)
    builder = builder.overrideProvider(AI_PROVIDER).useValue(options.aiProvider);
  if (options.aiFallbackProvider) {
    builder = builder.overrideProvider(AI_FALLBACK_PROVIDER).useValue(options.aiFallbackProvider);
  }
  if (options.circuits)
    builder = builder.overrideProvider(AiCircuitBreakers).useValue(options.circuits);
  const moduleRef = await builder.compile();
  // Silent by default so a passing run stays readable; LMS_TEST_LOG=1 shows the server's own errors.
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: process.env['LMS_TEST_LOG'] === '1' ? ['error', 'warn'] : false,
  });
  configureApp(app, app.get<AppConfig>(APP_CONFIG));
  await app.init();
  // Listening once, as the real server does, until `app.close()`. A server left stopped is started
  // by supertest for the first request that finds it so, and stopped again when that request ends,
  // while requests sent alongside it may still be waiting to be accepted; on Linux, stopping a
  // listening socket resets them (`read ECONNRESET`, CI runs #25 to #28). Loopback only.
  await app.listen(0, '127.0.0.1');
  return app;
}
