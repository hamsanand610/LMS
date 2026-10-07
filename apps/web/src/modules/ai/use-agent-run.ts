'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  AI_AGENT_STEPS,
  type AiAgentCitation,
  type AiAgentRunStatus,
  type AiAgentStep,
  type AiConversationSummary,
  type AiMessageContext,
  type AiMessageView,
} from '@lms/shared';
import { api } from '@/lib/api/http';
import { streamApi } from '@/lib/api/stream';
import { AGENT_STEP_LABEL } from './agent';
import { aiErrorMessage, aiStreamErrorMessage } from './ai-errors';
import { EMPTY_CHAT, chatReducer, createDeltaBuffer } from './chat-state';

const LOST = 'The answer stopped arriving. Try again.';

export interface AgentRunOptions {
  /** The conversation to continue; null starts one with the first question. */
  conversationId: string | null;
  /** What a new conversation is about, by id only — never content; none for nothing in particular. */
  context?: AiMessageContext;
  onCreated?: (conversation: AiConversationSummary) => void;
  /** After every run, however it ended. */
  onAnswered?: (conversationId: string) => void;
}

/**
 * One conversation with the SI Academy learning agent (Phase 9D; ADR-0039, ADR-0040) as a thread.
 * A run's stream is read as the server sends it: its steps (shown in fixed, safe words), then — only
 * once the answer is verified — its words and its sources, or the platform's own words instead.
 * Nothing the server did not verify is shown, and nothing is kept in the browser beyond this
 * component's memory. Stop ends the run: closing the request cancels it on the server.
 */
export function useAgentRun({ conversationId, context, onCreated, onAnswered }: AgentRunOptions) {
  const [state, dispatch] = useReducer(chatReducer, EMPTY_CHAT);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reading = useRef<AbortController | null>(null);
  const idRef = useRef<string | null>(conversationId);
  const options = useRef({ context, onCreated, onAnswered });

  useEffect(() => {
    options.current = { context, onCreated, onAnswered };
  });
  useEffect(() => {
    idRef.current = conversationId;
  }, [conversationId]);
  useEffect(() => () => reading.current?.abort(), []);

  /** Asks a question; false when it was refused before anything was kept (the draft stays). */
  const send = useCallback(async (text: string): Promise<boolean> => {
    const question = text.trim();
    if (!question || reading.current) return false;
    const controller = new AbortController();
    reading.current = controller;
    setBusy(true);
    setNotice(null);
    dispatch({ type: 'ask', key: `t${Date.now()}`, question });
    dispatch({ type: 'step', step: AGENT_STEP_LABEL.routing });
    const buffer = createDeltaBuffer((delta) => dispatch({ type: 'append', text: delta }));
    let id = idRef.current;
    let started = false;
    let ended = false;
    let said: string | null = null;
    try {
      if (!id) {
        const created = await api<AiConversationSummary>('/ai/conversations', {
          body: {
            purpose: 'agent',
            ...(options.current.context ? { context: options.current.context } : {}),
          },
        });
        id = created.id;
        idRef.current = id;
        options.current.onCreated?.(created);
      }
      for await (const { event, data } of streamApi(
        `/ai/agent/conversations/${id}/runs`,
        { content: question },
        controller.signal,
      )) {
        started = true;
        const payload = (data ?? {}) as Record<string, unknown>;
        if (event === 'step') {
          const step = payload['step'];
          if ((AI_AGENT_STEPS as readonly unknown[]).includes(step)) {
            dispatch({ type: 'step', step: AGENT_STEP_LABEL[step as AiAgentStep] });
          }
        } else if (event === 'delta') {
          buffer.push(typeof payload['text'] === 'string' ? payload['text'] : '');
        } else if (event === 'sources') {
          buffer.drain();
          dispatch({
            type: 'sources',
            citations: Array.isArray(payload['citations'])
              ? (payload['citations'] as AiAgentCitation[])
              : [],
          });
        } else if (event === 'notice') {
          said = typeof payload['message'] === 'string' ? payload['message'] : null;
        } else if (event === 'error') {
          setNotice(aiStreamErrorMessage(payload['code']));
        } else if (event === 'done') {
          buffer.drain();
          const status = payload['status'] as AiAgentRunStatus;
          if (status === 'answered') {
            // A conflict's note goes under the answer, never into it.
            if (said) setNotice(said);
            dispatch({ type: 'end', status: 'complete' });
          } else if (status === 'failed' || status === 'cancelled') {
            dispatch({ type: 'end', status: status === 'failed' ? 'failed' : 'cancelled' });
          } else {
            // Not answered: the platform's own words, shown as a note — never a model's.
            if (said) dispatch({ type: 'notice', text: said });
            dispatch({ type: 'end', status: 'complete' });
          }
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
        // Refused before anything was kept: the question was not kept, so it goes back.
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

export type AgentRunChat = ReturnType<typeof useAgentRun>;
