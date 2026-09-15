/**
 * Demo data for the four portals (architecture plan §21.1, credentials policy §21.2).
 * Phase 2 seeds people, one programme and three batches with rosters and trainer assignments;
 * Phase 3 adds courses, publications, a fortnight of classes and some recorded progress;
 * Phase 4 adds the question bank, assignments, tests and the practice catalogue;
 * Phase 5 marks the attendance of the classes that have already happened.
 * Idempotent: re-running updates names, roles, rosters and (when SEED_DEMO_PASSWORD is set) passwords.
 *
 *   SEED_DEMO_PASSWORD=<your value> pnpm --filter @lms/api db:seed:demo
 */
import { randomBytes } from 'node:crypto';
import { SYSTEM_ROLES, type SystemRoleKey } from '@lms/shared';
import { hashPassword, isCommonPassword } from '../../src/modules/auth/password.js';
import { MODULE_MANIFESTS } from '../../src/modules/manifests.js';
import { syncPermissionCatalogue, syncSystemRoles } from '../../src/modules/rbac/sync.js';
import { formatStudentCode } from '../../src/modules/students/student-code.js';
import { createSeedContext } from './client.js';
import { seedAssessment } from './demo-assessment.js';
import { seedAttendance } from './demo-attendance.js';
import { seedLearning } from './demo-learning.js';

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

/** Subjects of the Java Full-Stack programme, spread over the eight demo trainers. */
const SUBJECTS = [
  'Core Java',
  'Advanced Java',
  'SQL',
  'HTML/CSS',
  'JavaScript',
  'Programming',
  'Aptitude',
  'Soft skills',
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
  for (let i = 1; i <= 8; i += 1) {
    accounts.push({
      email: `trainer${i}@demo.local`,
      name: fictionalName(40 + i),
      role: SYSTEM_ROLES.TRAINER,
    });
  }
  for (let i = 1; i <= 60; i += 1) {
    accounts.push({
      email: `student${String(i).padStart(2, '0')}@demo.local`,
      name: fictionalName(i),
      role: SYSTEM_ROLES.STUDENT,
    });
  }
  return accounts;
}

function isoDate(offsetDays: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
}

