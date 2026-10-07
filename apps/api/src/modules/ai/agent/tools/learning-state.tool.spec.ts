import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../../../core/auth/auth-user.js';
import { ForbiddenError, NotFoundError } from '../../../../core/http/errors.js';
import type { AiDueAssignments } from '../../../assignments/index.js';
import type { CourseLearningState, LearningStateOverview } from '../../../courses/index.js';
import type { AiTestWindow } from '../../../tests/index.js';
import { AGENT_LIMITS } from '../agent-limits.js';
import type { AgentToolContext } from './agent-tool.js';
import { AgentToolError } from './agent-tool.js';
import {
  LearningStateTool,
  STATE_PASSAGE_CHARACTERS,
  coursesPassage,
  duePassage,
  fitLines,
  lessonsPassage,
  progressPassage,
} from './learning-state.tool.js';

const uuid = (n: number) => `0190a0e4-7c1d-7b9e-8f00-${String(n).padStart(12, '0')}`;
const COURSE = uuid(1);
const ZONE = 'Asia/Kolkata';
const NOW = new Date('2026-10-07T06:00:00Z');

const context = (changes: Partial<AgentToolContext> = {}): AgentToolContext => ({
  user: { id: uuid(9), organizationId: uuid(8) } as AuthUser,
  studentId: uuid(7),
  conversationId: uuid(6),
  courseId: COURSE,
  lessonId: null,
  questionId: null,
  ...changes,
});

function state(changes: Partial<CourseLearningState> = {}): CourseLearningState {
  return {
    courseId: COURSE,
    title: 'Core Java',
    progressPct: 33,
    countedLessons: 12,
    countedCompleted: 4,
    lessonCount: 12,
    completedLessons: 4,
    modules: [
      { title: 'Basics', open: true, unlockPercent: null, lessons: 4, completed: 4 },
      { title: 'Control flow', open: true, unlockPercent: null, lessons: 4, completed: 0 },
      { title: 'Objects', open: false, unlockPercent: 100, lessons: 4, completed: 0 },
    ],
    modulesLeftOut: 0,
    lessons: [
      {
        title: 'Introduction',
        module: 'Basics',
        type: 'article',
        mandatory: true,
        status: 'completed',
        open: true,
      },
      {
        title: 'Loops',
        module: 'Control flow',
        type: 'video',
        mandatory: true,
        status: 'not_started',
        open: true,
      },
      {
        title: 'Classes',
        module: 'Objects',
        type: 'article',
        mandatory: true,
        status: 'not_started',
        open: false,
      },
    ],
    lessonsLeftOut: 9,
    next: { title: 'Loops', module: 'Control flow', type: 'video' },
    locked: null,
    lastAccessedAt: new Date('2026-10-05T10:00:00Z'),
    ...changes,
  };
}

const due: AiDueAssignments = {
  counts: {
    overdue: 1,
    failed: 0,
    inProgress: 1,
    notStarted: 0,
    upcoming: 1,
    submitted: 0,
    completed: 2,
  },
  next: [
    {
      title: 'Arrays practice',
      status: 'overdue',
      dueAt: new Date('2026-10-02T12:00:00Z'),
      opensAt: null,
      courseTitle: 'Core Java',
    },
    {
      title: 'Strings',
      status: 'in_progress',
      dueAt: new Date('2026-10-10T12:00:00Z'),
      opensAt: null,
      courseTitle: null,
    },
    {
      title: 'Generics',
      status: 'upcoming',
      dueAt: new Date('2026-10-20T12:00:00Z'),
      opensAt: new Date('2026-10-12T12:00:00Z'),
      courseTitle: null,
    },
  ],
};

const windows: AiTestWindow[] = [
  {
    title: 'Java basics test',
    window: 'live',
    opensAt: new Date('2026-10-06T00:00:00Z'),
    closesAt: new Date('2026-10-09T12:00:00Z'),
  },
  {
    title: 'Objects test',
    window: 'upcoming',
    opensAt: new Date('2026-10-15T04:00:00Z'),
    closesAt: new Date('2026-10-16T12:00:00Z'),
  },
];

