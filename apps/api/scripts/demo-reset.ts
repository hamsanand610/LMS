/**
 * Local/staging reset (architecture plan §21.3): drops and recreates the schema, applies all
 * migrations, then runs the base seed, the demo seed and the Super Admin CLI.
 * Refuses to run in production. Sample files and bucket clearing arrive with the content phases.
 *
 *   pnpm demo:reset            (from the repository root)
 */
import { execSync } from 'node:child_process';
import { loadConfig } from '../src/core/config/env.js';

const config = loadConfig();
if (config.APP_ENV === 'production') {
  console.error('demo:reset is disabled in production (operating rule 23).');
  process.exit(1);
}

const steps: [string, string][] = [
  ['Reset schema and apply migrations', 'pnpm exec prisma migrate reset --force --skip-seed'],
  ['Base seed', 'pnpm exec tsx prisma/seed/base.ts'],
  ['Demo accounts', 'pnpm exec tsx prisma/seed/demo.ts'],
  [
    'Super Admin',
    `pnpm exec tsx src/cli/main.ts users:create-admin --email ${config.SEED_ADMIN_EMAIL} --name "Super Admin"`,
  ],
];

for (const [label, command] of steps) {
  console.log(`\n▶ ${label}`);
  execSync(command, { stdio: 'inherit', env: process.env });
}
console.log('\nDemo reset complete.');
