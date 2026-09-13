import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { loadConfig } from '../../src/core/config/env.js';
export function createSeedContext() {
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
//# sourceMappingURL=client.js.map
