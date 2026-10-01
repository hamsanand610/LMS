import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

/** The origin part of a URL, or null when the value is not one. */
function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const appEnv = process.env['NEXT_PUBLIC_APP_ENV'] ?? 'local';
const development = process.env['NODE_ENV'] === 'development';
const apiOrigin = originOf(process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000');
/*
 * Where uploads go and files come from: the object store's browser-facing address. Locally that is
 * the MinIO container; elsewhere it is whatever the deployment serves files from.
 */
const storageOrigin = originOf(
  process.env['NEXT_PUBLIC_STORAGE_URL'] ?? (appEnv === 'local' ? 'http://localhost:9000' : ''),
);
const own = ["'self'", apiOrigin, storageOrigin].filter(Boolean).join(' ');

/*
 * Lesson bodies are cleaned by the API before they are stored; this policy is the second line: no
 * plug-ins, no framing by other sites, no forms posting elsewhere, and scripts only from this app.
 * Learners' code never runs in the browser (ADR-0016), so no WebAssembly, no third-party runtime
 * and no blob workers are allowed. Inline scripts stay allowed because the framework's hydration
 * data and the theme bootstrap are inline.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${own} data: blob: https:`,
  `media-src ${own} blob:`,
  "font-src 'self' data:",
  `connect-src ${own}${development ? ' ws: wss:' : ''}`,
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  // Only where the site is served over HTTPS; a browser ignores it on plain HTTP anyway.
  ...(appEnv === 'local'
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
];

const nextConfig: NextConfig = {
  /*
   * `standalone` emits a self-contained server with only the files it needs, which is what the
   * staging image copies. It changes nothing about `next dev`.
   */
  output: 'standalone',
  /*
   * The monorepo root, so the traced output includes the workspace packages the app imports.
   * `fileURLToPath` rather than `.pathname`: on Windows the latter yields `/E:/…`, which is a URL
   * path and not a path any filesystem will accept.
   */
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
