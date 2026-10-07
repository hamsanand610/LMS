'use client';

import { SearchCheck, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useMe } from '@/shell/me-context';
import { canUseAgent } from './agent';
import { ChatThread } from './chat-thread';
import { useAiAvailability } from './queries';
import { useAgentRun } from './use-agent-run';

/** The question the button asks, word for word (the client's Phase 9 brief). */
export const EXPLAIN_ATTEMPT = 'Explain my failed attempt';

/**
 * "Explain my failed attempt" beside a lab (Phase 9D; ADR-0040): the learning agent explains the
 * learner's own latest attempt that did not pass — what its result shows and what to check again —
 * from the lab's statement, its visible examples and the learner's own code, never a hidden check or
 * a solution, and with no code of its own. Offered only to a learner with the agent on, after an
 * attempt that did not pass, while the institute approved the learner's own work for the AI provider
 * (`learnerContext`). The browser names the lab by id and nothing else; the API checks the lab,
 * the attempt and the learner again on every run.
 */
export function ExplainAttempt({
  questionId,
  failedAttempt,
}: {
  questionId: string;
  failedAttempt: boolean;
}) {
  const me = useMe();
  const allowed = canUseAgent(me);
  const availability = useAiAvailability(allowed);
  const [open, setOpen] = useState(false);
  if (
    !allowed ||
    !failedAttempt ||
    !availability.data?.available ||
    !availability.data.subjects.learnerContext
  ) {
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
        <SearchCheck aria-hidden="true" />
        {EXPLAIN_ATTEMPT}
      </Button>
      <AttemptSession questionId={questionId} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** The explanation's conversation for one lab: it asks once, when first opened, and stays. */
function AttemptSession({
  questionId,
  open,
  onOpenChange,
}: {
  questionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chat = useAgentRun({
    conversationId,
    context: { questionId },
    onCreated: (conversation) => setConversationId(conversation.id),
  });
  const asked = useRef(false);
  const { send } = chat;
  useEffect(() => {
    if (open && !asked.current) {
      asked.current = true;
      void send(EXPLAIN_ATTEMPT);
    }
  }, [open, send]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b border-border pr-12">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" aria-hidden="true" />
            {EXPLAIN_ATTEMPT}
          </SheetTitle>
          <SheetDescription>
            What your latest attempt shows, and what to check again — never the solution.
          </SheetDescription>
        </SheetHeader>
        <ChatThread
          chat={chat}
          label="Your question"
          placeholder="Ask about your attempt"
          intro={
            <p>
              SI Academy AI reads the lab, its visible examples and your latest attempt — never the
              hidden checks or a solution.
            </p>
          }
        />
      </SheetContent>
    </Sheet>
  );
}
