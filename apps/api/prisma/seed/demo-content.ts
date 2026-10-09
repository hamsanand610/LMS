import type { PrismaClient } from '../../src/generated/prisma/client.js';

/**
 * Phase 6 sample data: one lesson that is a question, and (Roadmap Phase 1) two lessons that are
 * labs. The practice lesson exists so DP-S05 has something behind it — without one, that page could
 * only be reached by authoring a course. The lab lessons put a debugging lab in Core Java and a web
 * lab in Web Development, completed by passing them.
 *
 * The demo writes no legal pages: the Privacy Policy and the Terms of Service are built in
 * (src/modules/settings/built-in-pages.ts), so every environment shows the same text production does.
 *
 * Idempotent: an existing lesson is left exactly as it is.
 */

export interface ContentSeedResult {
  practiceLessons: number;
  labLessons: number;
}

/** Which lab each course opens, as the lesson after its first module's others. */
const LAB_LESSONS = [
  { course: 'core-java', lab: 'debug-java-average', title: 'Lab: fix the average', minutes: 15 },
  {
    course: 'web-development',
    lab: 'web-todo-list',
    title: 'Lab: finish the to-do list',
    minutes: 25,
  },
];

export async function seedContent(
  prisma: PrismaClient,
  organization: { id: string },
): Promise<ContentSeedResult> {
  const result: ContentSeedResult = { practiceLessons: 0, labLessons: 0 };

  // One lesson that is a question, so the inline practice page has something behind it.
  const existingPractice = await prisma.lesson.findFirst({ where: { type: 'practice' } });
  if (!existingPractice) {
    // A Core Java check that belongs beside the course's first module.
    const question =
      (await prisma.question.findFirst({
        where: { organizationId: organization.id, slug: 'java-string-equals', status: 'published' },
      })) ??
      (await prisma.question.findFirst({
        where: { organizationId: organization.id, status: 'published', type: 'mcq_single' },
        orderBy: { createdAt: 'asc' },
      }));
    const module = await prisma.courseModule.findFirst({
      where: { course: { slug: 'core-java' } },
      orderBy: { position: 'asc' },
      include: { _count: { select: { lessons: true } } },
    });
    if (question && module) {
      await prisma.lesson.create({
        data: {
          moduleId: module.id,
          title: `Check yourself: ${question.title}`,
          type: 'practice',
          position: module._count.lessons + 1,
          // Phase 2 (D3): a practice lesson completes when its question is answered correctly.
          completionRule: 'pass',
          isMandatory: false,
          durationSeconds: 120,
          content: { questionId: question.id },
        },
      });
      result.practiceLessons += 1;
    }
  }

  // Lab lessons, only for labs the seed published (proved in the sandbox, ADR-0018).
  const existingLab = await prisma.lesson.findFirst({ where: { type: 'lab' } });
  if (!existingLab) {
    for (const plan of LAB_LESSONS) {
      const lab = await prisma.question.findFirst({
        where: { organizationId: organization.id, slug: plan.lab, status: 'published' },
      });
      const module = await prisma.courseModule.findFirst({
        where: { course: { slug: plan.course } },
        orderBy: { position: 'asc' },
        include: { _count: { select: { lessons: true } } },
      });
      if (!lab || !module) continue;
      await prisma.lesson.create({
        data: {
          moduleId: module.id,
          title: plan.title,
          type: 'lab',
          position: module._count.lessons + 1,
          completionRule: 'pass',
          isMandatory: true,
          durationSeconds: plan.minutes * 60,
          content: { html: '', video: null, questionId: lab.id },
        },
      });
      result.labLessons += 1;
    }
  }

  return result;
}
