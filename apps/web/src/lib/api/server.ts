import 'server-only';
import { cookies, headers as requestHeaders } from 'next/headers';
import type { BrandingPublic, MeResponse, ProblemDetails } from '@lms/shared';
import { API_PREFIX, serverApiUrl } from '../env';
import { ApiError } from './errors';

/**
 * Server-side API call that forwards the caller's cookies (server components, route handlers).
 *
 * It also forwards who the caller is at the network level. Every server-rendered page asks the API
 * something, and in production those calls all leave from one machine: without this, the API sees
 * the whole institute as a single client and its rate limiter throttles everybody at once.
 *
 * `anonymous` sends no cookies, for a public lookup that has no business with the visitor's session.
 */
export async function serverApi<T = unknown>(
  path: string,
  init: Omit<RequestInit, 'body'> & {
    body?: unknown;
    revalidate?: number | false;
    anonymous?: boolean;
  } = {},
): Promise<T> {
  const [cookieStore, incoming] = await Promise.all([cookies(), requestHeaders()]);
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const forwardedFor = incoming.get('x-forwarded-for') ?? incoming.get('x-real-ip');
  const { body, revalidate, headers, anonymous, ...rest } = init;
  const response = await fetch(`${serverApiUrl()}${API_PREFIX}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(cookieHeader && !anonymous ? { Cookie: cookieHeader } : {}),
      ...(forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: revalidate === undefined ? 'no-store' : undefined,
    next: revalidate === undefined ? undefined : { revalidate },
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new ApiError(response.status, isProblem(data) ? data : null);
  }
  return data as T;
}

function isProblem(value: unknown): value is ProblemDetails {
  return typeof value === 'object' && value !== null && 'status' in value && 'title' in value;
}

/** The signed-in user's shell data, or null when there is no valid session. */
export async function getMe(): Promise<MeResponse | null> {
  try {
    return await serverApi<MeResponse>('/me');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

/** Public branding (no cookies needed). Not cached here: the API serves it from memory with an ETag, and a branding save must show immediately. */
export async function getBranding(): Promise<BrandingPublic> {
  const response = await fetch(`${serverApiUrl()}${API_PREFIX}/branding/public`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new ApiError(response.status, null);
  return (await response.json()) as BrandingPublic;
}
