'use client';

import { ArrowUpRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { AiConversationCreate, Portal } from '@lms/shared';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useMe } from '@/shell/me-context';
import { canUseAi } from './access';
import { ChatThread } from './chat-thread';
import { useAiAvailability } from './queries';
import { useAiChat } from './use-ai-chat';

/**
 * What the page in view is about, for the assistant beside it (Phase 7E): ids and a title to show,
 * nothing more. The browser never sends a course's or lesson's content: the API checks the ids
 * against what the person may open and reads the material itself, at every question.
 */
export interface AiPageSubject {
  courseId: string;
  lessonId?: string;
  /** Shown in the assistant's header only; never sent. */
  label: string;
}

interface AssistantContext {
  subject: AiPageSubject | null;
  setSubject: Dispatch<SetStateAction<AiPageSubject | null>>;
  open: () => void;
}

const Context = createContext<AssistantContext | null>(null);

/** Routes whose own controls fill the screen (a paper, an editor): no floating button there. */
const LAUNCHER_HIDDEN = [
  /^\/ai(\/|$)/,
  /^\/tests\/[^/]+\/attempt/,
  /^\/labs\/[^/]+/,
  /^\/practice\/[^/]+/,
  /^\/assignments\/[^/]+\/q\//,
  /^\/courses\/[^/]+\/lessons\/[^/]+\/(lab|practice)$/,
  /\/preview$/,
];

export function launcherHiddenOn(pathname: string): boolean {
  return LAUNCHER_HIDDEN.some((pattern) => pattern.test(pathname));
}

/** Which of SI Academy AI's entry points this person may be offered: flags and permission. */
export function aiEntryPoints(me: Parameters<typeof canUseAi>[0]) {
  return { assistant: canUseAi(me, 'assistant'), workspace: canUseAi(me, 'workspace') };
}

/** The key a subject's conversation is kept under while the page is open. */
export function subjectKey(subject: AiPageSubject | null): string {
  return subject ? `${subject.courseId}:${subject.lessonId ?? ''}` : 'general';
}

/** The new conversation the assistant starts: its subject by id, only when one is approved. */
export function assistantConversation(subject: AiPageSubject | null): AiConversationCreate {
  if (!subject) return { purpose: 'assistant' };
  return {
    purpose: 'assistant',
    context: subject.lessonId
      ? { courseId: subject.courseId, lessonId: subject.lessonId }
      : { courseId: subject.courseId },
  };
}

/**
 * SI Academy AI beside every page of a portal (Phase 7E): the floating launcher and the assistant
 * it opens, aware of the course or lesson in view. Rendered only while `module.ai` and the
 * assistant's (or the workspace's) flag and permission are on for the person, and while the AI can
 * answer them — never during a timed test.
 */
export function AiAssistantProvider({
  portal,
  children,
}: {
  portal: Portal;
  children: React.ReactNode;
}) {
  const me = useMe();
  const entry = aiEntryPoints(me);
  const [subject, setSubject] = useState<AiPageSubject | null>(null);
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ subject, setSubject, open }), [subject, open]);

  return (
    <Context.Provider value={value}>
      {children}
      {entry.assistant || entry.workspace ? (
        <Launcher
          portal={portal}
          assistant={entry.assistant}
          workspace={entry.workspace}
          subject={subject}
          open={isOpen}
          onOpenChange={setOpen}
        />
      ) : null}
    </Context.Provider>
  );
}

