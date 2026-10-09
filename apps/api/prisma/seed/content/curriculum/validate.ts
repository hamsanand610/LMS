/**
 * The rules a curriculum course must keep (curriculum.spec.ts runs them on every course; check.ts on
 * one, while it is being written). Pure: no database. The writer (prisma/seed/curriculum.ts) relies on
 * them, and the course builder's own checks would refuse the same mistakes.
 */
import { sanitizeLessonHtml } from '../../../../src/core/html/sanitize.js';
import { ASSIGNMENTS, BANK, isRunnable, TECHNOLOGY_TERMS } from '../index.js';
import { currentVerification, loadVerifiedRuns } from '../verified.js';
import type { CurriculumCourse } from './types.js';

/** Hosts a lesson resource may link to: the technologies' own documentation, nothing else. */
export const RESOURCE_HOSTS = new Set([
  'dev.java',
  'docs.oracle.com',
  'developer.mozilla.org',
  'html.spec.whatwg.org',
  'www.w3.org',
  'docs.python.org',
  'www.postgresql.org',
  'dev.mysql.com',
  'sqlite.org',
  'www.sqlite.org',
  'docs.spring.io',
  'spring.io',
  'hibernate.org',
  'docs.jboss.org',
  'jakarta.ee',
  'react.dev',
  'git-scm.com',
  'docs.github.com',
  'junit.org',
  'maven.apache.org',
  'docs.docker.com',
  'nodejs.org',
  'www.typescriptlang.org',
  'web.dev',
]);

/** Subject keys: the base taxonomy's and the bank's technologies. */
const SUBJECTS = new Set([
  'programming',
  'core-java',
  'advanced-java',
  'sql',
  'html-css',
  'javascript',
  'aptitude',
  'soft-skills',
  ...TECHNOLOGY_TERMS.map((t) => t.key),
]);

const PRACTICE_TYPES = new Set(['mcq_single', 'mcq_multi', 'true_false', 'coding', 'sql']);
const TEST_TYPES = new Set(['mcq_single', 'mcq_multi', 'true_false', 'descriptive']);
const LAB_KINDS = new Set(['debugging', 'web']);
const runs = loadVerifiedRuns();
const bankBySlug = new Map(BANK.map((q) => [q.slug, q]));

/** Whether the bank question will be published by the promotion (verified if it runs code). */
export function willBePublished(slug: string): boolean {
  const q = bankBySlug.get(slug);
  if (!q) return false;
  return !isRunnable(q) || Boolean(currentVerification(runs, q));
}

