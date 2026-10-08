'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type {
  AiAnswerEnding,
  AiConversationCreate,
  AiConversationSummary,
  AiMessageView,
} from '@lms/shared';
import { api } from '@/lib/api/http';
import { streamApi } from '@/lib/api/stream';
import { aiErrorMessage, aiStreamErrorMessage } from './ai-errors';
import { EMPTY_CHAT, chatReducer, createDeltaBuffer, nextTurnKey } from './chat-state';

const CUT_SHORT = 'The answer reached its length limit and was cut short.';
const LOST = 'The answer stopped arriving. Try again.';

export interface AiChatOptions {
  /** The conversation to continue; null starts one with the first question. */
  conversationId: string | null;
  /** What a new conversation is: its surface, and its subject by id only — never content. */
  create: AiConversationCreate;
  /** The conversation the first question started. */
  onCreated?: (conversation: AiConversationSummary) => void;
  /** After every answer, however it ended: lists and titles refresh from here. */
  onAnswered?: (conversationId: string) => void;
}

/**
 * One conversation with SI Academy AI as a thread (Phase 7E): the question and its answer's
 * placeholder go in together, the answer is written as it streams (through the one stream client,
 * `streamApi`), Stop ends it, and every refusal is said in the product's words. Nothing is kept in
 * the browser beyond this component's memory: no question or answer goes to local storage.
 */
export function useAiChat({ conversationId, create, onCreated, onAnswered }: AiChatOptions) {
  const [state, dispatch] = useReducer(chatReducer, EMPTY_CHAT);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reading = useRef<AbortController | null>(null);
  const idRef = useRef<string | null>(conversationId);
  const options = useRef({ create, onCreated, onAnswered });

  // The latest callbacks and subject, for the next question; never read while rendering.
  useEffect(() => {
    options.current = { create, onCreated, onAnswered };
  });
  useEffect(() => {
    idRef.current = conversationId;
  }, [conversationId]);
  // Leaving stops reading the answer; the server, seeing the connection close, stops writing it.
  useEffect(() => () => reading.current?.abort(), []);

  /** Asks a question; false when it was refused before anything was kept (the draft stays). */
  const send = useCallback(async (text: string): Promise<boolean> => {
    const question = text.trim();
    if (!question || reading.current) return false;
    const controller = new AbortController();
    reading.current = controller;
    setBusy(true);
    setNotice(null);
    dispatch({ type: 'ask', key: nextTurnKey(), question });
    const buffer = createDeltaBuffer((delta) => dispatch({ type: 'append', text: delta }));
    let id = idRef.current;
    let started = false;
    let ended = false;
    try {
      if (!id) {
        const created = await api<AiConversationSummary>('/ai/conversations', {
          body: options.current.create,
        });
        id = created.id;
        idRef.current = id;
        options.current.onCreated?.(created);
      }
      for await (const { event, data } of streamApi(
        `/ai/conversations/${id}/messages`,
        { content: question },
        controller.signal,
      )) {
        started = true;
        const payload = (data ?? {}) as Record<string, unknown>;
        if (event === 'delta')
          buffer.push(typeof payload['text'] === 'string' ? payload['text'] : '');
        else if (event === 'notice') setNotice(CUT_SHORT);
        else if (event === 'error') setNotice(aiStreamErrorMessage(payload['code']));
        else if (event === 'done') {
          buffer.drain();
          dispatch({ type: 'end', status: payload['status'] as AiAnswerEnding });
          ended = true;
        }
      }
      if (!ended) {
        buffer.drain();
        dispatch({ type: 'end', status: controller.signal.aborted ? 'cancelled' : 'failed' });
        if (!controller.signal.aborted) setNotice(LOST);
      }
      return true;
    } catch (error) {
      buffer.drain();
      if (controller.signal.aborted) {
        dispatch({ type: 'end', status: 'cancelled' });
        return true;
      }
      setNotice(aiErrorMessage(error));
      if (!started) {
        // Refused before anything was written: the question was not kept, so it goes back.
        dispatch({ type: 'withdraw' });
        return false;
      }
      dispatch({ type: 'end', status: 'failed' });
      return true;
    } finally {
      reading.current = null;
      setBusy(false);
      if (id) options.current.onAnswered?.(id);
    }
  }, []);

  const stop = useCallback(() => reading.current?.abort(), []);
  const load = useCallback(
    (messages: readonly AiMessageView[]) => dispatch({ type: 'load', messages }),
    [],
  );

  return { turns: state.turns, busy, notice, setNotice, send, stop, load };
}

export type AiChat = ReturnType<typeof useAiChat>;
