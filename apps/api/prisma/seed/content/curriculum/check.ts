/**
 * Checks one curriculum course file while it is being written, by the rules the unit test applies:
 *
 *   pnpm exec tsx prisma/seed/content/curriculum/check.ts core-java
 *
 * Prints every problem (exit 1) or a short summary of the course (exit 0).
 */
import type { CurriculumCourse } from './types.js';
import { problemsOf } from './validate.js';

const name = process.argv[2];
if (!name) {
  console.error('Usage: check.ts <course file name, e.g. core-java>');
  process.exit(2);
}
const loaded = (await import(`./${name}.js`)) as { COURSE?: CurriculumCourse };
const course = loaded.COURSE;
if (!course) {
  console.error(`${name}.ts exports no COURSE`);
  process.exit(2);
}
const problems = problemsOf(course);
for (const problem of problems) console.log(`PROBLEM ${problem}`);
const lessons = course.modules.flatMap((m) => m.lessons);
const articles = lessons.filter((l) => l.kind === 'article');
const words = articles.reduce(
  (n, l) =>
    n +
    l.html
      .replace(/<[^>]+>/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length,
  0,
);
console.log(
  `${course.slug}: ${course.modules.length} modules, ${lessons.length} lessons ` +
    `(${articles.length} articles, about ${words} words; ` +
    `${lessons.filter((l) => l.kind !== 'article').length} practice or lab), ` +
    `${course.assignments.length} assignments, ${course.tests.length} tests — ` +
    `${problems.length === 0 ? 'OK' : `${problems.length} problem(s)`}`,
);
process.exit(problems.length === 0 ? 0 : 1);
