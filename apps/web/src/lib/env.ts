/** Web environment (validated lazily; Next.js inlines NEXT_PUBLIC_* at build time). */
export const publicEnv = {
  apiUrl: (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000').replace(/\/$/, ''),
  clientKey: process.env['NEXT_PUBLIC_CLIENT_KEY'] ?? 'demo',
  appEnv: (process.env['NEXT_PUBLIC_APP_ENV'] ?? 'local') as 'local' | 'staging' | 'production',
};

/** Server-only: internal API origin used by server components and route handlers. */
export function serverApiUrl(): string {
  return (process.env['API_INTERNAL_URL'] ?? publicEnv.apiUrl).replace(/\/$/, '');
}

export const API_PREFIX = '/api/v1';
