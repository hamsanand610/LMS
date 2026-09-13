/**
 * Seeds the fixtures the API tests rely on (run by global-setup.ts with the test database and a
 * per-run password in LMS_TEST_PASSWORD): one account per system role, plus the minimum people
 * and cohort data needed to exercise batch scope. Idempotent; resets lockouts.
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

/** Natural keys the tests use to find the fixtures again. */
export const TEST_FIXTURES = {
  programCode: 'TST',
  /** The trainer is assigned here and the student is a member, so batch scope has something to hit. */
  assignedBatchCode: 'TST-2026-B1',
  /** Nobody is assigned here: a trainer must not see it. */
  otherBatchCode: 'TST-2026-B2',
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

  const userIdByEmail = new Map<string, string>();
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
    userIdByEmail.set(account.email, user.id);
  }

  // ── programme and two batches, so "assigned" and "not assigned" can be told apart ──
  const program = await prisma.program.upsert({
    where: { code: TEST_FIXTURES.programCode },
    create: {
      organizationId: organization.id,
      code: TEST_FIXTURES.programCode,
      name: 'Test Programme',
      durationWeeks: 12,
    },
    update: {},
  });
  const batches: Record<string, string> = {};
  for (const code of [TEST_FIXTURES.assignedBatchCode, TEST_FIXTURES.otherBatchCode]) {
    const batch = await prisma.batch.upsert({
      where: { code },
      create: {
        organizationId: organization.id,
        programId: program.id,
        code,
        name: `Batch ${code}`,
        status: 'running',
        startDate: new Date('2026-01-05'),
        endDate: new Date('2026-06-30'),
        capacity: 30,
      },
      update: { status: 'running' },
    });
    batches[code] = batch.id;
  }

  // ── trainer profile assigned to the first batch only ──
  const trainer = await prisma.trainerProfile.upsert({
    where: { userId: userIdByEmail.get(TEST_ACCOUNTS.trainer.email)! },
    create: {
      userId: userIdByEmail.get(TEST_ACCOUNTS.trainer.email)!,
      subjects: ['Core Java'],
      headline: 'Core Java trainer',
    },
    update: { subjects: ['Core Java'] },
  });
  await prisma.batchTrainer.upsert({
    where: {
      batchId_trainerId_subject: {
        batchId: batches[TEST_FIXTURES.assignedBatchCode]!,
        trainerId: trainer.id,
        subject: 'Core Java',
      },
    },
    create: {
      batchId: batches[TEST_FIXTURES.assignedBatchCode]!,
      trainerId: trainer.id,
      subject: 'Core Java',
    },
    update: {},
  });

  // ── one student in the trainer's batch, one in the other ──
  const studentPlans = [
    {
      email: TEST_ACCOUNTS.student.email,
      code: 'STU-2026-9001',
      batch: TEST_FIXTURES.assignedBatchCode,
    },
    {
      email: TEST_ACCOUNTS.lockout.email,
      code: 'STU-2026-9002',
      batch: TEST_FIXTURES.otherBatchCode,
    },
  ];
  for (const plan of studentPlans) {
    const profile = await prisma.studentProfile.upsert({
      where: { userId: userIdByEmail.get(plan.email)! },
      create: {
        userId: userIdByEmail.get(plan.email)!,
        studentCode: plan.code,
        status: 'active',
        personal: {
          city: 'Chennai',
          state: 'Tamil Nadu',
          dateOfBirth: '2004-05-05',
          guardianName: 'Test Guardian',
        },
      },
      update: { status: 'active' },
    });
    const membership = await prisma.batchMember.findFirst({
      where: { batchId: batches[plan.batch]!, studentId: profile.id, isActive: true },
    });
    if (!membership) {
      await prisma.batchMember.create({
        data: { batchId: batches[plan.batch]!, studentId: profile.id },
      });
    }
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
