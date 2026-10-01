// Copies every .env.example to its .env counterpart when the target does not exist yet.
// Usage: pnpm env:init  (never overwrites existing files)
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pairs = [
  ['.env.example', '.env'],
  ['apps/api/.env.example', 'apps/api/.env'],
  ['apps/web/.env.example', 'apps/web/.env.local'],
  ['apps/runner/.env.example', 'apps/runner/.env'],
];

for (const [from, to] of pairs) {
  const source = resolve(root, from);
  const target = resolve(root, to);
  if (!existsSync(source)) {
    console.warn(`skip: ${from} does not exist`);
    continue;
  }
  if (existsSync(target)) {
    console.log(`keep: ${to} already exists`);
    continue;
  }
  copyFileSync(source, target);
  console.log(`created: ${to}`);
}

// The API and the sandbox runner share one token (ADR-0016). When both files still have an empty
// RUNNER_TOKEN line, one random token goes into both; a value already there is never replaced,
// and the token is never printed.
const tokenFiles = ['apps/api/.env', 'apps/runner/.env'].map((file) => resolve(root, file));
// The optional \r keeps a file with Windows line endings working, and is written back as it was.
const EMPTY_TOKEN = /^RUNNER_TOKEN=[ \t]*(\r?)$/m;
if (tokenFiles.every((file) => existsSync(file) && EMPTY_TOKEN.test(readFileSync(file, 'utf8')))) {
  const token = randomBytes(32).toString('base64url');
  for (const file of tokenFiles) {
    writeFileSync(file, readFileSync(file, 'utf8').replace(EMPTY_TOKEN, `RUNNER_TOKEN=${token}$1`));
  }
  console.log('set: one shared RUNNER_TOKEN in apps/api/.env and apps/runner/.env');
}
