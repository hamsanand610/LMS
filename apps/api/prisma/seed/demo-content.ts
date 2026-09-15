import type { PrismaClient } from '../../src/generated/prisma/client.js';

/**
 * Phase 6 demo data: the institute's own pages, and one lesson that is a question.
 *
 * The pages are the two the settings already point at (terms and privacy), written as an institute
 * would write them rather than left as lorem. The practice lesson exists so DP-S05 has something
 * behind it — without one, that page could only be reached by authoring a course.
 *
 * Idempotent: an existing page or lesson is left exactly as it is.
 */

export interface ContentSeedResult {
  pages: number;
  practiceLessons: number;
}

const PAGES = [
  {
    slug: 'terms',
    title: 'Terms of use',
    body: `These terms cover your use of the Demo Institute learning portal.

**Your account is yours alone.** Do not share your password or let somebody else sit a test as you. We record who signed in, from where, and what they did.

**What you may do with the material.** Courses, questions and recordings are for your own study on this programme. Do not republish them or pass them on.

**Attendance and assessment.** Attendance is recorded by your trainer after each class and can be corrected within two days. Test results are released once every written answer has been marked.

**When we may suspend an account.** Sharing an account, submitting somebody else's work, or interfering with the platform. We will tell you why.

This is demonstration text for a demonstration institute. A real institute replaces it with its own, on this page, without a deployment.`,
  },
  {
    slug: 'privacy',
    title: 'Privacy notice',
    body: `This notice explains what the Demo Institute portal holds about you and why.

**What we hold.** Your name, email address and mobile number; your batch and attendance; your progress, submissions and results; documents you upload for verification; and a record of your sign-ins.

**Why we hold it.** To run your programme: to teach you, to mark your work, to tell you what is due, and to show you and your trainers how you are getting on.

**Who can see it.** Your trainers see the learners in their own batches. Administrators see the institute. Nobody sees another learner's personal details, documents or attendance.

**What you can do.** You can see and correct your own record on your profile page at any time. Ask an administrator if something is wrong that you cannot change yourself.

**How long we keep it.** For as long as you are on a programme, and afterwards as the institute's own retention policy requires.

This is demonstration text and the demonstration data is invented. No real person's information is in this system.`,
  },
];

export async function seedContent(
  prisma: PrismaClient,
  organization: { id: string },
): Promise<ContentSeedResult> {
  const result: ContentSeedResult = { pages: 0, practiceLessons: 0 };

  for (const page of PAGES) {
    const existing = await prisma.contentPage.findFirst({
      where: { organizationId: organization.id, slug: page.slug },
    });
    if (existing) continue;
    await prisma.contentPage.create({
      data: {
        organizationId: organization.id,
        slug: page.slug,
        title: page.title,
        body: page.body,
        isPublished: true,
      },
    });
    result.pages += 1;
  }

  // One lesson that is a question, so the inline practice page has something behind it.
  const existingPractice = await prisma.lesson.findFirst({ where: { type: 'practice' } });
  if (!existingPractice) {
    const question = await prisma.question.findFirst({
      where: { organizationId: organization.id, status: 'published', type: 'mcq_single' },
      orderBy: { createdAt: 'asc' },
    });
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
          completionRule: 'manual',
          isMandatory: false,
          durationSeconds: 120,
          content: { questionId: question.id },
        },
      });
      result.practiceLessons += 1;
    }
  }

  return result;
}
