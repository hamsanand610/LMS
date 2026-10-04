'use client';

import { Send, Sparkles, Square } from 'lucide-react';
import { memo, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { type ChatTurn, ENDING_NOTE } from './chat-state';
import type { AiChat } from './use-ai-chat';

/**
 * A conversation with SI Academy AI and the box to ask in (Phase 7E): used by the workspace, the
 * assistant beside a course or lesson, and a lab's AI Hint. The thread scrolls inside its panel and
 * the composer stays at the bottom. Answers are plain text: nothing the model writes is rendered
 * as markup.
 */
export function ChatThread({
  chat,
  intro,
  placeholder = 'Ask about what you are learning',
  label = 'Your question',
  className,
}: {
  chat: AiChat;
  /** What the empty thread says before the first question. */
  intro: React.ReactNode;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const { turns, busy, notice } = chat;
  const last = turns.at(-1);

  // Follows the answer as it is written, unless the reader has scrolled up to read something.
  const lastText = last?.text.length ?? 0;
  const count = turns.length;
  const following = useRef(true);
  useEffect(() => {
    const element = scroller.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [count, lastText]);

  async function ask() {
    const question = draft.trim();
    if (!question || busy) return;
    following.current = true;
    setDraft('');
    const accepted = await chat.send(question);
    if (!accepted) setDraft((current) => current || question);
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div
        ref={scroller}
        onScroll={(event) => {
          const element = event.currentTarget;
          following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
      >
        {turns.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center py-8 text-center">
            <span className="mb-3 grid size-10 place-items-center rounded-full bg-primary-soft text-brand">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div className="text-sm leading-relaxed text-muted-foreground">{intro}</div>
          </div>
        ) : (
          <ol aria-label="Conversation" className="space-y-3">
            {turns.map((turn) => (
              <Turn key={turn.key} turn={turn} />
            ))}
          </ol>
        )}
        <p className="sr-only" aria-live="polite">
          {last?.role === 'assistant' && last.status !== 'streaming' ? 'The answer has ended.' : ''}
        </p>
      </div>
      <div className="border-t border-border bg-card px-4 pt-3 pb-4 sm:px-5">
        {notice ? (
          <p
            role="status"
            className="mb-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] leading-relaxed text-foreground"
          >
            {notice}
          </p>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
        >
          <Label htmlFor={inputId} className="sr-only">
            {label}
          </Label>
          <div className="flex items-end gap-2">
            <Textarea
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter asks; Shift+Enter starts a new line; a word being composed is left alone.
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void ask();
                }
              }}
              maxLength={4000}
              rows={2}
              placeholder={placeholder}
              className="max-h-40 min-h-11 resize-none"
            />
            {busy ? (
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                onClick={chat.stop}
                aria-label="Stop the answer"
              >
                <Square aria-hidden="true" />
              </Button>
            ) : (
              <Button type="submit" size="icon-lg" disabled={!draft.trim()} aria-label="Send">
                <Send aria-hidden="true" />
              </Button>
            )}
          </div>
          <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
            Answers can be wrong: check them against your course. Never include passwords, keys or
            personal details.
          </p>
        </form>
      </div>
    </div>
  );
}

/** One message. Memoised: while an answer streams, only the answer being written re-renders. */
const Turn = memo(function Turn({ turn }: { turn: ChatTurn }) {
  const mine = turn.role === 'user';
  const note = ENDING_NOTE[turn.status];
  return (
    <li
      data-role={turn.role}
      data-status={turn.status}
      aria-busy={turn.status === 'streaming'}
      className={cn(
        'max-w-[92%] rounded-2xl px-3.5 py-2.5',
        mine ? 'ml-auto bg-surface-2' : 'border border-border bg-card',
      )}
    >
      <p className="mb-1 text-[11.5px] font-medium text-muted-foreground">
        {mine ? 'You' : 'SI Academy AI'}
      </p>
      {turn.text ? (
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{turn.text}</p>
      ) : turn.status === 'streaming' ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
          Writing…
        </p>
      ) : null}
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </li>
  );
});
