import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { API_PREFIX } from '@lms/shared';
import type { AppConfig } from './core/config/env.js';
import { ProblemFilter } from './core/http/problem.filter.js';
import { createValidationPipe } from './core/http/validation.js';

const MB = 1024 * 1024;
const IMPORT_BODY_BYTES = 6 * MB;
const BODY_BYTES = 1 * MB;
const IMPORT_ROUTES = new Set([`${API_PREFIX}/questions/import`, `${API_PREFIX}/students/import`]);

/** Answers an oversized request from its declared length, before any of it is parsed. */
function refuseOversizedBodies(req: Request, res: Response, next: NextFunction): void {
  const declared = Number(req.headers['content-length'] ?? 0);
  const importing = IMPORT_ROUTES.has(req.path);
  const limit = importing ? IMPORT_BODY_BYTES : BODY_BYTES;
  // A body sent in chunks declares no length; outside the imports it is not read at all (Phase 6).
  const chunked = !req.headers['content-length'] && Boolean(req.headers['transfer-encoding']);
  if (declared > limit || (chunked && !importing)) {
    res
      .status(413)
      .type('application/problem+json')
      .json({
        type: 'urn:lms:error:payload_too_large',
        title: 'Request too large',
        status: 413,
        code: 'payload_too_large',
        detail: `This request can carry at most ${limit / MB} MB`,
        instance: req.originalUrl,
      });
    return;
  }
  next();
}

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
  /*
   * Request bodies: sheet imports carry a whole workbook, so their two routes take up to 6 MB;
   * everything else (a code answer is the largest) is refused above 1 MB before it is read.
   */
  // The size check runs before the parser, or a 6 MB body would be read before being refused.
  app.use(refuseOversizedBodies);
  if ('useBodyParser' in app && typeof app.useBodyParser === 'function') {
    app.useBodyParser('json', { limit: IMPORT_BODY_BYTES });
  }
  // Answers carry personal data and tokens: no shared or browser cache keeps them. A route that
  // may be cached (public branding) says so itself, after this (Phase 6).
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
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