/** A page says what it is about while it is shown; the assistant forgets it when it goes. */
export function useAiSubject(subject: AiPageSubject | null): void {
  const context = useContext(Context);
  const setSubject = context?.setSubject;
  const key = subject ? `${subjectKey(subject)}:${subject.label}` : null;
  useEffect(() => {
    if (!setSubject || !subject || !key) return;
    setSubject(subject);
    return () =>
      setSubject((current) =>
        current && `${subjectKey(current)}:${current.label}` === key ? null : current,
      );
    // The key stands for the subject: a new object with the same ids and title changes nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSubject, key]);
}

/**
 * "Ask SI Academy AI about this …" on a course or lesson page: opens the assistant with that
 * subject. Shown only when the assistant is on and the institute approved course material for it.
 */
export function AskAiAbout({
  what,
  variant,
}: {
  what: 'course' | 'lesson';
  variant: 'card' | 'line';
}) {
  const context = useContext(Context);
  const me = useMe();
  const allowed = canUseAi(me, 'assistant');
  const availability = useAiAvailability(allowed);
  if (!context || !allowed || !availability.data?.available) return null;
  if (!availability.data.subjects.course) return null;
  if (variant === 'card') {
    return (
      <button
        type="button"
        onClick={context.open}
        aria-haspopup="dialog"
        className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-surface-2/60"
      >
        <Sparkles className="size-4 shrink-0 text-brand" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-foreground">Ask SI Academy AI</span>
          <span className="block text-xs text-muted-foreground">
            About this {what}, within what you can open.
          </span>
        </span>
      </button>
    );
  }
  return (
    <p className="mt-6 text-center text-[13px] text-muted-foreground">
      <button
        type="button"
        onClick={context.open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 rounded-md font-medium text-brand hover:underline"
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
        Ask SI Academy AI about this {what}
      </button>
    </p>
  );
}

function Launcher({
  portal,
  assistant,
  workspace,
  subject,
  open,
  onOpenChange,
}: {
  portal: Portal;
  assistant: boolean;
  workspace: boolean;
  subject: AiPageSubject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const availability = useAiAvailability();
  // Not answering now (switched off, not set up, or a timed test is open): nothing is offered.
  if (!availability.data?.available) return null;
  const withSubject = availability.data.subjects.course ? subject : null;
  const hidden = launcherHiddenOn(pathname);
  const place = cn(
    'fixed right-4 z-40 lg:right-6',
    portal === 'student'
      ? 'bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-6'
      : 'bottom-5',
  );
  const look =
    'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-[0_10px_28px_-12px_rgb(39_27_23/0.55)] ring-1 ring-black/5 transition-colors hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none';

  if (!assistant) {
    return hidden ? null : (
      <Link href="/ai" className={cn(place, look, 'w-12 sm:w-auto sm:px-4')}>
        <Sparkles className="size-5" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">SI Academy AI</span>
      </Link>
    );
  }
  return (
    <>
      {hidden ? null : (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(place, look, 'w-12 sm:w-auto sm:px-4')}
        >
          <Sparkles className="size-5" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Ask SI Academy AI</span>
        </button>
      )}
      <AssistantSession
        key={subjectKey(withSubject)}
        subject={withSubject}
        workspace={workspace}
        open={open}
        onOpenChange={onOpenChange}
      />
    </>
  );
}

/**
 * The assistant's conversation for one subject. It stays mounted while the panel is closed, so
 * closing and opening again carries on; another page's subject starts another conversation.
 */
function AssistantSession({
  subject,
  workspace,
  open,
  onOpenChange,
}: {
  subject: AiPageSubject | null;
  workspace: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chat = useAiChat({
    conversationId,
    create: assistantConversation(subject),
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
            SI Academy AI
          </SheetTitle>
          <SheetDescription>
            {subject
              ? `About ${subject.lessonId ? 'this lesson' : 'this course'}: ${subject.label}`
              : 'Ask about what you are learning.'}
          </SheetDescription>
        </SheetHeader>
        <ChatThread
          chat={chat}
          intro={
            subject ? (
              <p>
                Ask about {subject.lessonId ? 'this lesson' : 'this course'}. SI Academy AI reads
                only what you can open here, and answers within it.
              </p>
            ) : (
              <p>Ask for an explanation, an example or a way to practise.</p>
            )
          }
        />
        {workspace ? (
          <div className="border-t border-border px-5 py-2.5 text-right">
            <Link
              href={conversationId ? `/ai?c=${conversationId}` : '/ai'}
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline"
            >
              Open in the workspace
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
