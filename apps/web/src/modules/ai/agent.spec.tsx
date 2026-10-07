// @vitest-environment jsdom
import { act, cleanup, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_AGENT_STEPS, type AiAgentCitation } from '@lms/shared';
import type { StreamEvent } from '@/lib/api/stream';
import { ApiError } from '@/lib/api/errors';
import { AGENT_STEP_LABEL, agentPrompts, canUseAgent, sourceLabel } from './agent';
import { EXPLAIN_ATTEMPT, ExplainAttempt } from './agent-lab';
import { AiAssistantProvider, AskAiAbout, useAiSubject, type AiPageSubject } from './assistant';
import {
  AGENT_AVAILABLE,
  AGENT_FLAGS,
  AVAILABLE,
  LEARNER_FLAGS,
  meWith,
  renderWith,
  streamOf,
} from './testing';
import { useAgentRun } from './use-agent-run';

const mocks = vi.hoisted(() => ({ api: vi.fn(), streamApi: vi.fn(), pathname: '/courses/c1' }));
vi.mock('@/lib/api/http', () => ({ api: mocks.api }));
vi.mock('@/lib/api/stream', () => ({ streamApi: mocks.streamApi }));
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const id = (n: number) => `0190a0e4-7c1d-7b9e-8f00-${String(n).padStart(12, '0')}`;
const COURSE = id(1);
const LESSON = id(2);
const LAB = id(3);
const CONVERSATION = {
  id: id(9),
  purpose: 'agent',
  title: '',
  status: 'active',
  createdAt: '2026-10-07T10:00:00.000Z',
  lastMessageAt: null,
};
const learner = meWith(AGENT_FLAGS, ['ai:chat', 'ai:hints', 'ai:agent']);
const STATE: AiAgentCitation = {
  kind: 'learning_state',
  id: 'S1',
  part: 'progress',
  courseId: COURSE,
  title: 'Your progress: Core Java',
};

/** An agent run's stream: its steps, then — verified — its words and sources; or its notice. */
function run(options: {
  steps?: string[];
  answer?: string;
  sources?: AiAgentCitation[];
  status?: string;
  notice?: { code: string; message: string };
  error?: { code: string; message: string };
}): StreamEvent[] {
  return [
    {
      event: 'meta',
      data: { conversationId: CONVERSATION.id, userMessageId: id(10), assistantMessageId: id(11) },
    },
    ...(options.steps ?? ['routing', 'reading_progress', 'drafting', 'verifying']).map((step) => ({
      event: 'step',
      data: { step },
    })),
    ...(options.answer
      ? options.answer.split(' ').map((word, i) => ({
          event: 'delta',
          data: { text: i ? ` ${word}` : word },
        }))
      : []),
    ...(options.sources ? [{ event: 'sources', data: { citations: options.sources } }] : []),
    ...(options.notice ? [{ event: 'notice', data: options.notice }] : []),
    ...(options.error ? [{ event: 'error', data: options.error }] : []),
    { event: 'done', data: { messageId: id(11), status: options.status ?? 'answered' } },
  ];
}

function serve(available: object = AGENT_AVAILABLE) {
  mocks.api.mockImplementation(async (path: string, options?: { body?: unknown }) => {
    if (path === '/ai/availability') return available;
    if (path === '/ai/conversations' && options?.body) return CONVERSATION;
    throw new Error(`unexpected ${path}`);
  });
}

beforeEach(() => {
  mocks.api.mockReset();
  mocks.streamApi.mockReset();
});
afterEach(cleanup);

