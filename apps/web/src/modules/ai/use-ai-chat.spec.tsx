// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { answered, streamOf } from './testing';
import { useAiChat } from './use-ai-chat';

const mocks = vi.hoisted(() => ({ api: vi.fn(), streamApi: vi.fn() }));
vi.mock('@/lib/api/http', () => ({ api: mocks.api }));
vi.mock('@/lib/api/stream', () => ({ streamApi: mocks.streamApi }));

const CONVERSATION = {
  id: '0190a0e4-7c1d-7b9e-8f00-0000000000c1',
  purpose: 'assistant',
  title: '',
  status: 'active',
  createdAt: '2026-10-04T10:00:00.000Z',
  lastMessageAt: null,
};
const create = {
  purpose: 'assistant' as const,
  context: { courseId: '0190a0e4-7c1d-7b9e-8f00-0000000000a1' },
};

beforeEach(() => {
  mocks.api.mockReset();
  mocks.streamApi.mockReset();
});
afterEach(cleanup);

describe('a conversation with SI Academy AI as it streams (Phase 7E)', () => {
  it('starts the conversation with the first question — ids only — and writes the answer as it comes', async () => {
    mocks.api.mockResolvedValue(CONVERSATION);
    mocks.streamApi.mockImplementation(() => streamOf(answered('A loop repeats a block.')));
    const onCreated = vi.fn();
    const onAnswered = vi.fn();
    const { result } = renderHook(() =>
      useAiChat({ conversationId: null, create, onCreated, onAnswered }),
    );

    let accepted = false;
    await act(async () => {
      accepted = await result.current.send('  What is a loop?  ');
    });
    expect(accepted).toBe(true);
    expect(mocks.api).toHaveBeenCalledWith('/ai/conversations', { body: create });
    expect(mocks.streamApi).toHaveBeenCalledWith(
      `/ai/conversations/${CONVERSATION.id}/messages`,
      { content: 'What is a loop?' },
      expect.any(AbortSignal),
    );
    expect(result.current.turns.map((t) => [t.role, t.text, t.status])).toEqual([
      ['user', 'What is a loop?', 'complete'],
      ['assistant', 'A loop repeats a block.', 'complete'],
    ]);
    expect(onCreated).toHaveBeenCalledWith(CONVERSATION);
    expect(onAnswered).toHaveBeenCalledWith(CONVERSATION.id);
    expect(result.current.busy).toBe(false);

    // The next question goes to the same conversation: none is started again.
    mocks.streamApi.mockImplementation(() => streamOf(answered('Yes.')));
    await act(async () => {
      await result.current.send('And a while loop?');
    });
    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(result.current.turns).toHaveLength(4);
  });

  it('stops an answer being written: the thread says so and the reader lets go', async () => {
    let release: () => void = () => undefined;
    mocks.streamApi.mockImplementation(async function* (
      _path: string,
      _body: unknown,
      signal: AbortSignal,
    ) {
      yield { event: 'delta', data: { text: 'Half an' } };
      await new Promise<void>((resolve) => {
        release = resolve;
        signal.addEventListener('abort', () => resolve());
      });
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    });
    const { result } = renderHook(() => useAiChat({ conversationId: CONVERSATION.id, create }));
    let sending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      sending = result.current.send('Explain recursion');
    });
    await waitFor(() => expect(result.current.busy).toBe(true));
    act(() => result.current.stop());
    await act(async () => {
      await sending;
    });
    release();
    expect(result.current.turns[1]).toMatchObject({ status: 'cancelled', text: 'Half an' });
    expect(result.current.busy).toBe(false);
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it('gives a refused question back, says why in the product’s words, and keeps nothing of it', async () => {
    mocks.streamApi.mockImplementation(() => {
      throw new ApiError(429, {
        type: 'about:blank',
        title: 'AI allowance used',
        status: 429,
        code: 'ai_quota_exceeded',
        detail: 'SERVER-DETAIL-MARKER',
      });
    });
    const { result } = renderHook(() => useAiChat({ conversationId: CONVERSATION.id, create }));
    let accepted = true;
    await act(async () => {
      accepted = await result.current.send('One more question');
    });
    expect(accepted).toBe(false);
    expect(result.current.turns).toEqual([]);
    expect(result.current.notice).toMatch(/limit for now/);
    expect(result.current.notice).not.toContain('SERVER-DETAIL-MARKER');
  });

  it('says an error inside the stream by its code, and shows no failed text as an answer', async () => {
    mocks.streamApi.mockImplementation(() =>
      streamOf([
        { event: 'delta', data: { text: 'Partial' } },
        { event: 'error', data: { code: 'ai_timeout', message: 'upstream said something' } },
        { event: 'done', data: { messageId: 'm', status: 'failed' } },
      ]),
    );
    const { result } = renderHook(() => useAiChat({ conversationId: CONVERSATION.id, create }));
    await act(async () => {
      await result.current.send('Slow question');
    });
    expect(result.current.turns[1]).toMatchObject({ status: 'failed', text: '' });
    expect(result.current.notice).toMatch(/too long/);
    expect(result.current.notice).not.toContain('upstream');
  });

  it('treats a stream that ends without its last event as a failed answer', async () => {
    mocks.streamApi.mockImplementation(() => streamOf([{ event: 'delta', data: { text: 'Cut' } }]));
    const { result } = renderHook(() => useAiChat({ conversationId: CONVERSATION.id, create }));
    await act(async () => {
      await result.current.send('Question');
    });
    expect(result.current.turns[1]).toMatchObject({ status: 'failed' });
    expect(result.current.notice).toMatch(/stopped arriving/);
  });

  it('keeps nothing of the conversation in the browser’s storage', async () => {
    mocks.streamApi.mockImplementation(() => streamOf(answered('Private answer')));
    const { result } = renderHook(() => useAiChat({ conversationId: CONVERSATION.id, create }));
    await act(async () => {
      await result.current.send('Private question');
    });
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain('Private');
  });
});
