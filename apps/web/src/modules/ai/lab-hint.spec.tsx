// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { HINT_PROMISE, LabHint, isFailedVerdict } from './lab-hint';
import { AVAILABLE, LEARNER_FLAGS, answered, meWith, renderWith, streamOf } from './testing';

const mocks = vi.hoisted(() => ({ api: vi.fn(), streamApi: vi.fn() }));
vi.mock('@/lib/api/http', () => ({ api: mocks.api }));
vi.mock('@/lib/api/stream', () => ({ streamApi: mocks.streamApi }));

const LAB = '0190a0e4-7c1d-7b9e-8f00-0000000000d1';
const learner = meWith(LEARNER_FLAGS, ['ai:chat', 'ai:hints']);

function serve(overrides: object = {}) {
  mocks.api.mockImplementation(async (path: string, options?: { body?: unknown }) => {
    if (path === '/ai/availability') return { ...AVAILABLE, ...overrides };
    if (path === '/ai/conversations' && options?.body) {
      return {
        id: '0190a0e4-7c1d-7b9e-8f00-0000000000c1',
        purpose: 'lab_hint',
        title: '',
        status: 'active',
        createdAt: '2026-10-04T10:00:00.000Z',
        lastMessageAt: null,
      };
    }
    throw new Error(`unexpected ${path}`);
  });
}

beforeEach(() => {
  mocks.api.mockReset();
  mocks.streamApi.mockReset();
});
afterEach(cleanup);

describe('a lab’s AI Hint (Phase 7E)', () => {
  it('is offered to a learner with ai:hints, with module.ai and ai.lab_hints on and hints approved', async () => {
    serve();
    renderWith(<LabHint questionId={LAB} failedAttempt />, learner);
    expect(await screen.findByRole('button', { name: 'AI Hint' })).toBeTruthy();
  });

  it('is not offered without the permission, the flag, or the institute’s approval', async () => {
    serve();
    const cases = [
      meWith(LEARNER_FLAGS, ['ai:chat']),
      meWith({ ...LEARNER_FLAGS, 'ai.lab_hints': false }, ['ai:chat', 'ai:hints']),
      meWith({ ...LEARNER_FLAGS, 'module.ai': false }, ['ai:chat', 'ai:hints']),
      // Staff whose role was given ai:hints: their labs are previews, and the API refuses them.
      meWith(LEARNER_FLAGS, ['ai:chat', 'ai:hints'], false),
    ];
    for (const me of cases) {
      const view = renderWith(<LabHint questionId={LAB} failedAttempt />, me);
      await act(async () => undefined);
      expect(screen.queryByRole('button', { name: 'AI Hint' })).toBeNull();
      view.unmount();
    }
    serve({ subjects: { course: true, labHints: false } });
    renderWith(<LabHint questionId={LAB} failedAttempt />, learner);
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/ai/availability'));
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: 'AI Hint' })).toBeNull();
  });

  it('promises a way to reason, not the solution, and asks for an attempt first', async () => {
    serve();
    renderWith(<LabHint questionId={LAB} failedAttempt={false} />, learner);
    fireEvent.click(await screen.findByRole('button', { name: 'AI Hint' }));
    expect(await screen.findByText(HINT_PROMISE)).toBeTruthy();
    expect(HINT_PROMISE).toBe(
      'AI Hint — helps you reason about the problem without giving the solution.',
    );
    expect(screen.getByText('Try the lab first.')).toBeTruthy();
    expect(screen.queryByLabelText('What you are stuck on')).toBeNull();
  });

  it('after a failed attempt, sends the lab’s id and the question — nothing else — and shows the hint', async () => {
    serve();
    mocks.streamApi.mockImplementation(() => streamOf(answered('Check how you read the input.')));
    renderWith(<LabHint questionId={LAB} failedAttempt />, learner);
    fireEvent.click(await screen.findByRole('button', { name: 'AI Hint' }));
    fireEvent.change(await screen.findByLabelText('What you are stuck on'), {
      target: { value: 'Why is my sum wrong?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Check how you read the input.');
    expect(mocks.api).toHaveBeenCalledWith('/ai/conversations', {
      body: { purpose: 'lab_hint', context: { questionId: LAB } },
    });
    expect(mocks.streamApi.mock.calls[0]!.slice(0, 2)).toEqual([
      '/ai/conversations/0190a0e4-7c1d-7b9e-8f00-0000000000c1/messages',
      { content: 'Why is my sum wrong?' },
    ]);
    // The hint reads nothing of the lab itself: no case, solution or submission is fetched here.
    const paths = mocks.api.mock.calls.map(([path]) => path as string);
    expect(paths.every((path) => path.startsWith('/ai/'))).toBe(true);
  });

  it('says why when the server refuses a hint, in safe words, and keeps the question', async () => {
    serve();
    mocks.streamApi.mockImplementation(() => {
      throw new ApiError(422, {
        type: 'about:blank',
        title: 'Unprocessable',
        status: 422,
        code: 'ai_hint_needs_attempt',
        detail: 'SERVER-DETAIL-MARKER',
      });
    });
    renderWith(<LabHint questionId={LAB} failedAttempt />, learner);
    fireEvent.click(await screen.findByRole('button', { name: 'AI Hint' }));
    const input = (await screen.findByLabelText('What you are stuck on')) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Help me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    const status = await screen.findByRole('status');
    expect(status.textContent).toMatch(/Submit an attempt first/);
    expect(document.body.textContent).not.toContain('SERVER-DETAIL-MARKER');
    await waitFor(() => expect(input.value).toBe('Help me'));
  });

  it('counts a submission that was not accepted as a failed attempt', () => {
    expect(isFailedVerdict('wrong_answer')).toBe(true);
    expect(isFailedVerdict('runtime_error')).toBe(true);
    expect(isFailedVerdict('passed')).toBe(false);
    expect(isFailedVerdict('pending')).toBe(false);
  });
});