describe('the learning agent in the browser (Phase 9D)', () => {
  it('names every step in fixed, safe words — never a tool, its arguments or reasoning', () => {
    for (const step of AI_AGENT_STEPS) {
      expect(AGENT_STEP_LABEL[step]).toMatch(/^[A-Z][A-Za-z ]+$/);
    }
    expect(new Set(Object.values(AGENT_STEP_LABEL))).toEqual(
      new Set([
        'Understanding your question',
        'Checking the lesson',
        'Checking your learning progress',
        'Checking your lab attempt',
        'Searching SI Academy knowledge',
        'Preparing the answer',
      ]),
    );
  });

  it('labels each kind of source by what it is', () => {
    expect(sourceLabel(STATE)).toBe('Your progress: Core Java');
    expect(
      sourceLabel({
        kind: 'lesson',
        id: 'S2',
        lessonId: LESSON,
        courseId: COURSE,
        title: 'Loops',
        heading: 'Basics',
        position: 0,
      }),
    ).toBe('Lesson: Loops');
    expect(
      sourceLabel({
        kind: 'lab_attempt',
        id: 'S3',
        part: 'attempt',
        questionId: LAB,
        title: 'Sum',
      }),
    ).toBe('Your latest failed attempt: Sum');
    expect(
      sourceLabel({
        kind: 'lab_attempt',
        id: 'S4',
        part: 'problem',
        questionId: LAB,
        title: 'Sum',
      }),
    ).toBe('Lab: Sum');
  });

  it('offers the learner’s own-progress questions only while the institute approved them', () => {
    expect(agentPrompts('lesson', true)).toEqual([
      'Explain this lesson',
      'What should I learn next?',
      'How am I progressing?',
      'Why am I struggling with this topic?',
    ]);
    expect(agentPrompts('lesson', false)).toEqual(['Explain this lesson']);
    expect(agentPrompts('lab', true)).toEqual([EXPLAIN_ATTEMPT]);
    expect(agentPrompts('lab', false)).toEqual([]);
    expect(agentPrompts('general', false)).toEqual([]);
  });

  it('is offered to learners only: the flag, the permission and a learner’s profile', () => {
    expect(canUseAgent(learner)).toBe(true);
    expect(canUseAgent(meWith(AGENT_FLAGS, ['ai:agent'], false))).toBe(false);
    expect(canUseAgent(meWith(LEARNER_FLAGS, ['ai:agent']))).toBe(false);
    expect(canUseAgent(meWith(AGENT_FLAGS, ['ai:chat']))).toBe(false);
  });

  describe('a run as it streams', () => {
    it('shows its steps, then only the verified answer with its sources', async () => {
      serve();
      let release: () => void = () => undefined;
      const events = run({ answer: 'Your next lesson is Loops [S1].', sources: [STATE] });
      mocks.streamApi.mockImplementation(async function* () {
        for (const event of events.slice(0, 3)) yield event;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        for (const event of events.slice(3)) yield event;
      });
      const { result } = renderHook(() =>
        useAgentRun({ conversationId: null, context: { courseId: COURSE } }),
      );
      let sent: Promise<boolean> = Promise.resolve(false);
      act(() => {
        sent = result.current.send('What should I learn next?');
      });
      await waitFor(() =>
        expect(result.current.turns.at(-1)?.step).toBe('Checking your learning progress'),
      );
      expect(result.current.turns.at(-1)?.text).toBe('');
      await act(async () => {
        release();
        await sent;
      });
      expect(mocks.api).toHaveBeenCalledWith('/ai/conversations', {
        body: { purpose: 'agent', context: { courseId: COURSE } },
      });
      expect(mocks.streamApi).toHaveBeenCalledWith(
        `/ai/agent/conversations/${CONVERSATION.id}/runs`,
        { content: 'What should I learn next?' },
        expect.any(AbortSignal),
      );
      const answer = result.current.turns.at(-1)!;
      expect(answer).toMatchObject({
        role: 'assistant',
        text: 'Your next lesson is Loops [S1].',
        status: 'complete',
        step: null,
        sources: [STATE],
      });
      expect(answer.notice).toBeUndefined();
    });

    it('gives the platform’s own words, as a note, when the run gives no answer', async () => {
      serve();
      mocks.streamApi.mockImplementation(() =>
        streamOf(
          run({
            status: 'refused',
            notice: {
              code: 'context_unavailable',
              message: 'SI Academy AI can’t use your progress.',
            },
          }),
        ),
      );
      const { result } = renderHook(() => useAgentRun({ conversationId: CONVERSATION.id }));
      await act(async () => {
        await result.current.send('How am I progressing?');
      });
      expect(result.current.turns.at(-1)).toMatchObject({
        text: 'SI Academy AI can’t use your progress.',
        notice: true,
        status: 'complete',
      });
      expect(mocks.api).not.toHaveBeenCalledWith('/ai/conversations', expect.anything());
    });

    it('shows nothing of a failed run but its error, and keeps a refused question to send again', async () => {
      serve();
      mocks.streamApi.mockImplementation(() =>
        streamOf(
          run({
            status: 'failed',
            steps: ['routing'],
            error: { code: 'ai_unavailable', message: 'x' },
          }),
        ),
      );
      const { result } = renderHook(() => useAgentRun({ conversationId: CONVERSATION.id }));
      await act(async () => {
        await result.current.send('What is due soon?');
      });
      expect(result.current.turns.at(-1)).toMatchObject({ text: '', status: 'failed' });
      expect(result.current.notice).toBe(
        'SI Academy AI is not available right now. Try again later.',
      );

      mocks.streamApi.mockImplementation(() => {
        throw new ApiError(403, {
          type: 'x',
          title: 'Forbidden',
          status: 403,
          code: 'ai_not_allowed',
        } as never);
      });
      let accepted = true;
      await act(async () => {
        accepted = await result.current.send('What is due soon?');
      });
      expect(accepted).toBe(false);
      expect(result.current.turns).toHaveLength(2);
      expect(result.current.notice).toBe(
        'No AI help is given during a timed test. Finish the test first.',
      );
    });
  });

  describe('beside a lab', () => {
    it('offers “Explain my failed attempt” after a failed attempt, and asks it once, naming only the lab', async () => {
      serve();
      mocks.streamApi.mockImplementation(() =>
        streamOf(
          run({
            steps: ['routing', 'reading_lab_attempt', 'drafting', 'verifying'],
            answer: 'Your latest attempt failed: wrong answer [S2].',
            sources: [
              { kind: 'lab_attempt', id: 'S2', part: 'attempt', questionId: LAB, title: 'Sum' },
            ],
          }),
        ),
      );
      renderWith(<ExplainAttempt questionId={LAB} failedAttempt />, learner);
      fireEvent.click(await screen.findByRole('button', { name: EXPLAIN_ATTEMPT }));
      expect(
        await screen.findByText('Your latest attempt failed: wrong answer [S2].'),
      ).toBeTruthy();
      expect(screen.getByText('Your latest failed attempt: Sum')).toBeTruthy();
      expect(mocks.api).toHaveBeenCalledWith('/ai/conversations', {
        body: { purpose: 'agent', context: { questionId: LAB } },
      });
      expect(mocks.streamApi).toHaveBeenCalledTimes(1);
      expect(mocks.streamApi.mock.calls[0]![1]).toEqual({ content: EXPLAIN_ATTEMPT });
    });

    it('is not offered before a failed attempt, to staff, or while the learner’s work is not approved', async () => {
      serve();
      const cases: [React.ReactElement, ReturnType<typeof meWith>][] = [
        [<ExplainAttempt key="a" questionId={LAB} failedAttempt={false} />, learner],
        [
          <ExplainAttempt key="b" questionId={LAB} failedAttempt />,
          meWith(AGENT_FLAGS, ['ai:agent'], false),
        ],
        [
          <ExplainAttempt key="c" questionId={LAB} failedAttempt />,
          meWith(LEARNER_FLAGS, ['ai:agent']),
        ],
      ];
      for (const [ui, me] of cases) {
        const view = renderWith(ui, me);
        await act(async () => undefined);
        expect(screen.queryByRole('button', { name: EXPLAIN_ATTEMPT })).toBeNull();
        view.unmount();
      }
      serve({
        ...AGENT_AVAILABLE,
        subjects: { ...AGENT_AVAILABLE.subjects, learnerContext: false },
      });
      renderWith(<ExplainAttempt questionId={LAB} failedAttempt />, learner);
      await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/ai/availability'));
      await act(async () => undefined);
      expect(screen.queryByRole('button', { name: EXPLAIN_ATTEMPT })).toBeNull();
      serve({ ...AGENT_AVAILABLE, available: false, reason: 'timed_assessment' });
    });
  });

  describe('beside a lesson', () => {
    function LessonPage({ subject }: { subject: AiPageSubject }) {
      useAiSubject(subject);
      return <AskAiAbout what="lesson" variant="line" />;
    }

    it('is the assistant for a learner with the agent on: its questions, one click, its sources', async () => {
      serve();
      mocks.streamApi.mockImplementation(() =>
        streamOf(run({ answer: 'Your next lesson is Loops [S1].', sources: [STATE] })),
      );
      renderWith(
        <AiAssistantProvider portal="student">
          <LessonPage subject={{ courseId: COURSE, lessonId: LESSON, label: 'Loops' }} />
        </AiAssistantProvider>,
        learner,
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Ask SI Academy AI about this lesson' }),
      );
      const suggestions = await screen.findByRole('list', { name: 'Suggested questions' });
      expect(suggestions.textContent).toContain('What should I learn next?');
      fireEvent.click(screen.getByRole('button', { name: 'What should I learn next?' }));
      expect(await screen.findByText('Your next lesson is Loops [S1].')).toBeTruthy();
      expect(screen.getByRole('list', { name: 'Sources' }).textContent).toContain(
        'Your progress: Core Java',
      );
      expect(mocks.api).toHaveBeenCalledWith('/ai/conversations', {
        body: { purpose: 'agent', context: { courseId: COURSE, lessonId: LESSON } },
      });
    });

    it('stays the Phase 7 assistant for anyone without the agent', async () => {
      serve(AVAILABLE);
      renderWith(
        <AiAssistantProvider portal="student">
          <LessonPage subject={{ courseId: COURSE, lessonId: LESSON, label: 'Loops' }} />
        </AiAssistantProvider>,
        meWith(LEARNER_FLAGS, ['ai:chat', 'ai:hints']),
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Ask SI Academy AI about this lesson' }),
      );
      await screen.findByText(/SI Academy AI reads only what you can open here/);
      expect(screen.queryByRole('list', { name: 'Suggested questions' })).toBeNull();
    });
  });
});
