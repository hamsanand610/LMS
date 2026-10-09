import { describe, expect, it } from 'vitest';
import { CURRICULUM } from './index.js';
import { crossProblems, problemsOf } from './validate.js';

/**
 * The curriculum the content promotion writes (prisma/seed/curriculum.ts): ten courses, each
 * keeping the course builder's rules (safe HTML, live practice and labs, official documentation
 * links), its assignments on the modules they name, and tests built from the bank.
 */
describe('SI Academy’s curriculum', () => {
  it('has the ten courses of the programme', () => {
    expect(CURRICULUM).toHaveLength(10);
  });

  it.each(CURRICULUM.map((course) => [course.slug, course] as const))(
    '%s keeps every rule',
    (_slug, course) => {
      expect(problemsOf(course)).toEqual([]);
    },
  );

  it('uses each slug, title, assignment and test title once', () => {
    expect(crossProblems(CURRICULUM)).toEqual([]);
  });
});
