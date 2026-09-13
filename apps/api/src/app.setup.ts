import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { API_PREFIX } from '@lms/shared';
import type { AppConfig } from './core/config/env.js';
import { ProblemFilter } from './core/http/problem.filter.js';
import { createValidationPipe } from './core/http/validation.js';

/**
 * HTTP wiring shared by the real server (main.ts) and the API tests, so tests exercise the same
 * middleware, prefix, validation and error mapping as production.
 */
export function configureApp(
  app: NestExpressApplication | INestApplication,
  config: AppConfig,
): void {
  if ('set' in app && typeof app.set === 'function') {
    app.set('trust proxy', config.APP_ENV === 'local' ? false : 1);
  }
  app.use(
    helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : [config.WEB_BASE_URL],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Request-Id',
      'Idempotency-Key',
    ],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''), { exclude: ['health/live', 'health/ready'] });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ProblemFilter());
}
