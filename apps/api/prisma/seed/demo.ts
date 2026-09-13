/**
 * Demo accounts for the four portals/roles (architecture plan §21.1, credentials policy §21.2).
 * Phase 1 seeds people only; programmes, batches, courses and the rest arrive with their phases.
 * Idempotent: re-running updates names, roles and (when SEED_DEMO_PASSWORD is set) passwords.
 *
 *   SEED_DEMO_PASSWORD=<your value> pnpm --filter @lms/api db:seed:demo
 */
import { randomBytes } from 'node:crypto';
import { SYSTEM_ROLES, type SystemRoleKey } from '@lms/shared';
import { hashPassword, isCommonPassword } from '../../src/modules/auth/password.js';
import { syncSystemRoles } from '../../src/modules/rbac/sync.js';
import { createSeedContext } from './client.js';

interface DemoAccount {
  email: string;
  name: string;
  role: SystemRoleKey;
}

const FIRST_NAMES = [
  'Aarav',
  'Diya',
  'Ishaan',
  'Ananya',
  'Vihaan',
  'Saanvi',
  'Arjun',
  'Myra',
  'Kabir',
  'Kiara',
  'Reyansh',
  'Aadhya',
  'Vivaan',
  'Anika',
  'Advik',
  'Navya',
  'Dhruv',
  'Pari',
  'Rohan',
  'Tara',
];
const LAST_NAMES = [
  'Sharma',
  'Verma',
  'Iyer',
  'Reddy',
  'Nair',
  'Patel',
  'Singh',
  'Das',
  'Menon',
  'Kulkarni',
  'Rao',
  'Mishra',
  'Pillai',
  'Joshi',
  'Bose',
];

/** Deterministic fictional names so screenshots stay stable between resets. */
function fictionalName(index: number): string {
  return `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[(index * 7) % LAST_NAMES.length]}`;
}

export function demoAccounts(): DemoAccount[] {
  const accounts: DemoAccount[] = [
    { email: 'admin@demo.local', name: 'Priya Raman', role: SYSTEM_ROLES.ADMIN },
    { email: 'ops@demo.local', name: 'Karthik Menon', role: SYSTEM_ROLES.ADMIN },
    { email: 'placement@demo.local', name: 'Meera Nair', role: SYSTEM_ROLES.PLACEMENT_COORDINATOR },
  ];
  for (let i = 1; i <= 8; i += 1)
    accounts.push({
      email: `trainer${i}@demo.local`,
      name: fictionalName(40 + i),
      role: SYSTEM_ROLES.TRAINER,
    });
  for (let i = 1; i <= 60; i += 1)
    accounts.push({
      email: `student${String(i).padStart(2, '0')}@demo.local`,
      name: fictionalName(i),
      role: SYSTEM_ROLES.STUDENT,
    });
  return accounts;
}

async function main(): Promise<void> {
  const { config, prisma } = createSeedContext();
  const organization = await prisma.organization.findUnique({ where: { key: config.CLIENT_KEY } });
  if (!organization)
    throw new Error(`Organisation "${config.CLIENT_KEY}" not found. Run "pnpm db:seed" first.`);
  await syncSystemRoles(prisma, organization.id);

  // Credentials policy: the password is never stored in the repository. Outside local it must be set
  // explicitly; locally a random one is generated and printed once (set SEED_DEMO_PASSWORD to keep it stable).
  let password = config.SEED_DEMO_PASSWORD;
  let generated = false;
  if (!password) {
    if (config.APP_ENV !== 'local')
      throw new Error('SEED_DEMO_PASSWORD must be set outside local environments');
    password = `${randomBytes(9).toString('base64url')}-Demo1`;
    generated = true;
  }
  if (password.length < 10 || isCommonPassword(password))
    throw new Error('SEED_DEMO_PASSWORD must be at least 10 characters and not a common password');
  const passwordHash = await hashPassword(password);

  const roles = await prisma.role.findMany({ where: { organizationId: organization.id } });
  const roleByKey = new Map(roles.map((r) => [r.key, r]));
  let created = 0;
  let updated = 0;
  for (const account of demoAccounts()) {
    const role = roleByKey.get(account.role);
    if (!role) throw new Error(`System role "${account.role}" is missing`);
    const existing = await prisma.user.findUnique({ where: { email: account.email } });
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
    if (existing) updated += 1;
    else created += 1;
  }
  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      actorId: null,
      action: 'seed.demo_accounts',
      resourceType: 'organization',
      resourceId: organization.id,
      summary: `Demo accounts seeded (${created} created, ${updated} updated)`,
    },
  });
  await prisma.$disconnect();

  console.log(
    `Demo accounts ready: ${created} created, ${updated} updated (admin@demo.local, ops@demo.local, placement@demo.local, trainer1…8@demo.local, student01…60@demo.local).`,
  );
  if (generated) {
    console.log(
      `Generated demo password (shown once; set SEED_DEMO_PASSWORD in apps/api/.env to keep it stable): ${password}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
