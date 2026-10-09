/**
 * Content promotion: SI Academy's own educational content (prisma/seed/content) into an institute
 * that has its base seed — production included, where the release runs it only when the deploy
 * workflow is started with "promote content" (docs/runbooks/aws-production.md §5).
 *
 *   pnpm exec tsx prisma/seed/content.ts
 *
 * What it writes:
 * - the technology and topic terms the bank uses;
 * - the question bank, as the demo seed writes it: a coding, SQL, debugging or web question is
 *   published only with a current sandbox verification (content/verified-runs.json), otherwise it
 *   is a draft; no author;
 * - the assignment definitions, as drafts with no audience or programme, for staff to review
 *   and publish;
 * - the curriculum (content/curriculum, curriculum.ts): ten courses as drafts with their modules,
 *   lessons, resources, practice and labs and a class-recording lesson per module; the
 *   assignments attached to their course; test definitions as drafts for staff to schedule.
 *
 * What it never writes: accounts or passwords, programmes, batches, publications, schedules,
 * submissions, attempts, progress, attendance, notifications or reports. Nor the demo's courses
 * (their lessons are placeholder text; the curriculum replaces them), its tests (scenarios dated
 * around the demo), its companies and placement drives (fictional) or its legal pages.
 *
 * Create-only and idempotent: questions are matched by slug and assignments by title, and anything
 * that exists is left as it is, so a second run creates nothing and an edit is never overwritten.
 */
import { createSeedContext } from './client.js';
import { ASSIGNMENTS } from './content/index.js';
import { seedCurriculum } from './curriculum.js';
import { ensureAssignmentDefinition, seedBankTaxonomy, seedQuestionBank } from './question-bank.js';

async function main(): Promise<void> {
  const { config, prisma } = createSeedContext();
  try {
    const organization = await prisma.organization.findUnique({
      where: { key: config.CLIENT_KEY },
      select: { id: true },
    });
    if (!organization)
      throw new Error(
        `Organisation "${config.CLIENT_KEY}" not found: the base seed runs first (prisma/seed/base.ts)`,
      );

    const terms = await seedBankTaxonomy(prisma, organization.id);
    const bank = await seedQuestionBank(prisma, organization.id, () => null);
    let assignments = 0;
    for (const plan of ASSIGNMENTS) {
      const { created } = await ensureAssignmentDefinition(
        prisma,
        organization.id,
        plan,
        bank.questionBySlug,
        { authorId: null, programId: null, course: undefined, status: 'draft' },
      );
      if (created) assignments += 1;
    }
    const curriculum = await seedCurriculum(prisma, organization.id, bank.questionBySlug);

    const summary =
      `${bank.created} question(s), ${terms} taxonomy term(s) and ${assignments} draft ` +
      `assignment(s) created; the bank holds ${bank.questions} question(s), ${bank.coding} of ` +
      `them runnable (${bank.unverified} left as drafts for want of a current verification)`;
    if (bank.created + terms + assignments > 0)
      await prisma.auditLog.create({
        data: {
          organizationId: organization.id,
          actorId: null,
          action: 'seed.content_promoted',
          resourceType: 'organization',
          resourceId: organization.id,
          summary: `Content promoted: ${summary}`.slice(0, 240),
        },
      });
    const courses =
      `${curriculum.coursesCreated} course(s) created as drafts (${curriculum.coursesExisting} ` +
      `already there) with ${curriculum.modules} module(s), ${curriculum.lessons} lesson(s) and ` +
      `${curriculum.resources} resource(s); ${curriculum.assignmentsAttached} assignment(s) ` +
      `attached to their course; ${curriculum.testsCreated} test(s) drafted`;
    if (curriculum.coursesCreated + curriculum.assignmentsAttached + curriculum.testsCreated > 0)
      await prisma.auditLog.create({
        data: {
          organizationId: organization.id,
          actorId: null,
          action: 'seed.curriculum_promoted',
          resourceType: 'organization',
          resourceId: organization.id,
          summary: `Curriculum promoted: ${courses}`.slice(0, 240),
        },
      });
    console.log(`Content promotion: ${summary}.`);
    console.log(`Curriculum: ${courses}.`);
    for (const skipped of curriculum.skipped) console.log(`  skipped: ${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
