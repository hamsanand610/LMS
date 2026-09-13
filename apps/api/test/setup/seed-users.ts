/**
 * Seeds one account per system role for the API tests (run by global-setup.ts with the test
 * database and a per-run password in LMS_TEST_PASSWORD). Idempotent; resets lockouts.
 */
import { SYSTEM_ROLES } from '@lms/shared';
import { createStandaloneContext } from '../../src/core/prisma/standalone.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { syncSystemRoles } from '../../src/modules/rbac/sync.js';

export const TEST_ACCOUNTS = {
  superAdmin: {
    email: 'superadmin@test.local',
    name: 'Test Super Admin',
    role: SYSTEM_ROLES.SUPER_ADMIN,
  },
  admin: { email: 'admin@test.local', name: 'Test Admin', role: SYSTEM_ROLES.ADMIN },
  trainer: { email: 'trainer@test.local', name: 'Test Trainer', role: SYSTEM_ROLES.TRAINER },
  student: { email: 'student@test.local', name: 'Test Student', role: SYSTEM_ROLES.STUDENT },
  /** Used only by the lockout test; never signed in successfully. */
  lockout: { email: 'lockout@test.local', name: 'Lockout Student', role: SYSTEM_ROLES.STUDENT },
} as const;

async function main(): Promise<void> {
  const password = process.env['LMS_TEST_PASSWORD'];
  if (!password) throw new Error('LMS_TEST_PASSWORD is required');
  const { config, prisma } = createStandaloneContext();
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { key: config.CLIENT_KEY },
  });
  await syncSystemRoles(prisma, organization.id);
  const passwordHash = await hashPassword(password);

  for (const account of Object.values(TEST_ACCOUNTS)) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: organization.id, key: account.role } },
    });
    const user = await prisma.user.upsert({
      where: { email: account.email },
      create: {
        organizationId: organization.id,
        email: account.email,
        name: account.name,
        passwordHash,
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
      update: {
        name: account.name,
        passwordHash,
        status: 'active',
        failedLoginCount: 0,
        lockedUntil: null,
        tokenVersion: { increment: 1 },
      },
    });
    await prisma.userRole.deleteMany({ where: { userId: user.id, NOT: { roleId: role.id } } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });
  }
  await prisma.$disconnect();
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, '/').endsWith('test/setup/seed-users.ts');
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