function tool(options: {
  course?: () => Promise<CourseLearningState>;
  overview?: () => Promise<LearningStateOverview>;
  assignments?: () => Promise<AiDueAssignments>;
  tests?: () => Promise<AiTestWindow[]>;
}) {
  const learning = {
    courseState: vi.fn(options.course ?? (() => Promise.resolve(state()))),
    overview: vi.fn(
      options.overview ?? (() => Promise.resolve({ courses: [], coursesLeftOut: 0 })),
    ),
  };
  const assignments = { aiDueSummary: vi.fn(options.assignments ?? (() => Promise.resolve(due))) };
  const attempts = { aiOpenWindows: vi.fn(options.tests ?? (() => Promise.resolve(windows))) };
  const tenant = { getOrganization: () => Promise.resolve({ timezone: ZONE }) };
  return {
    tool: new LearningStateTool(
      learning as never,
      assignments as never,
      attempts as never,
      tenant as never,
    ),
    learning,
    assignments,
    attempts,
  };
}

const live = () => new AbortController().signal;

describe('learning_state (Phase 9C; ADR-0040)', () => {
  it('is read-only, personal, never in a timed test, behind courses and progress', () => {
    const { tool: t } = tool({});
    expect(t).toMatchObject({
      name: 'learning_state',
      dataClass: 'personal',
      mutates: false,
      availableInTimedTest: false,
      permissions: ['courses:read', 'progress:read'],
      modules: ['courses', 'progress'],
      maxOutputCharacters: AGENT_LIMITS.stateCharacters,
      timeoutMs: AGENT_LIMITS.stateToolMs,
    });
    expect(t.input.safeParse({}).success).toBe(true);
    for (const args of [{ studentId: uuid(1) }, { courseId: COURSE }, { scope: 'all' }]) {
      expect(t.input.safeParse(args).success).toBe(false);
    }
  });

  it('reads the pinned course for the pinned learner, then what is due — and nothing else', async () => {
    const { tool: t, learning, assignments, attempts } = tool({});
    const output = await t.run(context(), {}, live());
    expect(learning.courseState).toHaveBeenCalledWith(context().user, uuid(7), COURSE);
    expect(learning.overview).not.toHaveBeenCalled();
    expect(assignments.aiDueSummary).toHaveBeenCalledWith(context().user);
    expect(attempts.aiOpenWindows).toHaveBeenCalledWith(context().user);
    expect(output.passages.map((p) => p.part)).toEqual(['progress', 'lessons', 'due']);
    expect(output.passages.map((p) => p.sections)).toEqual([[], [], ['assignments', 'tests']]);
    expect(t.output.safeParse(output).success).toBe(true);
    expect(t.characters(output)).toBeLessThanOrEqual(AGENT_LIMITS.stateCharacters);
  });

  it('reads the learner’s courses together when no course is pinned', async () => {
    const { tool: t, learning } = tool({
      overview: () =>
        Promise.resolve({
          courses: [
            {
              courseId: COURSE,
              title: 'Core Java',
              progressPct: 33,
              countedLessons: 12,
              countedCompleted: 4,
              next: 'Loops',
              lastAccessedAt: null,
            },
          ],
          coursesLeftOut: 2,
        }),
    });
    const output = await t.run(context({ courseId: null }), {}, live());
    expect(learning.courseState).not.toHaveBeenCalled();
    expect(output.passages[0]).toMatchObject({ part: 'courses', courseId: null });
    expect(output.passages[0]!.text).toContain('Your courses (3)');
    expect(output.passages[0]!.text).toContain('(2 more courses are not listed.)');
  });

  it('refuses a course no longer open to the learner, and leaves out a part they may not see', async () => {
    for (const failure of [new ForbiddenError('closed'), new NotFoundError('Course')]) {
      const { tool: t } = tool({ course: () => Promise.reject(failure) });
      await expect(t.run(context(), {}, live())).rejects.toMatchObject({
        failure: 'forbidden',
        code: 'state_not_open',
      });
    }
    const { tool: t } = tool({
      assignments: () => Promise.reject(new ForbiddenError('Assignments are not open to you')),
      tests: () => Promise.reject(new ForbiddenError('Tests are not open to you')),
    });
    const output = await t.run(context(), {}, live());
    expect(output.passages.map((p) => p.part)).toEqual(['progress', 'lessons']);
    // Only the part the learner may see: the tests alone.
    const testsOnly = tool({
      assignments: () => Promise.reject(new ForbiddenError('Assignments are not open to you')),
    });
    const due = (await testsOnly.tool.run(context(), {}, live())).passages.at(-1)!;
    expect(due).toMatchObject({ part: 'due', sections: ['tests'] });
    expect(due.text).not.toContain('Assignment');
    // Anything else is a failure, not a part left out.
    const broken = tool({ assignments: () => Promise.reject(new Error('database down')) });
    await expect(broken.tool.run(context(), {}, live())).rejects.toThrow('database down');
  });

  it('leaves out a passage whose titles hold a credential, and refuses when nothing is left', async () => {
    const secret = `ghp_${'A'.repeat(36)}`;
    const { tool: t } = tool({
      course: () => Promise.resolve(state({ title: `Java ${secret}` })),
    });
    const output = await t.run(context(), {}, live());
    expect(JSON.stringify(output)).not.toContain(secret);
    expect(output.passages.map((p) => p.part)).toEqual(['due']);
    const none = tool({
      course: () => Promise.resolve(state({ title: `Java ${secret}` })),
      assignments: () => Promise.reject(new ForbiddenError('no')),
      tests: () => Promise.reject(new ForbiddenError('no')),
    });
    await expect(none.tool.run(context(), {}, live())).rejects.toBeInstanceOf(AgentToolError);
  });

  it('states facts in plain words: progress, the next open lesson, what opens a locked one', () => {
    const text = progressPassage(state(), ZONE).text;
    expect(text).toContain('Your progress in the course Core Java: 33% complete.');
    expect(text).toContain('You have completed 4 of 12 lessons in this course.');
    expect(text).toContain(
      'The next lesson to learn in this course: Loops, a video lesson in the module Control flow. It is open to you.',
    );
    expect(text).toContain('You last opened this course on 5 October 2026.');
    expect(text).toContain(
      '- Objects: locked; it opens when you have completed 100% of the module before it.',
    );
    const locked = progressPassage(
      state({
        next: { title: 'Warm-up B', module: 'Warm-up', type: 'article' },
        locked: {
          title: 'Loops',
          module: 'Control flow',
          unlockPercent: 100,
          previousModule: 'Warm-up',
        },
      }),
      ZONE,
    ).text;
    expect(locked).toContain(
      'The next required lesson, Loops, is in the module Control flow, which is locked to you',
    );
    expect(locked).toContain('To open it, the next lesson to learn is Warm-up B');
    const fresh = progressPassage(state({ progressPct: 0, countedCompleted: 0 }), ZONE).text;
    expect(fresh).toContain('You have made no progress in the course Core Java yet');
    const finished = progressPassage(state({ next: null, progressPct: 100 }), ZONE).text;
    expect(finished).toContain('Every lesson that counts towards Core Java is completed.');
    // No judgement: the facts and nothing about the learner's ability.
    expect(`${text}${locked}${fresh}`).not.toMatch(/\b(?:weak|struggl|poor|bad|behind)\b/i);
  });

  it('lists the lessons with their status, open or locked, and counts the rest', () => {
    const text = lessonsPassage(state()).text;
    expect(text).toContain('- Loops (Control flow, video): not started; open.');
    expect(text).toContain('- Classes (Objects, reading): not started; locked.');
    expect(text).toContain('(9 more lessons are not listed.)');
  });

  it('says what is due, overdue first, with dates in the institute’s time zone', () => {
    const text = duePassage(due, windows, ZONE, NOW)!.text;
    expect(text).toContain('Today is 7 October 2026.');
    expect(text).toContain('Your assignments: 1 overdue, 1 in progress, 1 upcoming, 2 completed.');
    expect(text).toContain(
      '- Assignment Arrays practice (course Core Java): overdue; it was due on 2 October 2026.',
    );
    expect(text).toContain('- Assignment Strings: in progress; due on 10 October 2026.');
    expect(text).toContain('- Assignment Generics: upcoming; it opens on 12 October 2026.');
    expect(text).toContain('- Test Java basics test: open now; it closes on 9 October 2026.');
    expect(text).toContain(
      '- Test Objects test: opens on 15 October 2026 and closes on 16 October 2026.',
    );
    expect(duePassage(null, null, ZONE)).toBeNull();
    expect(duePassage(null, [], ZONE, NOW)!.text).toContain(
      'You have no test to sit that is open now or opens in the next two weeks.',
    );
  });

  it('keeps every passage within its bound, however much there is', () => {
    const many = state({
      lessons: Array.from({ length: 40 }, (_, i) => ({
        title: `Lesson ${i} ${'z'.repeat(70)}`,
        module: `Module ${'m'.repeat(70)}`,
        type: 'article',
        mandatory: true,
        status: 'not_started' as const,
        open: true,
      })),
      modules: Array.from({ length: 12 }, (_, i) => ({
        title: `Module ${i} ${'q'.repeat(70)}`,
        open: true,
        unlockPercent: null,
        lessons: 100,
        completed: 3,
      })),
      lessonsLeftOut: 4_960,
      modulesLeftOut: 38,
    });
    const progress = progressPassage(many, ZONE).text;
    const lessons = lessonsPassage(many).text;
    expect(progress.length).toBeLessThanOrEqual(STATE_PASSAGE_CHARACTERS.progress);
    expect(lessons.length).toBeLessThanOrEqual(STATE_PASSAGE_CHARACTERS.lessons);
    expect(lessons).toMatch(/\(\d+ more lessons are not listed\.\)$/);
    const courses = coursesPassage(
      {
        courses: Array.from({ length: 8 }, (_, i) => ({
          courseId: COURSE,
          title: `Course ${i} ${'c'.repeat(70)}`,
          progressPct: 10,
          countedLessons: 100,
          countedCompleted: 10,
          next: `Lesson ${'n'.repeat(75)}`,
          lastAccessedAt: NOW,
        })),
        coursesLeftOut: 30,
      },
      ZONE,
    ).text;
    expect(courses.length).toBeLessThanOrEqual(STATE_PASSAGE_CHARACTERS.courses);
    expect(
      STATE_PASSAGE_CHARACTERS.progress +
        STATE_PASSAGE_CHARACTERS.lessons +
        STATE_PASSAGE_CHARACTERS.due,
    ).toBeLessThanOrEqual(AGENT_LIMITS.stateCharacters);
    expect(STATE_PASSAGE_CHARACTERS.courses + STATE_PASSAGE_CHARACTERS.due).toBeLessThanOrEqual(
      AGENT_LIMITS.stateCharacters,
    );
    expect(fitLines(['head'], ['a', 'b'], 3, 'item', 100)).toBe(
      'head\na\nb\n(3 more items are not listed.)',
    );
  });

  it('says plainly when the learner has no course open to them', () => {
    expect(coursesPassage({ courses: [], coursesLeftOut: 0 }, ZONE).text).toBe(
      'You are not enrolled in any course that is open to you now.',
    );
  });
});
