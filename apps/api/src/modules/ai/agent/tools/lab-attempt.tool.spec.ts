import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../../../core/auth/auth-user.js';
import { ForbiddenError, NotFoundError } from '../../../../core/http/errors.js';
import type { AiLabBrief } from '../../../practice/index.js';
import { AGENT_LIMITS } from '../agent-limits.js';
import type { AgentToolContext } from './agent-tool.js';
import {
  LAB_ATTEMPT_CHARACTERS,
  LabAttemptTool,
  attemptText,
  problemText,
} from './lab-attempt.tool.js';

const uuid = (n: number) => `0190a0e4-7c1d-7b9e-8f00-${String(n).padStart(12, '0')}`;
const LAB = uuid(1);
const LESSON = uuid(2);

const context = (changes: Partial<AgentToolContext> = {}): AgentToolContext => ({
  user: { id: uuid(9), organizationId: uuid(8) } as AuthUser,
  studentId: uuid(7),
  conversationId: uuid(6),
  courseId: null,
  lessonId: null,
  questionId: LAB,
  ...changes,
});

const FAILED = {
  runId: uuid(3),
  language: 'python',
  code: 'a, b = input().split()\nprint(a + b)',
  verdict: 'wrong_answer',
  passed: 1,
  total: 3,
  visible: [
    { label: 'Two small numbers', verdict: 'wrong_answer' },
    { label: 'Zeros', verdict: 'passed' },
  ],
};

function brief(changes: Partial<AiLabBrief> = {}): AiLabBrief {
  return {
    questionId: LAB,
    title: 'Sum two numbers',
    type: 'coding',
    statement: 'Read two integers and print their sum.',
    inputFormat: 'Two integers on one line.',
    outputFormat: 'Their sum.',
    constraints: '',
    examples: [{ input: '1 2', expectedOutput: '3' }],
    failedAttempts: 2,
    latest: FAILED,
    latestFailed: FAILED,
    ...changes,
  };
}

function tool(options: {
  gate?: () => Promise<void>;
  brief?: () => Promise<AiLabBrief>;
  lesson?: () => Promise<{ labQuestionId: string | null }>;
}) {
  const subjects = { requireHintableLab: vi.fn(options.gate ?? (() => Promise.resolve())) };
  const lessons = {
    aiContextFor: vi.fn(options.lesson ?? (() => Promise.resolve({ labQuestionId: LAB }))),
  };
  const practice = { labHintBrief: vi.fn(options.brief ?? (() => Promise.resolve(brief()))) };
  return {
    tool: new LabAttemptTool(subjects as never, lessons as never, practice as never),
    subjects,
    lessons,
    practice,
  };
}

const live = () => new AbortController().signal;

