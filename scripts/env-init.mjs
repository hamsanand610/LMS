// Copies every .env.example to its .env counterpart when the target does not exist yet.
// Usage: pnpm env:init  (never overwrites existing files)
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pairs = [
  ['.env.example', '.env'],
  ['apps/api/.env.example', 'apps/api/.env'],
  ['apps/web/.env.example', 'apps/web/.env.local'],
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
