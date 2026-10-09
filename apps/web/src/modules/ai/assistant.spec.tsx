// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AiAssistantProvider,
  AskAiAbout,
  assistantConversation,
  launcherHiddenOn,
  useAiSubject,
  type AiPageSubject,
} from './assistant';
import { AVAILABLE, LEARNER_FLAGS, answered, meWith, renderWith, streamOf } from './testing';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  streamApi: vi.fn(),
  pathname: '/courses/c1',
}));
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

const COURSE = '0190a0e4-7c1d-7b9e-8f00-0000000000a1';
const LESSON = '0190a0e4-7c1d-7b9e-8f00-0000000000b1';
const learner = meWith(LEARNER_FLAGS, ['ai:chat', 'ai:hints']);

function availability(overrides: object = {}) {
  mocks.api.mockImplementation(async (path: string, options?: { body?: unknown }) => {
    if (path === '/ai/availability') return { ...AVAILABLE, ...overrides };
    if (path === '/ai/conversations' && options?.body) {
      return {
        id: '0190a0e4-7c1d-7b9e-8f00-0000000000c1',
        purpose: 'assistant',
        title: '',
        status: 'active',
        createdAt: '2026-10-04T10:00:00.000Z',
        lastMessageAt: null,
      };
    }
    throw new Error(`unexpected ${path}`);
  });
}

function LessonPage({ subject }: { subject: AiPageSubject | null }) {
  useAiSubject(subject);
  return (
    <main>
      <p>The lesson</p>
      <AskAiAbout what="lesson" variant="line" />
    </main>
  );
}

beforeEach(() => {
  mocks.api.mockReset();
  mocks.streamApi.mockReset();
  mocks.pathname = '/courses/c1';
});
afterEach(cleanup);

describe('where the launcher shows (Phase 7E)', () => {
  it('is hidden where a page’s own controls fill the screen', () => {
    for (const path of [
      '/ai',
      '/tests/t1/attempt',
      '/labs/sum-two-numbers',
      '/labs/playground',
      '/practice/two-sum',
      '/assignments/a1/q/p1',
      '/courses/c1/lessons/l1/lab',
      '/courses/c1/lessons/l1/practice',
      '/trainer/labs/q1/preview',
      // The roll call's save bar holds the bottom edge: the button sat over "Mark 20 students".
      '/trainer/sessions/s1/attendance',
      '/admin/attendance/s1',
    ]) {
      expect(launcherHiddenOn(path), path).toBe(true);
    }
    for (const path of [
      '/dashboard',
      '/courses/c1',
      '/courses/c1/lessons/l1',
      '/labs',
      '/trainer',
      '/trainer/attendance',
      '/admin/attendance',
    ]) {
      expect(launcherHiddenOn(path), path).toBe(false);
    }
  });

  it('shows the launcher when module.ai, the assistant flag and ai:chat are on and the AI answers', async () => {
    availability();
    renderWith(<AiAssistantProvider portal="student">page</AiAssistantProvider>, learner);
    expect(await screen.findByRole('button', { name: 'Ask SI Academy AI' })).toBeTruthy();
  });

  it('renders nothing of the AI with the module off or without the permission', async () => {
    availability();
    const off = renderWith(
      <AiAssistantProvider portal="student">page</AiAssistantProvider>,
      meWith({ ...LEARNER_FLAGS, 'module.ai': false }, ['ai:chat']),
    );
    const none = renderWith(
      <AiAssistantProvider portal="student">page</AiAssistantProvider>,
      meWith(LEARNER_FLAGS, []),
    );
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: /SI Academy AI/ })).toBeNull();
    expect(mocks.api).not.toHaveBeenCalled();
    off.unmount();
    none.unmount();
  });

  it('offers nothing while the AI cannot answer — during a timed test, for one', async () => {
    availability({ available: false, reason: 'timed_assessment' });
    renderWith(<AiAssistantProvider portal="student">page</AiAssistantProvider>, learner);
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/ai/availability'));
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: /SI Academy AI/ })).toBeNull();
  });

  it('links to the workspace when only the workspace is on', async () => {
    availability();
    renderWith(
      <AiAssistantProvider portal="trainer">page</AiAssistantProvider>,
      meWith({ ...LEARNER_FLAGS, 'ai.assistant': false }, ['ai:chat']),
    );
    const link = await screen.findByRole('link', { name: 'SI Academy AI' });
    expect(link.getAttribute('href')).toBe('/ai');
  });

  it('stays out of the way on a lab, where the lab has its own AI Hint', async () => {
    availability();
    mocks.pathname = '/labs/sum-two-numbers';
    renderWith(<AiAssistantProvider portal="student">page</AiAssistantProvider>, learner);
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/ai/availability'));
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: 'Ask SI Academy AI' })).toBeNull();
  });
});

describe('the subject a page brings (Phase 7E)', () => {
  it('names a course or lesson by id only — its title is shown, never sent', () => {
    expect(assistantConversation(null)).toEqual({ purpose: 'assistant' });
    expect(assistantConversation({ courseId: COURSE, label: 'Java' })).toEqual({
      purpose: 'assistant',
      context: { courseId: COURSE },
    });
    expect(assistantConversation({ courseId: COURSE, lessonId: LESSON, label: 'Loops' })).toEqual({
      purpose: 'assistant',
      context: { courseId: COURSE, lessonId: LESSON },
    });
  });

  it('opens the assistant on the lesson in view and asks about it, by id', async () => {
    availability();
    mocks.streamApi.mockImplementation(() => streamOf(answered('A loop repeats.')));
    renderWith(
      <AiAssistantProvider portal="student">
        <LessonPage subject={{ courseId: COURSE, lessonId: LESSON, label: 'Loops' }} />
      </AiAssistantProvider>,
      learner,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Ask SI Academy AI about this lesson/ }),
    );
    expect(await screen.findByText('About this lesson: Loops')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your question'), {
      target: { value: 'When does it stop?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('A loop repeats.');
    expect(mocks.api).toHaveBeenCalledWith('/ai/conversations', {
      body: { purpose: 'assistant', context: { courseId: COURSE, lessonId: LESSON } },
    });
    const sent = JSON.stringify(mocks.api.mock.calls) + JSON.stringify(mocks.streamApi.mock.calls);
    expect(sent).not.toContain('Loops');
  });

  it('asks without the subject, and offers no entry on the page, when course material is not approved', async () => {
    availability({ subjects: { course: false, labHints: false } });
    mocks.streamApi.mockImplementation(() => streamOf(answered('Generally, yes.')));
    renderWith(
      <AiAssistantProvider portal="student">
        <LessonPage subject={{ courseId: COURSE, lessonId: LESSON, label: 'Loops' }} />
      </AiAssistantProvider>,
      learner,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Ask SI Academy AI' }));
    expect(screen.queryByRole('button', { name: /about this lesson/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Loops?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Generally, yes.');
    expect(mocks.api).toHaveBeenCalledWith('/ai/conversations', { body: { purpose: 'assistant' } });
  });
});
