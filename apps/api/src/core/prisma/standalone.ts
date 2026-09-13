import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { loadConfig, type AppConfig } from '../config/env.js';

/**
 * Bootstrap for scripts that run without the HTTP server (seeds, CLI): validated config plus a
 * single Prisma client. Production seeding is blocked unless explicitly allowed.
 */
export function createStandaloneContext(): { config: AppConfig; prisma: PrismaClient } {
  const config = loadConfig();
  if (config.APP_ENV === 'production' && process.env['LMS_ALLOW_PRODUCTION_SEED'] !== '1') {
    throw new Error(
      'Seeding is disabled in production. Set LMS_ALLOW_PRODUCTION_SEED=1 only for the base seed of a new deployment.',
    );
  }
  const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  return { config, prisma };
}
