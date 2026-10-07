import { describe, expect, it } from 'vitest';
import {
  LEARNING_STATE_LIMITS,
  type LearningLessonStatus,
  type LearningStateCourse,
  learningStateOf,
} from './learning-state.service.js';

type Lesson = LearningStateCourse['modules'][number]['lessons'][number];

let counter = 0;
const lesson = (title: string, mandatory = true, type = 'article'): Lesson => ({
  id: `lesson-${++counter}`,
  title,
  type,
  isMandatory: mandatory,
});

const OPEN = { type: 'immediate' };
const AFTER = (minPercent: number) => ({ type: 'after_previous', minPercent });

function course(
  modules: { title: string; unlockRule?: unknown; lessons: Lesson[] }[],
  progressPct = 0,
): LearningStateCourse {
  return {
    courseId: 'course-1',
    title: 'Core Java',
    progressPct,
    lastAccessedAt: null,
    modules: modules.map((module, position) => ({
      title: module.title,
      position,
      unlockRule: module.unlockRule ?? OPEN,
      lessons: module.lessons,
    })),
  };
}

const done = (...lessons: Lesson[]) =>
  new Map<string, LearningLessonStatus>(lessons.map((l) => [l.id, 'completed']));

describe('a learner’s learning state, read live (Phase 9C; ADR-0040)', () => {
  it('counts the required lessons, and names the next one open to them', () => {
    const intro = lesson('Introduction');
    const variables = lesson('Variables');
    const extra = lesson('Further reading', false);
    const loops = lesson('Loops', true, 'video');
    const state = learningStateOf(
      course(
        [
          { title: 'Basics', lessons: [intro, variables, extra] },
          { title: 'Control flow', unlockRule: AFTER(100), lessons: [loops] },
        ],
        67,
      ),
      done(intro, variables),
    );
    expect(state).toMatchObject({
      title: 'Core Java',
      progressPct: 67,
      countedLessons: 3,
      countedCompleted: 2,
      lessonCount: 4,
      completedLessons: 2,
      next: { title: 'Loops', module: 'Control flow', type: 'video' },
      locked: null,
    });
    expect(state.modules).toEqual([
      { title: 'Basics', open: true, unlockPercent: null, lessons: 3, completed: 2 },
      { title: 'Control flow', open: true, unlockPercent: null, lessons: 1, completed: 0 },
    ]);
    expect(state.lessons.map((l) => [l.title, l.status, l.open, l.mandatory])).toEqual([
      ['Introduction', 'completed', true, true],
      ['Variables', 'completed', true, true],
      ['Further reading', 'not_started', true, false],
      ['Loops', 'not_started', true, true],
    ]);
  });

  it('never names a lesson of a locked module as next: what opens it instead (lock-aware)', () => {
    // The module before is all optional: the player counts all its lessons to open the next one,
    // while the course counts only required lessons — so the first required lesson left is locked.
    const optionalA = lesson('Warm-up A', false);
    const optionalB = lesson('Warm-up B', false);
    const loops = lesson('Loops');
    const state = learningStateOf(
      course([
        { title: 'Warm-up', lessons: [optionalA, optionalB] },
        { title: 'Control flow', unlockRule: AFTER(100), lessons: [loops] },
      ]),
      done(optionalA),
    );
    expect(state.locked).toEqual({
      title: 'Loops',
      module: 'Control flow',
      unlockPercent: 100,
      previousModule: 'Warm-up',
    });
    expect(state.next).toEqual({ title: 'Warm-up B', module: 'Warm-up', type: 'article' });
    expect(state.lessons.find((l) => l.title === 'Loops')).toMatchObject({ open: false });
    expect(state.modules[1]).toMatchObject({ open: false, unlockPercent: 100 });
  });

  it('names no next lesson once every lesson that counts is done, and none from a locked chain', () => {
    const a = lesson('A');
    const b = lesson('B');
    expect(
      learningStateOf(course([{ title: 'Only', lessons: [a, b] }], 100), done(a, b)),
    ).toMatchObject({ next: null, locked: null, countedCompleted: 2 });
    // Two locked modules in a row: the one before the next lesson is itself locked.
    const first = lesson('First', false);
    const second = lesson('Second', false);
    const third = lesson('Third');
    const chained = learningStateOf(
      course([
        { title: 'One', lessons: [first] },
        { title: 'Two', unlockRule: AFTER(100), lessons: [second] },
        { title: 'Three', unlockRule: AFTER(100), lessons: [third] },
      ]),
      new Map(),
    );
    expect(chained.next).toBeNull();
    expect(chained.locked).toMatchObject({ title: 'Third', previousModule: 'Two' });
  });

  it('reports in-progress lessons as they are, and an unknown status as not started', () => {
    const a = lesson('A');
    const b = lesson('B');
    const state = learningStateOf(
      course([{ title: 'Only', lessons: [a, b] }]),
      new Map<string, LearningLessonStatus>([[a.id, 'in_progress']]),
    );
    expect(state.lessons.map((l) => l.status)).toEqual(['in_progress', 'not_started']);
    expect(state.next?.title).toBe('A');
  });

  it('lists at most forty lessons and twelve modules around the learner, counting the rest', () => {
    const modules = Array.from({ length: 50 }, (_, m) => ({
      title: `Module ${m} ${'x'.repeat(200)}`,
      lessons: Array.from({ length: 100 }, (_, l) => lesson(`Lesson ${m}.${l} ${'y'.repeat(200)}`)),
    }));
    const finished = modules.slice(0, 20).flatMap((module) => module.lessons);
    const state = learningStateOf(course(modules), done(...finished));
    expect(state.lessons).toHaveLength(LEARNING_STATE_LIMITS.lessons);
    expect(state.lessonsLeftOut).toBe(5_000 - LEARNING_STATE_LIMITS.lessons);
    expect(state.modules).toHaveLength(LEARNING_STATE_LIMITS.modules);
    expect(state.modulesLeftOut).toBe(50 - LEARNING_STATE_LIMITS.modules);
    // Around where they are: the next lesson is among those listed.
    expect(state.next?.title.startsWith('Lesson 20.0')).toBe(true);
    expect(state.lessons.some((l) => l.title.startsWith('Lesson 20.0'))).toBe(true);
    // Every title on one line, within its bound.
    for (const title of [
      state.title,
      ...state.lessons.flatMap((l) => [l.title, l.module]),
      ...state.modules.map((m) => m.title),
    ]) {
      expect(title.length).toBeLessThanOrEqual(LEARNING_STATE_LIMITS.title);
      expect(title).not.toMatch(/\n/);
    }
  });

  it('is a course with nothing in it, without failing', () => {
    expect(learningStateOf(course([]), new Map())).toMatchObject({
      countedLessons: 0,
      lessons: [],
      modules: [],
      next: null,
      locked: null,
    });
  });
});
