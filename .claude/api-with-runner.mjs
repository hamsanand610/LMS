// Starts the sandbox runner and the compiled API together, on another database of the same
// PostgreSQL server as apps/api/.env, for previewing code execution locally. The runner token is
// generated here, handed to both processes through their environment and never printed or
// written anywhere; it lasts as long as this process. apps/api/.env is not modified.
//
//   node .claude/api-with-runner.mjs lms_siacademy      (from the repository root; see launch.json)
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const database = process.argv[2] ?? '';
if (!/^lms_[a-z0-9_]+$/.test(database)) {
  console.error('Usage: node .claude/api-with-runner.mjs <database>   e.g. lms_siacademy');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = resolve(root, 'apps', 'api');
const apiEntry = resolve(apiRoot, 'dist', 'main.js');
const runnerEntry = resolve(root, 'apps', 'runner', 'dist', 'main.js');
for (const [entry, name] of [
  [apiEntry, '@lms/api'],
  [runnerEntry, '@lms/runner'],
]) {
  if (!existsSync(entry)) {
    console.error(`${name} is not built yet. Run: pnpm --filter ${name} build`);
    process.exit(1);
  }
}

const token = randomBytes(32).toString('base64url');
const runnerPort = '4100';

const runner = spawn(process.execPath, [runnerEntry], {
  cwd: resolve(root, 'apps', 'runner'),
  env: { ...process.env, RUNNER_TOKEN: token, RUNNER_PORT: runnerPort, RUNNER_HOST: '127.0.0.1' },
  stdio: ['ignore', 'inherit', 'inherit'],
  windowsHide: true,
});
const stopRunner = () => {
  if (runner.exitCode === null) runner.kill();
};
process.on('exit', stopRunner);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopRunner();
    process.exit(0);
  });
}
runner.on('exit', (code) => {
  console.error(
    `The runner stopped (exit ${code ?? 'signal'}); code cannot be run until it is restarted.`,
  );
});

// The API reads .env from its working directory; the database and execution settings are then
// pointed at this preview.
process.chdir(apiRoot);
process.loadEnvFile(resolve(apiRoot, '.env'));
const url = new URL(process.env.DATABASE_URL);
url.pathname = `/${database}`;
process.env.DATABASE_URL = url.toString();
process.env.EXECUTION_DRIVER = 'runner';
process.env.RUNNER_URL = `http://127.0.0.1:${runnerPort}`;
process.env.RUNNER_TOKEN = token;

console.log(
  `Starting the runner and the API on database "${database}" (apps/api/.env is unchanged).`,
);
await import(pathToFileURL(apiEntry).href);
