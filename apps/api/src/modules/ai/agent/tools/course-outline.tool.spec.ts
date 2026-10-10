import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../../../core/auth/auth-user.js';
import { ForbiddenError, NotFoundError } from '../../../../core/http/errors.js';
import type { AgentToolContext } from './agent-tool.js';
import { CourseOutlineTool } from './course-outline.tool.js';

const COURSE = '0190a0e4-7c1d-7b9e-8f00-0000000000b2';
const LESSON = '0190a0e4-7c1d-7b9e-8f00-0000000000b1';
const LAB = '0190a0e4-7c1d-7b9e-8f00-0000000000b4';

const context = (changes: Partial<AgentToolContext> = {}): AgentToolContext => ({
  user: { id: 'u' } as AuthUser,
  studentId: 's',
  conversationId: 'c',
  courseId: COURSE,
  lessonId: null,
  questionId: null,
  ...changes,
});

const courseContext = (changes: Record<string, unknown> = {}) => ({
  courseId: COURSE,
  title: 'SQL and Databases',
  description: 'Querying relational data.',
  modules: [
    { title: 'Basics', lessons: ['SELECT', 'ORDER BY and LIMIT'] },
    { title: 'Joins', lessons: [] },
  ],
  ...changes,
});

function toolWith(aiContextFor: (...args: unknown[]) => Promise<unknown>) {
  const courses = { aiContextFor: vi.fn(aiContextFor) };
  return { tool: new CourseOutlineTool(courses as never), courses };
}

const live = () => new AbortController().signal;

describe('course_outline (ADR-0044)', () => {
  it('declares a read-only, bounded tool for course readers', () => {
    const { tool } = toolWith(() => Promise.resolve(courseContext()));
    expect(tool).toMatchObject({
      name: 'course_outline',
      dataClass: 'course',
      permissions: ['courses:read'],
      modules: ['courses'],
      timeoutMs: 5_000,
      maxOutputCharacters: 4_000,
      availableInTimedTest: false,
      mutates: false,
    });
    // The course is the run's: a model cannot name one.
    expect(tool.input.safeParse({ courseId: COURSE }).success).toBe(false);
  });

  it('reads the pinned course’s outline, for the learner, through the course page’s own rule', async () => {
    const { tool, courses } = toolWith(() => Promise.resolve(courseContext()));
    const user = { id: 'learner' } as AuthUser;
    expect(await tool.run(context({ user }), {}, live())).toEqual({
      courseId: COURSE,
      title: 'SQL and Databases',
      text: [
        'Course: SQL and Databases',
        'About the course: Querying relational data.',
        'Its modules and lessons:',
        '1. Basics: SELECT; ORDER BY and LIMIT',
        '2. Joins',
      ].join('\n'),
      truncated: false,
      withheld: false,
    });
    expect(courses.aiContextFor).toHaveBeenCalledWith(COURSE, user);
  });

  it('has nothing to read off a course’s own page, and refuses a course the learner cannot open', async () => {
    const { tool, courses } = toolWith(() => Promise.resolve(courseContext()));
    for (const changes of [{ courseId: null }, { lessonId: LESSON }, { questionId: LAB }]) {
      await expect(
        tool.run(context(changes), {}, live()),
        JSON.stringify(changes),
      ).rejects.toMatchObject({
        failure: 'unavailable',
        code: 'no_course',
      });
    }
    expect(courses.aiContextFor).not.toHaveBeenCalled();
    for (const error of [new ForbiddenError('not published to you'), new NotFoundError('Course')]) {
      const refused = toolWith(() => Promise.reject(error));
      await expect(refused.tool.run(context(), {}, live())).rejects.toMatchObject({
        failure: 'forbidden',
        code: 'course_not_open',
      });
    }
    const broken = toolWith(() => Promise.reject(new Error('database down')));
    await expect(broken.tool.run(context(), {}, live())).rejects.toThrow('database down');
  });

  it('withholds an outline holding a credential, whole, and bounds a long one', async () => {
    const leaky = toolWith(() =>
      Promise.resolve(
        courseContext({ description: 'Use the key AKIAIOSFODNN7EXAMPLE to connect.' }),
      ),
    );
    expect(await leaky.tool.run(context(), {}, live())).toEqual({
      courseId: COURSE,
      title: '',
      text: '',
      truncated: false,
      withheld: true,
    });
    const long = toolWith(() =>
      Promise.resolve(
        courseContext({
          modules: Array.from({ length: 200 }, (_, n) => ({
            title: `Module ${n + 1}`,
            lessons: [`Lesson ${n + 1}.1`, `Lesson ${n + 1}.2`],
          })),
        }),
      ),
    );
    const outline = await long.tool.run(context(), {}, live());
    expect(outline.truncated).toBe(true);
    expect(outline.text.length).toBeLessThanOrEqual(4_000);
  });
});
