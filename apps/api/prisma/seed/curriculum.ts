/**
 * Writes SI Academy's curriculum (prisma/seed/content/curriculum) for the content promotion
 * (content.ts): courses as drafts, their modules and lessons with resources, the bank's practice
 * questions and labs inside the modules, a class-recording lesson in every module for the trainer's
 * video, the bank's assignment definitions attached to their course, and test definitions as drafts.
 *
 * - **Drafts**: a course reaches learners only when staff publish it to a batch, programme or
 *   learner (publishing marks it published); its tests are scheduled by staff in the same way.
 * - **Create-only**: a course is matched by slug and a test by title, and what exists is left as
 *   it is. An assignment is attached only while it is the promotion's own draft, still unattached.
 * - **The course builder's rules**: a practice lesson embeds a published question, a lab lesson a
 *   published lab whose check passed, and lesson HTML is stored as the lesson policy cleans it.
 */
import { testSettingsSchema } from '@lms/shared';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { sanitizeLessonHtml } from '../../src/core/html/sanitize.js';
import { ASSIGNMENTS } from './content/index.js';
import { CURRICULUM } from './content/curriculum/index.js';
import type { CurriculumCourse, CurriculumLesson } from './content/curriculum/types.js';
import type { BankEntry } from './question-bank.js';

export interface CurriculumResult {
  /** Courses this run created, and those it found already there. */
  coursesCreated: number;
  coursesExisting: number;
  modules: number;
  lessons: number;
  resources: number;
  assignmentsAttached: number;
  testsCreated: number;
  /** Lessons or test questions left out because their bank question is not ready. */
  skipped: string[];
}

/** What a practice or lab lesson takes to finish, in seconds, for the course's length. */
const PRACTICE_SECONDS = 15 * 60;
const LAB_SECONDS = 30 * 60;
const LAB_TYPES = new Set(['coding', 'sql', 'debugging', 'web']);

function recordingHtml(summary: string): string {
  const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return (
    `<p>${escape(summary)}</p>` +
    '<p>Your trainer adds the recording of this class here after it is taught. Until then, work ' +
    'through the notes and the practice in this module; the recording is optional and never ' +
    'counts against your progress.</p>'
  );
}