/** Everything wrong with one course; empty when it may be written. */
export function problemsOf(course: CurriculumCourse): string[] {
  const out: string[] = [];
  const at = (where: string, what: string) => out.push(`${course.slug} › ${where}: ${what}`);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(course.slug)) at('slug', 'not kebab-case');
  if (course.title.length < 3 || course.title.length > 120) at('title', 'must be 3–120 characters');
  if (!SUBJECTS.has(course.subject)) at('subject', `"${course.subject}" is not a subject key`);
  if (course.description.length < 80 || course.description.length > 600)
    at('description', 'must be 80–600 characters');
  if (course.tags.length > 8) at('tags', 'at most 8');
  if (course.modules.length < 4 || course.modules.length > 7) at('modules', 'must be 4–7');

  const moduleTitles = new Set<string>();
  let practice = 0;
  course.modules.forEach((module, m) => {
    const where = `module ${m + 1} "${module.title}"`;
    if (moduleTitles.has(module.title)) at(where, 'duplicate module title');
    moduleTitles.add(module.title);
    if (module.title.length < 2 || module.title.length > 120)
      at(where, 'title must be 2–120 characters');
    if (!module.summary || module.summary.length > 240)
      at(where, 'summary must be 1–240 characters');
    if (module.lessons.length < 3 || module.lessons.length > 10)
      at(where, 'must have 3–10 lessons');
    if (!module.lessons.some((l) => l.kind === 'article')) at(where, 'needs at least one article');
    const lessonTitles = new Set<string>();
    module.lessons.forEach((lesson, l) => {
      const lw = `${where} › lesson ${l + 1}`;
      if (lesson.kind === 'article') {
        if (lessonTitles.has(lesson.title)) at(lw, `duplicate title "${lesson.title}"`);
        lessonTitles.add(lesson.title);
        if (lesson.title.length < 2 || lesson.title.length > 140)
          at(lw, 'title must be 2–140 characters');
        if (lesson.minutes < 5 || lesson.minutes > 60) at(lw, 'minutes must be 5–60');
        if (lesson.html.length < 800 || lesson.html.length > 14_000)
          at(lw, `body must be 800–14000 characters (has ${lesson.html.length})`);
        if (/<h1[\s>]/i.test(lesson.html)) at(lw, 'no h1 (the page has it)');
        if (/\starget=/i.test(lesson.html)) at(lw, 'no target attributes on links');
        const clean = sanitizeLessonHtml(lesson.html);
        if (clean !== lesson.html) {
          const index = [...lesson.html].findIndex((ch, i) => clean[i] !== ch);
          at(
            lw,
            `HTML the lesson policy changes, near: ${lesson.html.slice(Math.max(0, index - 40), index + 40)}`,
          );
        }
        for (const resource of lesson.resources ?? []) {
          let host = '';
          try {
            const url = new URL(resource.url);
            host = url.protocol === 'https:' ? url.host : '';
          } catch {
            host = '';
          }
          if (!RESOURCE_HOSTS.has(host))
            at(lw, `resource ${resource.url} is not on an allowed https host`);
          if (!resource.title || resource.title.length > 120)
            at(lw, 'resource title must be 1–120 characters');
        }
        if ((lesson.resources ?? []).length > 4) at(lw, 'at most 4 resources');
      } else if (lesson.kind === 'practice') {
        practice += 1;
        const q = bankBySlug.get(lesson.question);
        if (!q) at(lw, `practice question "${lesson.question}" is not in the bank`);
        else if (!PRACTICE_TYPES.has(q.type))
          at(lw, `"${lesson.question}" is a ${q.type}, not a practice type`);
        else if (!willBePublished(lesson.question)) at(lw, `"${lesson.question}" is not verified`);
      } else {
        practice += 1;
        const q = bankBySlug.get(lesson.lab);
        if (!q || !LAB_KINDS.has(q.type))
          at(lw, `"${lesson.lab}" is not a debugging or web lab in the bank`);
        else if (!willBePublished(lesson.lab)) at(lw, `lab "${lesson.lab}" is not verified`);
      }
    });
  });
  if (practice === 0) at('modules', 'needs at least one practice or lab lesson');

  for (const title of course.assignments) {
    const plan = ASSIGNMENTS.find((a) => a.title === title);
    if (!plan) {
      at('assignments', `"${title}" is not an assignment in the bank`);
      continue;
    }
    if (plan.course && plan.course !== course.slug)
      at('assignments', `"${title}" belongs to the course "${plan.course}"`);
    for (const module of plan.modules) {
      if (module.courseModule && !moduleTitles.has(module.courseModule))
        at('assignments', `"${title}" needs a module titled "${module.courseModule}"`);
    }
  }

  if (course.tests.length < 1 || course.tests.length > 3) at('tests', 'must be 1–3');
  for (const test of course.tests) {
    const tw = `test "${test.title}"`;
    if (test.durationMinutes < 10 || test.durationMinutes > 180)
      at(tw, 'duration must be 10–180 minutes');
    if (!test.description || test.description.length > 2000)
      at(tw, 'description must be 1–2000 characters');
    if (test.sections.length < 1 || test.sections.length > 4) at(tw, 'must have 1–4 sections');
    const seen = new Set<string>();
    for (const section of test.sections) {
      for (const slug of section.questions) {
        const q = bankBySlug.get(slug);
        if (!q) at(tw, `"${slug}" is not in the bank`);
        else if (!TEST_TYPES.has(q.type))
          at(tw, `"${slug}" is a ${q.type}: tests take objective or written questions`);
        if (seen.has(slug)) at(tw, `"${slug}" appears twice`);
        seen.add(slug);
      }
    }
    if (seen.size < 5 || seen.size > 40) at(tw, `must have 5–40 questions (has ${seen.size})`);
  }
  return out;
}

/** Problems across courses: slugs, titles, assignments and test titles used once. */
export function crossProblems(courses: readonly CurriculumCourse[]): string[] {
  const out: string[] = [];
  const once = (label: string, values: string[]) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) out.push(`${label} "${value}" is used twice`);
      seen.add(value);
    }
  };
  once(
    'course slug',
    courses.map((c) => c.slug),
  );
  once(
    'course title',
    courses.map((c) => c.title),
  );
  once(
    'assignment',
    courses.flatMap((c) => c.assignments),
  );
  once(
    'test title',
    courses.flatMap((c) => c.tests.map((t) => t.title)),
  );
  return out;
}
