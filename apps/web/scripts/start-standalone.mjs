/**
 * Runs the production build.
 *
 * `output: 'standalone'` is what the container image needs, and `next start` does not serve that
 * output. The standalone server expects the static assets and `public/` beside it, which the
 * Dockerfile copies in as its own layers; this does the same thing for a local or CI run, so
 * "production mode" means one thing everywhere.
 */
import { cp, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const standalone = join(webRoot, '.next', 'standalone', 'apps', 'web');

await mkdir(join(standalone, '.next'), { recursive: true });
await cp(join(webRoot, '.next', 'static'), join(standalone, '.next', 'static'), {
  recursive: true,
});
await cp(join(webRoot, 'public'), join(standalone, 'public'), { recursive: true }).catch(() => {
  // A build with no public directory is fine; there is simply nothing to copy.
});

const child = spawn(process.execPath, [join(standalone, 'server.js')], {
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env['PORT'] ?? '3000' },
});
child.on('exit', (code) => process.exit(code ?? 0));