export async function seedCurriculum(
  prisma: PrismaClient,
  organizationId: string,
  questionBySlug: Map<string, BankEntry>,
  courses: readonly CurriculumCourse[] = CURRICULUM,
): Promise<CurriculumResult> {
  const result: CurriculumResult = {
    coursesCreated: 0,
    coursesExisting: 0,
    modules: 0,
    lessons: 0,
    resources: 0,
    assignmentsAttached: 0,
    testsCreated: 0,
    skipped: [],
  };

  // Labs that may open from a lesson: published, of a lab type, and passing their own check.
  const labRows = await prisma.question.findMany({
    where: {
      organizationId,
      deletedAt: null,
      status: 'published',
      validation: { path: ['ok'], equals: true },
    },
    select: { id: true, slug: true, type: true },
  });
  const liveLab = new Map(labRows.filter((q) => LAB_TYPES.has(q.type)).map((q) => [q.slug, q.id]));
  const published = (slug: string) => {
    const entry = questionBySlug.get(slug);
    return entry && entry.status === 'published' ? entry : undefined;
  };

  for (const course of courses) {
    const existing = await prisma.course.findUnique({
      where: { slug: course.slug },
      select: { id: true, modules: { select: { id: true, title: true } } },
    });
    let courseId = existing?.id;
    let modules = existing?.modules ?? [];
    if (existing) {
      result.coursesExisting += 1;
    } else {
      const lessonPlan = (lesson: CurriculumLesson) => {
        if (lesson.kind === 'article') {
          return {
            title: lesson.title,
            type: 'article' as const,
            durationSeconds: lesson.minutes * 60,
            completionRule: 'view' as const,
            topic: lesson.topic ?? '',
            content: { html: sanitizeLessonHtml(lesson.html), video: null, questionId: null },
            resources: lesson.resources ?? [],
          };
        }
        if (lesson.kind === 'practice') {
          const entry = published(lesson.question);
          if (!entry) {
            result.skipped.push(`${course.slug}: practice "${lesson.question}" is not published`);
            return null;
          }
          return {
            title: lesson.title ?? entry.plan.title,
            type: 'practice' as const,
            durationSeconds: PRACTICE_SECONDS,
            completionRule: 'pass' as const,
            topic: lesson.topic ?? '',
            content: { html: '', video: null, questionId: entry.id },
            resources: [],
          };
        }
        const labId = liveLab.get(lesson.lab);
        if (!labId) {
          result.skipped.push(`${course.slug}: lab "${lesson.lab}" is not a live lab`);
          return null;
        }
        return {
          title: lesson.title ?? questionBySlug.get(lesson.lab)!.plan.title,
          type: 'lab' as const,
          durationSeconds: LAB_SECONDS,
          completionRule: 'pass' as const,
          topic: lesson.topic ?? '',
          content: { html: '', video: null, questionId: labId },
          resources: [],
        };
      };

      const planned = course.modules.map((module) => ({
        module,
        lessons: module.lessons.map(lessonPlan).filter((l) => l !== null),
      }));
      const estimatedMinutes = Math.round(
        planned.reduce((n, m) => n + m.lessons.reduce((s, l) => s + l.durationSeconds, 0), 0) / 60,
      );

      // One course at a time, whole or not at all.
      const created = await prisma.$transaction(async (tx) => {
        const row = await tx.course.create({
          data: {
            organizationId,
            slug: course.slug,
            title: course.title,
            description: course.description,
            level: course.level,
            subject: course.subject,
            tags: course.tags,
            estimatedMinutes,
            status: 'draft',
          },
          select: { id: true },
        });
        const made: { id: string; title: string }[] = [];
        for (const [position, { module, lessons }] of planned.entries()) {
          const moduleRow = await tx.courseModule.create({
            data: {
              courseId: row.id,
              title: module.title,
              position,
              unlockRule: module.gatedAt
                ? { type: 'after_previous', minPercent: module.gatedAt }
                : { type: 'always' },
            },
            select: { id: true, title: true },
          });
          made.push(moduleRow);
          // The class recording first: the trainer's video of this module's class, optional.
          await tx.lesson.create({
            data: {
              moduleId: moduleRow.id,
              title: `Class recording: ${module.title}`.slice(0, 160),
              type: 'video',
              position: 0,
              durationSeconds: 0,
              completionRule: 'watch',
              isMandatory: false,
              topic: '',
              content: { html: recordingHtml(module.summary), video: null, questionId: null },
            },
          });
          result.lessons += 1;
          for (const [index, lesson] of lessons.entries()) {
            await tx.lesson.create({
              data: {
                moduleId: moduleRow.id,
                title: lesson.title.slice(0, 160),
                type: lesson.type,
                position: index + 1,
                durationSeconds: lesson.durationSeconds,
                completionRule: lesson.completionRule,
                isMandatory: true,
                topic: lesson.topic.slice(0, 80),
                content: lesson.content,
                ...(lesson.resources.length > 0
                  ? {
                      resources: {
                        create: lesson.resources.map((resource, position) => ({
                          title: resource.title,
                          url: resource.url,
                          position,
                        })),
                      },
                    }
                  : {}),
              },
            });
            result.lessons += 1;
            result.resources += lesson.resources.length;
          }
          result.modules += 1;
        }
        return { id: row.id, modules: made };
      });
      courseId = created.id;
      modules = created.modules;
      result.coursesCreated += 1;
    }

    // The course's assignments: the promotion's own unattached drafts, matched by title.
    for (const title of course.assignments) {
      const plan = ASSIGNMENTS.find((a) => a.title === title);
      const assignment = await prisma.assignment.findFirst({
        where: {
          organizationId,
          title,
          deletedAt: null,
          courseId: null,
          status: 'draft',
          createdById: null,
        },
        select: { id: true, modules: { select: { id: true, title: true, courseModuleId: true } } },
      });
      if (!assignment || !plan) continue;
      await prisma.$transaction(async (tx) => {
        await tx.assignment.update({ where: { id: assignment.id }, data: { courseId } });
        for (const module of assignment.modules) {
          if (module.courseModuleId) continue;
          const wanted = plan.modules.find((m) => m.title === module.title)?.courseModule;
          const target = wanted ? modules.find((m) => m.title === wanted) : undefined;
          if (target)
            await tx.assignmentModule.update({
              where: { id: module.id },
              data: { courseModuleId: target.id },
            });
        }
      });
      result.assignmentsAttached += 1;
    }

    // Its tests, as drafts staff schedule to a batch.
    for (const test of course.tests) {
      const exists = await prisma.test.findFirst({
        where: { organizationId, title: test.title, deletedAt: null },
        select: { id: true },
      });
      if (exists) continue;
      const sections = test.sections.map((section) => ({
        title: section.title,
        questions: section.questions
          .map((slug) => {
            const entry = published(slug);
            if (!entry)
              result.skipped.push(`${course.slug}: test question "${slug}" not published`);
            return entry;
          })
          .filter((entry) => entry !== undefined),
      }));
      await prisma.$transaction(async (tx) => {
        const row = await tx.test.create({
          data: {
            organizationId,
            title: test.title,
            description: test.description,
            kind: test.kind,
            subject: course.subject,
            instructions:
              'Answer every question. The timer is the server’s: it keeps running if you close the ' +
              'tab, and the paper is submitted for you when it reaches zero.',
            status: 'draft',
            // Through the app's own schema, so a setting the test player reads is never invalid.
            settings: testSettingsSchema.parse({
              durationMinutes: test.durationMinutes,
              // An on-demand practice paper may be taken again; the others once.
              maxAttempts: test.kind === 'practice' ? 3 : 1,
              shuffleQuestions: test.kind !== 'weekly',
              shuffleOptions: true,
              resultPolicy: test.kind === 'practice' ? 'immediately' : 'on_release',
              reviewPolicy: 'full',
              trackTabSwitches: true,
              requireFullScreen: false,
              showRank: test.kind === 'mock',
            }),
          },
          select: { id: true },
        });
        for (const [position, section] of sections.entries()) {
          const sectionRow = await tx.testSection.create({
            data: { testId: row.id, title: section.title, instructions: '', position },
            select: { id: true },
          });
          for (const [index, question] of section.questions.entries()) {
            await tx.testQuestion.create({
              data: {
                sectionId: sectionRow.id,
                questionId: question.id,
                marks: question.marks,
                negativeMarks: 0,
                position: index,
              },
            });
          }
        }
      });
      result.testsCreated += 1;
    }
  }
  return result;
}
