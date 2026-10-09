// Starts the compiled API on apps/api/.env's database with SI Academy AI's local fake provider and
// the queue's workers in this process, for previewing the AI pages (the Knowledge base page among
// them) without calling any real provider. apps/api/.env is not modified and nothing is printed of it.
//
//   node .claude/api-fake-ai.mjs [lms_<database>]   (from the repository root; see launch.json)
//
// Given a database name (another on the same server, such as the scratch `lms_test`), it uses that
// one instead; only the name changes.
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'api');
const entry = resolve(apiRoot, 'dist', 'main.js');
if (!existsSync(entry)) {
  console.error('The API is not built yet. Run: pnpm --filter @lms/api build');
  process.exit(1);
}

// Set before .env is read: the API never overrides a variable that is already set.
Object.assign(process.env, {
  AI_PROVIDER: 'fake',
  AI_FALLBACK_PROVIDER: 'none',
  AI_DATA_CLASSES: 'public,course',
  // The fake's lexical embeddings are measured against their own floor, not Gemini's.
  AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY: '0.4',
  AI_FAKE_DELAY_MS: '20',
  WORKER_MODE: 'embedded',
});
process.chdir(apiRoot);
process.loadEnvFile(resolve(apiRoot, '.env'));
const database = process.argv[2];
if (database) {
  if (!/^lms_[a-z0-9_]+$/.test(database)) {
    console.error('The database must be named lms_<something>.');
    process.exit(1);
  }
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${database}`;
  process.env.DATABASE_URL = url.toString();
}

console.log('Starting the API with the fake AI provider (apps/api/.env is unchanged).');
await import(pathToFileURL(entry).href);
