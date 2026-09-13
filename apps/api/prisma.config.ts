import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

// Loads apps/api/.env for the Prisma CLI (the app itself loads it in src/core/config/env.ts).
const envFile = resolve(import.meta.dirname, '.env');
if (existsSync(envFile) && !process.env['DATABASE_URL']) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/base.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
