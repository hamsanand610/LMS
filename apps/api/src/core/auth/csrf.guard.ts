import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { ForbiddenError } from '../http/errors.js';
import { getRequestContext } from '../http/request-context.js';
import { CSRF_COOKIE, CSRF_HEADER } from './auth-user.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF protection for cookie-authenticated mutations:
 * the `x-csrf-token` header must equal the non-httpOnly `lms_csrf` cookie.
 * Bearer-token requests are not subject to CSRF and skip this guard.
 *
 * A state-changing request that carries no session cookie (signing in, a refresh, accepting an
 * invitation) is checked by its origin instead (Phase 6): a page elsewhere must not be able to
 * post a sign-in and leave the browser signed in to an account of its choosing. Browsers always
 * send `Origin` on such requests; clients that are not browsers send none and pass.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly origins: Set<string>;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const allowed = config.CORS_ORIGINS.length ? config.CORS_ORIGINS : [config.WEB_BASE_URL];
    this.origins = new Set(allowed.map(normaliseOrigin));
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { cookies?: Record<string, string> }>();
    if (SAFE_METHODS.has(req.method)) return true;
    const ctx = getRequestContext();
    if (!ctx?.cookieAuth) {
      const origin = req.headers.origin;
      if (typeof origin === 'string' && !this.origins.has(normaliseOrigin(origin))) {
        throw new ForbiddenError('Requests from that site are not accepted', 'csrf_failed');
      }
      return true;
    }
    const header = req.headers[CSRF_HEADER];
    const cookie = req.cookies?.[CSRF_COOKIE];
    if (
      typeof header !== 'string' ||
      typeof cookie !== 'string' ||
      header.length === 0 ||
      header !== cookie
    ) {
      throw new ForbiddenError('Missing or invalid CSRF token', 'csrf_failed');
    }
    return true;
  }
}

/** An origin as browsers send it: scheme, host and port, lower-case, no trailing slash. */
function normaliseOrigin(origin: string): string {
  return origin.trim().toLowerCase().replace(/\/+$/, '');
}
