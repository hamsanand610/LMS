import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadConfig, type RunnerConfig } from './config.js';
import { createSandbox } from './sandbox.js';
import { createServer } from './server.js';

/**
 * The sandbox runner (ADR-0016). It starts one locked-down container per job and never runs any
 * of the code itself. Configure it with RUNNER_TOKEN (required) and, optionally, RUNNER_HOST,
 * RUNNER_PORT, RUNNER_IMAGE, RUNNER_CONCURRENCY, RUNNER_QUEUE and RUNNER_CPUS.
 */
// Local development keeps these in apps/runner/.env (see .env.example); variables already set in
// the environment win, as they do for the API.
if (existsSync('.env')) process.loadEnvFile('.env');
const config = loadConfig();

const server = createServer({
  config,
  runJob: createSandbox(config),
  health: () => dockerHealth(config),
  log: (line) =>
    process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), ...line })}\n`),
});

server.listen(config.RUNNER_PORT, config.RUNNER_HOST, () => {
  process.stdout.write(
    `${JSON.stringify({
      time: new Date().toISOString(),
      message: `Runner listening on ${config.RUNNER_HOST}:${config.RUNNER_PORT}`,
      image: config.RUNNER_IMAGE,
      concurrency: config.RUNNER_CONCURRENCY,
    })}\n`,
  );
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // Jobs in flight get their own deadline; this is the backstop.
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}

/** Docker answers, and the sandbox image is present. */
function dockerHealth(settings: RunnerConfig): Promise<{ ok: boolean; detail?: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      settings.RUNNER_DOCKER,
      ['image', 'inspect', '--format', '{{.Id}}', settings.RUNNER_IMAGE],
      { stdio: 'ignore', shell: false, windowsHide: true },
    );
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, detail: 'Docker did not answer in time' });
    }, 10_000);
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ ok: false, detail: 'Docker is not available' });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(
        code === 0
          ? { ok: true }
          : { ok: false, detail: `The image ${settings.RUNNER_IMAGE} is not present` },
      );
    });
  });
}