describe('lab_attempt (Phase 9C; ADR-0040)', () => {
  it('is read-only, personal, never in a timed test, behind Labs, with no arguments', () => {
    const { tool: t } = tool({});
    expect(t).toMatchObject({
      name: 'lab_attempt',
      dataClass: 'personal',
      mutates: false,
      availableInTimedTest: false,
      modules: ['practice'],
      maxOutputCharacters: AGENT_LIMITS.labCharacters,
      timeoutMs: AGENT_LIMITS.labToolMs,
    });
    for (const args of [{ questionId: LAB }, { attemptId: uuid(3) }, { userId: uuid(9) }]) {
      expect(t.input.safeParse(args).success).toBe(false);
    }
  });

  it('reads the pinned lab behind the AI Hint’s own gate, for the pinned learner only', async () => {
    const { tool: t, subjects, practice, lessons } = tool({});
    const output = await t.run(context(), {}, live());
    expect(subjects.requireHintableLab).toHaveBeenCalledWith(context().user, LAB);
    expect(practice.labHintBrief).toHaveBeenCalledWith(LAB, context().user);
    expect(lessons.aiContextFor).not.toHaveBeenCalled();
    expect(t.output.safeParse(output).success).toBe(true);
    expect(output).toMatchObject({ questionId: LAB, title: 'Sum two numbers', failedAttempts: 2 });
    expect(output.problem).toContain('Problem: Read two integers and print their sum.');
    expect(output.problem).toContain('Example 1, input:\n1 2\nExpected output:\n3');
    expect(output.attempt).toContain(
      'Your latest failed attempt at Sum two numbers (python): wrong answer. It passed 1 of 3 checks.',
    );
    expect(output.attempt).toContain('You have made 2 attempts at this lab that did not pass.');
    expect(output.attempt).toContain('The visible examples it did not pass: Two small numbers.');
    expect(output.attempt).toContain('Your code:\na, b = input().split()\nprint(a + b)');
  });

  it('explains the latest attempt that did not pass, even when a later one passed', async () => {
    const passedLater = {
      ...FAILED,
      runId: uuid(5),
      verdict: 'passed',
      passed: 3,
      code: 'PASSINGCODE',
      visible: [],
    };
    const { tool: t } = tool({
      brief: () => Promise.resolve(brief({ latest: passedLater, latestFailed: FAILED })),
    });
    const output = await t.run(context(), {}, live());
    expect(output.attempt).toContain('Your latest failed attempt at Sum two numbers (python)');
    expect(output.attempt).toContain('print(a + b)');
    expect(output.attempt).toContain('A later attempt of yours has passed every check since.');
    expect(output.attempt).not.toContain('PASSINGCODE');
  });

  it('holds a lab lesson to the lesson still opening this lab', async () => {
    const pinned = tool({});
    await pinned.tool.run(context({ lessonId: LESSON }), {}, live());
    expect(pinned.lessons.aiContextFor).toHaveBeenCalledWith(LESSON, context().user);
    const other = tool({ lesson: () => Promise.resolve({ labQuestionId: uuid(4) }) });
    await expect(other.tool.run(context({ lessonId: LESSON }), {}, live())).rejects.toMatchObject({
      failure: 'forbidden',
      code: 'lab_not_open',
    });
    expect(other.practice.labHintBrief).not.toHaveBeenCalled();
  });

  it('refuses a lab not open to them, and needs a lab and an attempt that did not pass', async () => {
    for (const failure of [new ForbiddenError('no'), new NotFoundError('Lab')]) {
      const { tool: t, practice } = tool({ gate: () => Promise.reject(failure) });
      await expect(t.run(context(), {}, live())).rejects.toMatchObject({
        failure: 'forbidden',
        code: 'lab_not_open',
      });
      expect(practice.labHintBrief).not.toHaveBeenCalled();
    }
    await expect(
      tool({}).tool.run(context({ questionId: null }), {}, live()),
    ).rejects.toMatchObject({ failure: 'unavailable', code: 'no_lab' });
    for (const lab of [
      brief({ failedAttempts: 0 }),
      brief({ latestFailed: null, failedAttempts: 1 }),
    ]) {
      const { tool: t } = tool({ brief: () => Promise.resolve(lab) });
      await expect(t.run(context(), {}, live())).rejects.toMatchObject({
        failure: 'unavailable',
        code: 'needs_attempt',
      });
    }
  });

  it('gives nothing of a hidden check: only the visible examples it missed', () => {
    // labHintBrief passes on no hidden case at all; what it gives, the tool keeps to the visible.
    const text = attemptText(brief(), {
      ...FAILED,
      visible: [{ label: 'Zeros', verdict: 'passed' }],
    });
    expect(text).toContain(
      'It did not fail any of the visible examples: what it missed is in the checks you cannot see.',
    );
    // The failed attempt is explained, and a pass since is said: never the passing code.
    const passedSince = attemptText(
      brief({
        latest: { ...FAILED, runId: uuid(4), verdict: 'passed', passed: 3, code: 'PASSING' },
      }),
      FAILED,
    );
    expect(passedSince).toContain('A later attempt of yours has passed every check since.');
    expect(passedSince).not.toContain('PASSING');
    expect(attemptText(brief(), FAILED)).not.toContain('A later attempt');
    const compile = attemptText(brief(), {
      ...FAILED,
      verdict: 'compile_error',
      passed: 0,
      total: 0,
    });
    expect(compile).toContain('(python): did not compile.\n');
  });

  it('withholds a statement or code holding a credential', async () => {
    const secret = `ghp_${'S'.repeat(36)}`;
    const { tool: t } = tool({
      brief: () =>
        Promise.resolve(
          brief({
            statement: `Use the token ${secret} to call the API.`,
            latestFailed: { ...FAILED, code: `TOKEN = "${secret}"\nprint(1)` },
          }),
        ),
    });
    const output = await t.run(context(), {}, live());
    expect(JSON.stringify(output)).not.toContain(secret);
    expect(output.problem).toBe('');
    expect(output.attempt).toContain('Your code is not shown here: it holds a credential.');
  });

  it('keeps the problem and the attempt within their bounds, whatever the lab holds', () => {
    const huge = brief({
      statement: 'S'.repeat(20_000),
      inputFormat: 'I'.repeat(5_000),
      outputFormat: 'O'.repeat(5_000),
      constraints: 'C'.repeat(5_000),
      examples: Array.from({ length: 10 }, () => ({
        input: 'x'.repeat(5_000),
        expectedOutput: 'y'.repeat(5_000),
      })),
      latest: {
        ...FAILED,
        code: 'c'.repeat(50_000),
        visible: Array.from({ length: 50 }, (_, i) => ({
          label: `Case ${i} ${'l'.repeat(200)}`,
          verdict: 'wrong_answer',
        })),
      },
    });
    const problem = problemText(huge);
    const attempt = attemptText(huge, huge.latest!);
    expect(problem.length).toBeLessThanOrEqual(LAB_ATTEMPT_CHARACTERS.problem);
    expect(attempt.length).toBeLessThanOrEqual(LAB_ATTEMPT_CHARACTERS.attempt);
    expect(problem.length + attempt.length).toBeLessThanOrEqual(AGENT_LIMITS.labCharacters);
    expect(problem.match(/Example \d+, input/g)).toHaveLength(2);
  });
});
