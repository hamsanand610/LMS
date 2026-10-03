'use client';

import { Send, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import type { AiAnswerEnding, AiConversationSummary } from '@lms/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { streamApi } from '@/lib/api/stream';

interface Turn {
  key: string;
  role: 'user' | 'assistant';
  text: string;
  status: 'streaming' | AiAnswerEnding;
}

const ENDING_NOTE: Partial<Record<Turn['status'], string>> = {
  cancelled: 'Stopped.',
  failed: 'No answer this time.',
  blocked: 'SI Academy AI could not answer this.',
};

/**
 * A minimal way to talk to SI Academy AI (Phase 7C): one conversation, the answer written as it
 * streams, and a Stop button. The full workspace — conversations, history, the launcher — is Phase
 * 7E's; this exists so the stream can be used and checked end to end. It appears only where the
 * page does: `module.ai`, `ai.workspace` and `ai:chat`, and the API checks each question again.
 */
export function AiChatPreview() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reading = useRef<AbortController | null>(null);

  async function ask() {
    const question = draft.trim();
    if (!question || busy) return;
    const controller = new AbortController();
    reading.current = controller;
    const stamp = Date.now();
    const questionKey = `q-${stamp}`;
    const answerKey = `a-${stamp}`;
    const patch = (change: (turn: Turn) => Partial<Turn>) =>
      setTurns((all) =>
        all.map((turn) => (turn.key === answerKey ? { ...turn, ...change(turn) } : turn)),
      );
    setBusy(true);
    setNotice(null);
    setDraft('');
    setTurns((all) => [
      ...all,
      { key: questionKey, role: 'user', text: question, status: 'complete' },
      { key: answerKey, role: 'assistant', text: '', status: 'streaming' },
    ]);
    let started = false;
    try {
      let id = conversationId;
      if (!id) {
        id = (
          await api<AiConversationSummary>('/ai/conversations', { body: { purpose: 'workspace' } })
        ).id;
        setConversationId(id);
      }
      for await (const { event, data } of streamApi(
        `/ai/conversations/${id}/messages`,
        { content: question },
        controller.signal,
      )) {
        started = true;
        const payload = (data ?? {}) as Record<string, unknown>;
        if (event === 'delta') {
          patch((turn) => ({ text: turn.text + String(payload['text'] ?? '') }));
        } else if (event === 'notice' || event === 'error') {
          setNotice(String(payload['message'] ?? ''));
        } else if (event === 'done') {
          patch(() => ({ status: payload['status'] as AiAnswerEnding }));
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        patch(() => ({ status: 'cancelled' }));
      } else if (!started && isApiError(error)) {
        // Refused before anything was written (busy, an allowance used, the policy): the question
        // was not kept, so it goes back where it was typed.
        setTurns((all) => all.filter((turn) => turn.key !== questionKey && turn.key !== answerKey));
        setDraft(question);
        setNotice(error.message);
      } else {
        patch(() => ({ status: 'failed' }));
        setNotice('SI Academy AI could not be reached. Try again.');
      }
    } finally {
      reading.current = null;
      setBusy(false);
    }
  }

  const last = turns.at(-1);

  return (
    <Card className="max-w-3xl">
      <CardContent className="space-y-5 px-4 pt-5 sm:px-6">
        {turns.length > 0 && (
          <ol aria-label="Conversation" className="space-y-3">
            {turns.map((turn) => (
              <li
                key={turn.key}
                data-role={turn.role}
                data-status={turn.status}
                aria-busy={turn.status === 'streaming'}
                className={
                  turn.role === 'user'
                    ? 'ml-auto max-w-[85%] rounded-xl bg-surface-2 px-3.5 py-2.5'
                    : 'max-w-[95%] rounded-xl border border-border px-3.5 py-2.5'
                }
              >
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {turn.role === 'user' ? 'You' : 'SI Academy AI'}
                </p>
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                  {turn.text || (turn.status === 'streaming' ? 'Writing…' : '')}
                </p>
                {ENDING_NOTE[turn.status] && (
                  <p className="mt-1 text-xs text-muted-foreground">{ENDING_NOTE[turn.status]}</p>
                )}
              </li>
            ))}
          </ol>
        )}
        <p className="sr-only" aria-live="polite">
          {last?.role === 'assistant' && last.status !== 'streaming' ? 'The answer has ended.' : ''}
        </p>
        {notice && (
          <p role="status" className="text-sm text-warning">
            {notice}
          </p>
        )}
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
        >
          <Label htmlFor="ai-question">Your question</Label>
          <Textarea
            id="ai-question"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={4000}
            rows={3}
            disabled={busy}
            placeholder="Ask about what you are learning"
          />
          <p className="text-xs text-muted-foreground">
            Answers can be wrong: check them against your course. Never include passwords, keys or
            personal details.
          </p>
          <div className="flex justify-end">
            {busy ? (
              <Button type="button" variant="outline" onClick={() => reading.current?.abort()}>
                <Square aria-hidden="true" /> Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!draft.trim()}>
                <Send aria-hidden="true" /> Send
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
