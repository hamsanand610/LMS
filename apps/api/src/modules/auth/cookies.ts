import type { Response } from 'express';
import type { AppConfig } from '../../core/config/env.js';
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from '../../core/auth/auth-user.js';

interface CookieBundle {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  /** When false the refresh cookie is a session cookie (cleared when the browser closes). */
  persistent: boolean;
}

function baseOptions(config: AppConfig) {
  return {
    secure: config.COOKIE_SECURE,
    sameSite: 'lax' as const,
    domain: config.COOKIE_DOMAIN || undefined,
    path: '/',
  };
}

export function setAuthCookies(res: Response, config: AppConfig, bundle: CookieBundle): void {
  const base = baseOptions(config);
  const refreshMaxAge = config.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(ACCESS_COOKIE, bundle.accessToken, {
    ...base,
    httpOnly: true,
    maxAge: config.JWT_ACCESS_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, bundle.refreshToken, {
    ...base,
    httpOnly: true,
    path: '/api/v1/auth',
    ...(bundle.persistent ? { maxAge: refreshMaxAge } : {}),
  });
  // Readable by the web app so it can echo it in the X-CSRF-Token header.
  res.cookie(CSRF_COOKIE, bundle.csrfToken, {
    ...base,
    httpOnly: false,
    ...(bundle.persistent ? { maxAge: refreshMaxAge } : {}),
  });
}

export function clearAuthCookies(res: Response, config: AppConfig): void {
  const base = baseOptions(config);
  res.clearCookie(ACCESS_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(REFRESH_COOKIE, { ...base, httpOnly: true, path: '/api/v1/auth' });
  res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
}
