import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { APP_CONFIG, type AppConfig } from '../../src/core/config/env.js';

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
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  // Silent by default so a passing run stays readable; LMS_TEST_LOG=1 shows the server's own errors.
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: process.env['LMS_TEST_LOG'] === '1' ? ['error', 'warn'] : false,
  });
  configureApp(app, app.get<AppConfig>(APP_CONFIG));
  await app.init();
  return app;
}
