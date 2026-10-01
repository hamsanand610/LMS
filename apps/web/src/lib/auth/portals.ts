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

/** A stand-in origin: a target that resolves anywhere else leaves this app. */
const HERE = 'https://app.invalid';

/** Backslashes and control characters, which browsers rewrite or drop before they navigate. */
const REWRITTEN_BY_BROWSERS = /[\\\u0000-\u001f\u007f]/;

/**
 * Only allow internal, relative redirect targets from query strings. Browsers read a backslash as
 * a slash and drop tabs and newlines, so a target such as "/" + "\" + "evil.example" would otherwise
 * leave the site; the target is resolved the way a browser would and kept only if it stays here.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  if (REWRITTEN_BY_BROWSERS.test(value)) return null;
  try {
    const url = new URL(value, HERE);
    if (url.origin !== HERE) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
