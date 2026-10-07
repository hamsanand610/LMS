import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../../../core/auth/auth-user.js';
import { ForbiddenError, NotFoundError } from '../../../../core/http/errors.js';
import type { AgentToolContext } from './agent-tool.js';
import { LessonContentTool } from './lesson-content.tool.js';

const LESSON = '0190a0e4-7c1d-7b9e-8f00-0000000000b1';
const COURSE = '0190a0e4-7c1d-7b9e-8f00-0000000000b2';
const OTHER_COURSE = '0190a0e4-7c1d-7b9e-8f00-0000000000b3';

const context = (changes: Partial<AgentToolContext> = {}): AgentToolContext => ({
  user: { id: 'u' } as AuthUser,
  studentId: 's',
  conversationId: 'c',
  courseId: COURSE,
  lessonId: LESSON,
  questionId: null,
  ...changes,
});

const lessonContext = (changes: Record<string, string> = {}) => ({
  lessonId: LESSON,
  courseId: COURSE,
  courseTitle: 'Java',
  moduleTitle: 'Basics',
  title: 'Loops',
  type: 'article',
  topic: 'Control flow',
  text: 'A loop repeats its body.',
  ...changes,
});

function toolWith(aiContextFor: (...args: unknown[]) => Promise<unknown>) {
  const lessons = { aiContextFor: vi.fn(aiContextFor) };
  return { tool: new LessonContentTool(lessons as never), lessons };
}

const live = () => new AbortController().signal;

describe('lesson_content (Phase 9B; ADR-0039)', () => {
  it('declares a read-only, bounded tool for course readers', () => {
    const { tool } = toolWith(() => Promise.resolve(lessonContext()));
    expect(tool).toMatchObject({
      name: 'lesson_content',
      dataClass: 'course',
      permissions: ['courses:read'],
      modules: ['courses'],
      timeoutMs: 5_000,
      maxOutputCharacters: 6_000,
      availableInTimedTest: false,
      mutates: false,
    });
    expect(tool.input.safeParse({ lessonId: LESSON }).success).toBe(false);
  });

  it('reads the pinned lesson, for the learner, through the lesson player’s own rule', async () => {
    const { tool, lessons } = toolWith(() => Promise.resolve(lessonContext()));
    const user = { id: 'learner' } as AuthUser;
    expect(await tool.run(context({ user }), {}, live())).toEqual({
      lessonId: LESSON,
      courseId: COURSE,
      title: 'Loops',
      courseTitle: 'Java',
      moduleTitle: 'Basics',
      topic: 'Control flow',
      text: 'A loop repeats its body.',
      truncated: false,
      withheld: false,
    });
    expect(lessons.aiContextFor).toHaveBeenCalledWith(LESSON, user);
  });

  it('has nothing to read without a lesson, and refuses one the learner cannot open', async () => {
    const { tool, lessons } = toolWith(() => Promise.resolve(lessonContext()));
    await expect(tool.run(context({ lessonId: null }), {}, live())).rejects.toMatchObject({
      failure: 'unavailable',
      code: 'no_lesson',
    });
    expect(lessons.aiContextFor).not.toHaveBeenCalled();
    for (const error of [new ForbiddenError('locked'), new NotFoundError('Lesson')]) {
      const refused = toolWith(() => Promise.reject(error));
      await expect(refused.tool.run(context(), {}, live())).rejects.toMatchObject({
        failure: 'forbidden',
        code: 'lesson_not_open',
      });
    }
    const elsewhere = toolWith(() => Promise.resolve(lessonContext({ courseId: OTHER_COURSE })));
    await expect(elsewhere.tool.run(context(), {}, live())).rejects.toMatchObject({
      failure: 'forbidden',
    });
  });

  it('withholds the whole lesson, titles too, when any of it holds a credential', async () => {
    const planted: Record<string, string>[] = [
      { text: `Connect with ghp_${'A'.repeat(36)} first.` },
      { title: `Keys gsk_${'k'.repeat(30)}` },
    ];
    for (const changes of planted) {
      const { tool } = toolWith(() => Promise.resolve(lessonContext(changes)));
      expect(await tool.run(context(), {}, live())).toMatchObject({
        title: '',
        courseTitle: '',
        moduleTitle: '',
        topic: '',
        text: '',
        withheld: true,
      });
    }
  });

  it('gives at most 6,000 characters of the lesson', async () => {
    const { tool } = toolWith(() =>
      Promise.resolve(lessonContext({ text: 'word '.repeat(2_000) })),
    );
    const output = await tool.run(context(), {}, live());
    expect(output.text.length).toBeLessThanOrEqual(6_000);
    expect(output.truncated).toBe(true);
    expect(tool.characters(output)).toBe(output.text.length);
  });

  it('stops waiting when the call is cancelled', async () => {
    const { tool } = toolWith(() => new Promise(() => undefined));
    const call = new AbortController();
    const pending = tool.run(context(), {}, call.signal);
    call.abort(new Error('cancelled'));
    await expect(pending).rejects.toThrow('cancelled');
  });
});
