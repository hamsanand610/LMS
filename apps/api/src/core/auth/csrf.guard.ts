import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ForbiddenError } from '../http/errors.js';
import { getRequestContext } from '../http/request-context.js';
import { CSRF_COOKIE, CSRF_HEADER } from './auth-user.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF protection for cookie-authenticated mutations:
 * the `x-csrf-token` header must equal the non-httpOnly `lms_csrf` cookie.
 * Bearer-token requests are not subject to CSRF and skip this guard.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { cookies?: Record<string, string> }>();
    if (SAFE_METHODS.has(req.method)) return true;
    const ctx = getRequestContext();
    if (!ctx?.cookieAuth) return true;
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
