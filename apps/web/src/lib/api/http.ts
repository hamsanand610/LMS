'use client';

import type { ProblemDetails } from '@lms/shared';
import { API_PREFIX, publicEnv } from '../env';
import { ApiError } from './errors';

const CSRF_COOKIE = 'lms_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/** The CSRF header a mutation carries: the value of the CSRF cookie the API set (double submit). */
export function csrfHeader(): Record<string, string> {
  return { [CSRF_HEADER]: readCookie(CSRF_COOKIE) ?? '' };
}

let refreshing: Promise<boolean> | null = null;

/** Refreshes the access cookie once for concurrent callers; resolves false when the session is gone. */
export async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${publicEnv.apiUrl}${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfHeader(),
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => {
          refreshing = null;
        }, 0);
      });
  }
  return refreshing;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip the automatic refresh-and-retry on 401 (used by the auth pages themselves). */
  noRefresh?: boolean;
}

/**
 * Browser-side API call: JSON in/out, cookies included, CSRF header on mutations,
 * one transparent refresh on 401, problem+json mapped to ApiError.
 */
export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, noRefresh, headers, ...init } = options;
  const method = (init.method ?? (body === undefined ? 'GET' : 'POST')).toUpperCase();
  const request = (): Promise<Response> =>
    fetch(`${publicEnv.apiUrl}${API_PREFIX}${path}`, {
      ...init,
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' && method !== 'HEAD' ? csrfHeader() : {}),
        ...(headers as Record<string, string> | undefined),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let response = await request();
  if (response.status === 401 && !noRefresh && !path.startsWith('/auth/')) {
    const ok = await refreshSession();
    if (ok) response = await request();
  }
  if (response.status === 204 || response.status === 304) return undefined as T;
  const text = await response.text();
  const data = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new ApiError(response.status, isProblem(data) ? data : null);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isProblem(value: unknown): value is ProblemDetails {
  return typeof value === 'object' && value !== null && 'status' in value && 'title' in value;
}
