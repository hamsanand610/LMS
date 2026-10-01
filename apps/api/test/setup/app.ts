import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { APP_CONFIG, type AppConfig } from '../../src/core/config/env.js';
import { STORAGE_DRIVER } from '../../src/core/storage/storage.driver.js';
import { EXECUTION_DRIVER } from '../../src/modules/execution/index.js';
import { FakeExecutionDriver } from './fake-execution.driver.js';
import { MemoryStorageDriver } from './memory-storage.driver.js';

/**
 * Boots the complete application (all modules, guards, pipes and filters) against the test
 * database. Each test file gets its own instance, so in-memory rate-limit counters start fresh.
 */
export async function createTestApp(): Promise<INestApplication> {
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
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EXECUTION_DRIVER)
    .useValue(new FakeExecutionDriver())
    .overrideProvider(STORAGE_DRIVER)
    .useValue(new MemoryStorageDriver())
    .compile();
  // Silent by default so a passing run stays readable; LMS_TEST_LOG=1 shows the server's own errors.
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: process.env['LMS_TEST_LOG'] === '1' ? ['error', 'warn'] : false,
  });
  configureApp(app, app.get<AppConfig>(APP_CONFIG));
  await app.init();
  return app;
}
