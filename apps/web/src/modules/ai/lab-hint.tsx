'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useMe } from '@/shell/me-context';
import { canUseAi } from './access';
import { ChatThread } from './chat-thread';
import { useAiAvailability } from './queries';
import { useAiChat } from './use-ai-chat';

/** The promise the hint makes, word for word wherever it is offered (Phase 7E brief). */
export const HINT_PROMISE =
  'AI Hint — helps you reason about the problem without giving the solution.';

/** A lab submission that was not accepted: what a hint needs first. */
export function isFailedVerdict(verdict: string): boolean {
  return verdict !== 'passed' && verdict !== 'pending';
}

/**
 * A lab's AI Hint (Phase 7E): offered to a learner with `ai:hints` while `module.ai` and
 * `ai.lab_hints` are on and the institute approved their own work for the provider. It opens after a
 * submission that was not accepted. The browser sends the lab's id and the learner's question,
 * nothing else: the API checks the lab and the attempt and builds the hint's material itself, and
 * never from a hidden case, a solution or anybody else's work.
 */
export function LabHint({
  questionId,
  failedAttempt,
}: {
  questionId: string;
  failedAttempt: boolean;
}) {
  const me = useMe();
  const allowed = canUseAi(me, 'lab_hints');
  const availability = useAiAvailability(allowed);
  const [open, setOpen] = useState(false);
  if (!allowed || !availability.data?.available || !availability.data.subjects.labHints) {
    return null;
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="border-primary-muted text-brand hover:bg-primary-soft"
      >
        <Sparkles aria-hidden="true" />
        AI Hint
      </Button>
      <HintSession
        questionId={questionId}
        failedAttempt={failedAttempt}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/** The hint conversation for one lab; it stays while the panel is closed and opened again. */
function HintSession({
  questionId,
  failedAttempt,
  open,
  onOpenChange,
}: {
  questionId: string;
  failedAttempt: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chat = useAiChat({
    conversationId,
    create: { purpose: 'lab_hint', context: { questionId } },
    onCreated: (conversation) => setConversationId(conversation.id),
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b border-border pr-12">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" aria-hidden="true" />
            AI Hint
          </SheetTitle>
          <SheetDescription>{HINT_PROMISE}</SheetDescription>
        </SheetHeader>
        {failedAttempt || chat.turns.length > 0 ? (
          <ChatThread
            chat={chat}
            label="What you are stuck on"
            placeholder="What are you stuck on?"
            intro={
              <p>
                Say where you are stuck. The hint looks at the lab, its visible examples and your
                latest submission — never the hidden checks or a solution — and points you to the
                next step, not the answer.
              </p>
            }
          />
        ) : (
          <div className="px-5 py-6 text-sm leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Try the lab first.</p>
            <p className="mt-1">
              Submit your code. If the submission is not accepted, AI Hint can help you see where to
              look.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
