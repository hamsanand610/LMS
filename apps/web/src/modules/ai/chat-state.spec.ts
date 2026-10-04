import { describe, expect, it } from 'vitest';
import type { AiMessageView } from '@lms/shared';
import { EMPTY_CHAT, chatReducer, createDeltaBuffer, type ChatState } from './chat-state';

const asked = (question = 'What is a loop?'): ChatState =>
  chatReducer(EMPTY_CHAT, { type: 'ask', key: 't1', question });

describe('the thread’s state while an answer streams (Phase 7E)', () => {
  it('adds the question and the answer’s placeholder together, then writes into the answer', () => {
    let state = asked();
    expect(state.turns.map((t) => [t.role, t.status])).toEqual([
      ['user', 'complete'],
      ['assistant', 'streaming'],
    ]);
    state = chatReducer(state, { type: 'append', text: 'A loop ' });
    state = chatReducer(state, { type: 'append', text: 'repeats.' });
    state = chatReducer(state, { type: 'end', status: 'complete' });
    expect(state.pending).toBeNull();
    expect(state.turns[1]).toMatchObject({ text: 'A loop repeats.', status: 'complete' });
    // Nothing is written once the answer has ended.
    expect(chatReducer(state, { type: 'append', text: 'more' })).toBe(state);
  });

  it('keeps a stopped answer in view as far as it got, and shows no failed or withheld text', () => {
    const writing = chatReducer(asked(), { type: 'append', text: 'Half an' });
    expect(chatReducer(writing, { type: 'end', status: 'cancelled' }).turns[1]).toMatchObject({
      status: 'cancelled',
      text: 'Half an',
    });
    for (const status of ['failed', 'blocked'] as const) {
      expect(chatReducer(writing, { type: 'end', status }).turns[1]).toMatchObject({
        status,
        text: '',
      });
    }
  });

  it('takes a refused question and its placeholder out, leaving earlier turns', () => {
    let state = chatReducer(asked('First'), { type: 'end', status: 'complete' });
    state = chatReducer(state, { type: 'ask', key: 't2', question: 'Second' });
    state = chatReducer(state, { type: 'withdraw' });
    expect(state.turns.map((t) => t.text)).toEqual(['First', '']);
    expect(state.turns).toHaveLength(2);
    expect(state.pending).toBeNull();
  });

  it('loads a conversation’s kept messages as they are', () => {
    const messages: AiMessageView[] = [
      {
        id: '0190a0e4-7c1d-7b9e-8f00-000000000001',
        conversationId: '0190a0e4-7c1d-7b9e-8f00-0000000000c1',
        role: 'user',
        content: 'Hi',
        status: 'complete',
        createdAt: '2026-10-04T10:00:00.000Z',
      },
      {
        id: '0190a0e4-7c1d-7b9e-8f00-000000000002',
        conversationId: '0190a0e4-7c1d-7b9e-8f00-0000000000c1',
        role: 'assistant',
        content: '',
        status: 'cancelled',
        createdAt: '2026-10-04T10:00:01.000Z',
      },
    ];
    const state = chatReducer(asked(), { type: 'load', messages });
    expect(state.turns).toEqual([
      { key: messages[0]!.id, role: 'user', text: 'Hi', status: 'complete' },
      { key: messages[1]!.id, role: 'assistant', text: '', status: 'cancelled' },
    ]);
    expect(state.pending).toBeNull();
  });
});

describe('text arriving token by token', () => {
  it('reaches the screen once per frame, not once per token', () => {
    const frames: (() => void)[] = [];
    const flushed: string[] = [];
    const buffer = createDeltaBuffer(
      (text) => flushed.push(text),
      (run) => frames.push(run),
    );
    for (const token of ['A', ' loop', ' repeats', '.']) buffer.push(token);
    expect(frames).toHaveLength(1);
    expect(flushed).toEqual([]);
    frames.shift()!();
    expect(flushed).toEqual(['A loop repeats.']);
    buffer.push('!');
    buffer.drain();
    expect(flushed).toEqual(['A loop repeats.', '!']);
    // The frame scheduled for "!" finds nothing left to hand over.
    frames.shift()!();
    expect(flushed).toHaveLength(2);
  });
});
