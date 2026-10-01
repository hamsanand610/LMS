// Starts the compiled API against another database on the same PostgreSQL server as apps/api/.env,
// for previewing data seeded into a scratch database while the main one is left alone. Only the
// database name changes; apps/api/.env is not modified and the connection string is never printed.
//
//   node .claude/api-on-database.mjs lms_siacademy      (from the repository root; see launch.json)
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const database = process.argv[2] ?? '';
if (!/^lms_[a-z0-9_]+$/.test(database)) {
  console.error('Usage: node .claude/api-on-database.mjs <database>   e.g. lms_siacademy');
  process.exit(1);
}

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'api');
const entry = resolve(apiRoot, 'dist', 'main.js');
if (!existsSync(entry)) {
  console.error('The API is not built yet. Run: pnpm --filter @lms/api build');
  process.exit(1);
}

// The API reads .env from its working directory and never overrides a variable that is already
// set, so setting DATABASE_URL here is what redirects it.
process.chdir(apiRoot);
process.loadEnvFile(resolve(apiRoot, '.env'));
const url = new URL(process.env.DATABASE_URL);
url.pathname = `/${database}`;
process.env.DATABASE_URL = url.toString();

console.log(`Starting the API on database "${database}" (apps/api/.env is unchanged).`);
await import(pathToFileURL(entry).href);