async function main(): Promise<void> {
  const { config, prisma } = createSeedContext();
  const organization = await prisma.organization.findUnique({ where: { key: config.CLIENT_KEY } });
  if (!organization)
    throw new Error(`Organisation "${config.CLIENT_KEY}" not found. Run "pnpm db:seed" first.`);
  // The catalogue first: a permission the database has never heard of cannot be granted.
  await syncPermissionCatalogue(prisma, MODULE_MANIFESTS);
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
  if (password.length < 10 || isCommonPassword(password)) {
    throw new Error('SEED_DEMO_PASSWORD must be at least 10 characters and not a common password');
  }
  const passwordHash = await hashPassword(password);

  const roles = await prisma.role.findMany({ where: { organizationId: organization.id } });
  const roleByKey = new Map(roles.map((r) => [r.key, r]));

  // ───────────────── accounts ─────────────────
  let created = 0;
  let updated = 0;
  const userIdByEmail = new Map<string, string>();
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
    userIdByEmail.set(account.email, user.id);
    if (existing) updated += 1;
    else created += 1;
  }
  console.log(`- accounts: ${created} created, ${updated} updated`);

  // ───────────────── trainer profiles ─────────────────
  const trainerIdByEmail = new Map<string, string>();
  for (let i = 1; i <= 8; i += 1) {
    const email = `trainer${i}@demo.local`;
    const userId = userIdByEmail.get(email)!;
    const subject = SUBJECTS[(i - 1) % SUBJECTS.length]!;
    const profile = await prisma.trainerProfile.upsert({
      where: { userId },
      create: {
        userId,
        subjects: [subject],
        headline: `${subject} trainer`,
        bio: `Teaches ${subject} on the Java Full-Stack programme.`,
      },
      update: { subjects: [subject], headline: `${subject} trainer` },
    });
    trainerIdByEmail.set(email, profile.id);
  }
  console.log(`- ${trainerIdByEmail.size} trainer profiles`);

  // ───────────────── programme and batches ─────────────────
  const program = await prisma.program.upsert({
    where: { code: 'JFS' },
    create: {
      organizationId: organization.id,
      code: 'JFS',
      name: 'Java Full-Stack',
      durationWeeks: 24,
      description:
        'Twenty-four weeks covering programming foundations, Core and Advanced Java, SQL, web development and placement preparation.',
    },
    update: { name: 'Java Full-Stack', durationWeeks: 24 },
  });

  const batchPlans = [
    {
      code: 'JFS-2026-B1',
      name: 'Java Full-Stack 2026 — Batch 1',
      status: 'running' as const,
      mode: 'offline' as const,
      // Six weeks in, so attendance and progress have history once those modules land.
      startDate: isoDate(-42),
      endDate: isoDate(126),
    },
    {
      code: 'JFS-2026-B2',
      name: 'Java Full-Stack 2026 — Batch 2',
      status: 'planned' as const,
      mode: 'hybrid' as const,
      startDate: isoDate(14),
      endDate: isoDate(182),
    },
    {
      code: 'JFS-2025-B4',
      name: 'Java Full-Stack 2025 — Batch 4',
      status: 'completed' as const,
      mode: 'offline' as const,
      startDate: isoDate(-300),
      endDate: isoDate(-132),
    },
  ];
  const batchIdByCode = new Map<string, string>();
  for (const plan of batchPlans) {
    const batch = await prisma.batch.upsert({
      where: { code: plan.code },
      create: {
        organizationId: organization.id,
        programId: program.id,
        code: plan.code,
        name: plan.name,
        mode: plan.mode,
        status: plan.status,
        startDate: plan.startDate,
        endDate: plan.endDate,
        capacity: 30,
      },
      update: {
        name: plan.name,
        status: plan.status,
        startDate: plan.startDate,
        endDate: plan.endDate,
      },
    });
    batchIdByCode.set(plan.code, batch.id);
  }
  console.log(`- programme ${program.code} with ${batchIdByCode.size} batches`);

  // ───────────────── student profiles and rosters ─────────────────
  // Twenty students per batch, in the order they were created.
  const batchOrder = ['JFS-2026-B1', 'JFS-2026-B2', 'JFS-2025-B4'];
  let studentsCreated = 0;
  for (let i = 1; i <= 60; i += 1) {
    const email = `student${String(i).padStart(2, '0')}@demo.local`;
    const userId = userIdByEmail.get(email)!;
    const batchCode = batchOrder[Math.floor((i - 1) / 20)]!;
    const batchId = batchIdByCode.get(batchCode)!;
    const status =
      batchCode === 'JFS-2025-B4'
        ? 'completed'
        : batchCode === 'JFS-2026-B2'
          ? 'enrolled'
          : 'active';
    const profile = await prisma.studentProfile.upsert({
      where: { userId },
      create: {
        userId,
        studentCode: formatStudentCode(2026, i),
        status,
        personal: { city: 'Chennai', state: 'Tamil Nadu', gender: i % 2 === 0 ? 'female' : 'male' },
        education: [
          {
            qualification: 'B.E. Computer Science',
            institution: 'Demo Institute of Technology',
            specialisation: '',
            yearOfPassing: 2025,
            scorePercentage: null,
          },
        ],
        summary: 'Aspiring full-stack developer on the Java programme.',
        skills: ['Java', 'SQL', 'HTML'],
        completeness: 80,
      },
      update: { status },
    });
    if (profile.createdAt.getTime() === profile.updatedAt.getTime()) studentsCreated += 1;
    const membership = await prisma.batchMember.findFirst({
      where: { batchId, studentId: profile.id, isActive: true },
    });
    if (!membership) {
      await prisma.batchMember.create({ data: { batchId, studentId: profile.id } });
    }
  }
  console.log(`- 60 student profiles (${studentsCreated} new) across ${batchOrder.length} batches`);

  // ───────────────── trainer assignments ─────────────────
  // Batch 1 gets five subjects, batch 2 three; the completed batch keeps its lead trainer.
  const assignments: { batchCode: string; trainerEmail: string; subject: string; role: string }[] =
    [
      {
        batchCode: 'JFS-2026-B1',
        trainerEmail: 'trainer1@demo.local',
        subject: 'Core Java',
        role: 'lead',
      },
      {
        batchCode: 'JFS-2026-B1',
        trainerEmail: 'trainer2@demo.local',
        subject: 'Advanced Java',
        role: 'lead',
      },
      {
        batchCode: 'JFS-2026-B1',
        trainerEmail: 'trainer3@demo.local',
        subject: 'SQL',
        role: 'lead',
      },
      {
        batchCode: 'JFS-2026-B1',
        trainerEmail: 'trainer5@demo.local',
        subject: 'JavaScript',
        role: 'lead',
      },
      {
        batchCode: 'JFS-2026-B1',
        trainerEmail: 'trainer7@demo.local',
        subject: 'Aptitude',
        role: 'assistant',
      },
      {
        batchCode: 'JFS-2026-B2',
        trainerEmail: 'trainer4@demo.local',
        subject: 'HTML/CSS',
        role: 'lead',
      },
      {
        batchCode: 'JFS-2026-B2',
        trainerEmail: 'trainer6@demo.local',
        subject: 'Programming',
        role: 'lead',
      },
      {
        batchCode: 'JFS-2026-B2',
        trainerEmail: 'trainer8@demo.local',
        subject: 'Soft skills',
        role: 'assistant',
      },
      {
        batchCode: 'JFS-2025-B4',
        trainerEmail: 'trainer1@demo.local',
        subject: 'Core Java',
        role: 'lead',
      },
    ];
  for (const assignment of assignments) {
    const batchId = batchIdByCode.get(assignment.batchCode)!;
    const trainerId = trainerIdByEmail.get(assignment.trainerEmail)!;
    await prisma.batchTrainer.upsert({
      where: { batchId_trainerId_subject: { batchId, trainerId, subject: assignment.subject } },
      create: { batchId, trainerId, subject: assignment.subject, role: assignment.role },
      update: { role: assignment.role },
    });
  }
  console.log(`- ${assignments.length} trainer assignments`);

  // ───────────────── one announcement ─────────────────
  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { organizationId: organization.id, title: 'Welcome to the new term' },
  });
  if (!existingAnnouncement) {
    await prisma.announcement.create({
      data: {
        organizationId: organization.id,
        title: 'Welcome to the new term',
        body: 'Classes for Batch 1 are under way. Check your schedule every morning and speak to your trainer if anything is unclear.',
        audience: { roleKeys: [], batchIds: [batchIdByCode.get('JFS-2026-B1')!], programIds: [] },
        channels: ['in_app'],
        startsAt: isoDate(-1),
        endsAt: isoDate(30),
        status: 'scheduled',
      },
    });
    console.log('- 1 announcement (delivered by the dispatch job)');
  }

  // ───────────────── learning content and the timetable ─────────────────
  const learning = await seedLearning(
    prisma,
    { id: organization.id, timezone: organization.timezone },
    {
      programIdByCode: new Map([[program.code, program.id]]),
      batchIdByCode,
      trainerIdByEmail,
      adminUserId: userIdByEmail.get('admin@demo.local') ?? null,
    },
  );
  console.log(
    `- ${learning.courses} courses (${learning.lessons} lessons), ${learning.publications} publications, ` +
      `${learning.enrolments} new enrolments, ${learning.sessions} classes, ${learning.lessonsCompleted} lessons completed`,
  );

  // ───────────────── assessment ─────────────────
  const assessment = await seedAssessment(
    prisma,
    { id: organization.id },
    {
      batchIdByCode,
      adminUserId: userIdByEmail.get('admin@demo.local') ?? null,
      trainerUserIdByEmail: new Map(
        [...trainerIdByEmail.keys()].map((email) => [email, userIdByEmail.get(email) ?? '']),
      ),
    },
  );
  console.log(
    `- ${assessment.questions} questions and ${assessment.coding} coding problems, ` +
      `${assessment.assignments} assignments (${assessment.publications} publications), ` +
      `${assessment.tests} tests (${assessment.schedules} windows, ${assessment.attempts} sittings), ` +
      `${assessment.submissions} answers`,
  );

  // ───────────────── attendance ─────────────────
  const attendance = await seedAttendance(prisma, {
    batchIdByCode,
    trainerUserIdByEmail: new Map(
      [...trainerIdByEmail.keys()].map((email) => [email, userIdByEmail.get(email) ?? '']),
    ),
  });
  console.log(
    `- ${attendance.records} attendance marks across ${attendance.sessionsMarked} classes ` +
      `(${attendance.sessionsLeftUnmarked} left for a trainer to mark)`,
  );

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      actorId: null,
      action: 'seed.demo_data',
      resourceType: 'organization',
      resourceId: organization.id,
      summary: `Demo data seeded (${created} accounts created, ${updated} updated)`,
    },
  });
  await prisma.$disconnect();

  console.log(
    '\nDemo data ready: admin@demo.local, ops@demo.local, placement@demo.local, trainer1…8@demo.local, student01…60@demo.local.',
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
