/**
 * Operational CLI for the API. Runs without booting the HTTP server.
 *
 *   pnpm --filter @lms/api cli users:create-admin --email superadmin@demo.local --name "Super Admin" [--password ...]
 *
 * The password comes from --password, then SEED_ADMIN_PASSWORD, otherwise a random one is generated
 * and printed once. Passwords are never written to files or logs.
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { emailSchema, SYSTEM_ROLES } from '@lms/shared';
import { createStandaloneContext as createSeedContext } from '../core/prisma/standalone.js';
import { hashPassword } from '../modules/auth/password.js';
import { syncSystemRoles } from '../modules/rbac/sync.js';

async function createAdmin(args: Record<string, string | boolean | undefined>): Promise<void> {
  const { config, prisma } = createSeedContext();
  const email = emailSchema.parse(String(args['email'] ?? config.SEED_ADMIN_EMAIL));
  const name = String(args['name'] ?? 'Super Admin');
  const providedPassword =
    typeof args['password'] === 'string' ? args['password'] : config.SEED_ADMIN_PASSWORD;
  const generated = !providedPassword;
  const password = providedPassword || randomBytes(12).toString('base64url');
  if (password.length < 10) throw new Error('Password must be at least 10 characters');

  const organization = await prisma.organization.findUnique({ where: { key: config.CLIENT_KEY } });
  if (!organization)
    throw new Error(`Organisation "${config.CLIENT_KEY}" not found. Run "pnpm db:seed" first.`);
  await syncSystemRoles(prisma, organization.id);
  const role = await prisma.role.findUniqueOrThrow({
    where: {
      organizationId_key: { organizationId: organization.id, key: SYSTEM_ROLES.SUPER_ADMIN },
    },
  });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      organizationId: organization.id,
      email,
      name,
      passwordHash,
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: { create: [{ roleId: role.id }] },
    },
    update: { name, passwordHash, status: 'active', tokenVersion: { increment: 1 } },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });
  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      actorId: null,
      action: 'cli.create_admin',
      resourceType: 'user',
      resourceId: user.id,
      summary: `Super Admin ${email} created or reset by CLI`,
    },
  });
  await prisma.$disconnect();

  console.log(`Super Admin ready: ${email} (${user.id})`);
  if (generated) console.log(`Generated password (shown once): ${password}`);
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      password: { type: 'string' },
    },
  });
  const command = positionals[0];
  switch (command) {
    case 'users:create-admin':
      await createAdmin(values);
      break;
    default:
      console.error(
        'Usage: cli <command>\n  users:create-admin --email <email> --name <name> [--password <password>]',
      );
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
