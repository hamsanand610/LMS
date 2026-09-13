import type { Portal } from '@lms/shared';

/** Landing route for each portal. */
export function portalHome(portal: Portal): string {
  switch (portal) {
    case 'admin':
      return '/admin';
    case 'trainer':
      return '/trainer';
    case 'student':
    default:
      return '/dashboard';
  }
}

/** Only allow internal, relative redirect targets from query strings. */
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}
