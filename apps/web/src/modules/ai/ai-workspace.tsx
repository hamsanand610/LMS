'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Plus, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { AiConversationDetail, AiConversationSummary, Paginated } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { aiErrorMessage } from './ai-errors';
import { ChatThread } from './chat-thread';
import {
  AI_KEYS,
  HISTORY_PAGE_SIZE,
  PURPOSE_LABEL,
  conversationTitle,
  useAiConversations,
} from './queries';
import { useAiChat } from './use-ai-chat';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** When a new conversation's title, written in the background (Phase 7D), is looked for again. */
const TITLE_REFRESH_MS = [3_000, 8_000];

/** The thread on screen: a conversation by id, or a new one; `key` changes only on a switch. */
interface Shown {
  key: number;
  id: string | null;
}

/**
 * SI Academy AI's workspace (Phase 7E): the person's own conversations beside the open one. The
 * open conversation is in the address (`?c=`), so it survives a reload and can be linked to; on a
 * phone the history is a drawer. Deleting a conversation removes it at once.
 */
export function AiWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const requested = params.get('c');
  const active = requested && UUID.test(requested) ? requested : null;
  const [shown, setShown] = useState<Shown>({ key: 0, id: active });
  const [drawer, setDrawer] = useState(false);
  const [deleting, setDeleting] = useState<AiConversationSummary | null>(null);
  const createdHere = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const list = useAiConversations();

  // The address changed from outside the thread (history, a link, back): show what it names.
  useEffect(() => {
    if (active === createdHere.current) return;
    setShown((current) => (current.id === active ? current : { key: current.key + 1, id: active }));
  }, [active]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const open = useCallback(
    (id: string | null) => {
      createdHere.current = null;
      setShown((current) => ({ key: current.key + 1, id }));
      setDrawer(false);
      router.replace(id ? `/ai?c=${id}` : '/ai', { scroll: false });
    },
    [router],
  );

  const refreshList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: AI_KEYS.conversations });
  }, [queryClient]);

  const forget = useCallback(
    (id: string) => {
      queryClient.setQueryData<Paginated<AiConversationSummary>>(AI_KEYS.conversations, (before) =>
        before ? { ...before, data: before.data.filter((c) => c.id !== id) } : before,
      );
    },
    [queryClient],
  );

  const remove = useMutation({
    mutationFn: (id: string) => api(`/ai/conversations/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      // Gone from the screen at once; put back only if the server refuses.
      await queryClient.cancelQueries({ queryKey: AI_KEYS.conversations });
      const before = queryClient.getQueryData<Paginated<AiConversationSummary>>(
        AI_KEYS.conversations,
      );
      if (before) {
        queryClient.setQueryData<Paginated<AiConversationSummary>>(AI_KEYS.conversations, {
          ...before,
          data: before.data.filter((c) => c.id !== id),
          meta: { ...before.meta, total: Math.max(0, before.meta.total - 1) },
        });
      }
      queryClient.removeQueries({ queryKey: AI_KEYS.conversation(id) });
      if (shown.id === id) open(null);
      return { before };
    },
    onSuccess: () => toast.success('Conversation deleted.'),
    onError: (error, _id, context) => {
      if (context?.before) queryClient.setQueryData(AI_KEYS.conversations, context.before);
      toast.error(aiErrorMessage(error));
    },
    onSettled: refreshList,
  });

  const history = (
    <ConversationList
      list={list}
      activeId={shown.id}
      onOpen={open}
      onDelete={(conversation) => setDeleting(conversation)}
    />
  );
  const current = list.data?.data.find((c) => c.id === shown.id) ?? null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[1.75rem] leading-tight text-foreground sm:text-[2.1rem]">
            SI Academy AI
          </h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Ask about what you are learning, within what you can already see.
          </p>
        </div>
        <Button variant="outline" className="lg:hidden" onClick={() => setDrawer(true)}>
          <History aria-hidden="true" />
          Conversations
        </Button>
        <Button onClick={() => open(null)} aria-label="New conversation">
          <Plus aria-hidden="true" />
          <span className="hidden sm:inline">New conversation</span>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside
          aria-label="Your conversations"
          className="hidden h-[calc(100dvh-var(--header-height)-10rem)] min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-card lg:flex"
        >
          <p className="border-b border-border px-4 py-3 text-[13px] font-semibold text-foreground">
            Your conversations
          </p>
          {history}
        </aside>

        <section
          aria-label={current ? conversationTitle(current) : 'New conversation'}
          className="flex h-[calc(100dvh-var(--header-height)-10.5rem-env(safe-area-inset-bottom))] min-h-[24rem] flex-col overflow-hidden rounded-xl border border-border bg-card sm:h-[calc(100dvh-var(--header-height)-12.5rem-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-var(--header-height)-10rem)]"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 sm:px-5">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {current
                ? conversationTitle(current)
                : shown.id
                  ? 'Conversation'
                  : 'New conversation'}
            </p>
            {current && PURPOSE_LABEL[current.purpose] ? (
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {PURPOSE_LABEL[current.purpose]}
              </span>
            ) : null}
            {current ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDeleting(current)}
                aria-label="Delete this conversation"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          <WorkspaceThread
            key={shown.key}
            conversationId={shown.id}
            onCreated={(conversation) => {
              createdHere.current = conversation.id;
              setShown((existing) => ({ ...existing, id: conversation.id }));
              queryClient.setQueryData<Paginated<AiConversationSummary>>(
                AI_KEYS.conversations,
                (before) =>
                  before
                    ? {
                        ...before,
                        data: [conversation, ...before.data],
                        meta: { ...before.meta, total: before.meta.total + 1 },
                      }
                    : before,
              );
              router.replace(`/ai?c=${conversation.id}`, { scroll: false });
            }}
            onAnswered={(id, first) => {
              refreshList();
              void queryClient.invalidateQueries({ queryKey: AI_KEYS.conversation(id) });
              if (first) {
                for (const delay of TITLE_REFRESH_MS) {
                  timers.current.push(setTimeout(refreshList, delay));
                }
              }
            }}
            onGone={forget}
            onStartNew={() => open(null)}
          />
        </section>
      </div>

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-[88vw] gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Your conversations</SheetTitle>
            <SheetDescription className="sr-only">Only you can see them.</SheetDescription>
          </SheetHeader>
          {history}
        </SheetContent>
      </Sheet>

      <Dialog open={deleting !== null} onOpenChange={(next) => (next ? null : setDeleting(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>
              “{deleting ? conversationTitle(deleting) : ''}” and all its messages will be deleted
              for good. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) remove.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The person's conversations, newest first; each opens, and each can be deleted. */
function ConversationList({
  list,
  activeId,
  onOpen,
  onDelete,
}: {
  list: ReturnType<typeof useAiConversations>;
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (conversation: AiConversationSummary) => void;
}) {
  if (list.isPending) return <LoadingRows rows={4} className="p-3" />;
  if (list.isError) {
    return (
      <div className="p-3">
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      </div>
    );
  }
  const conversations = list.data.data;
  if (conversations.length === 0) {
    return (
      <p className="px-4 py-6 text-sm leading-relaxed text-muted-foreground">
        Your conversations appear here. Only you can see them.
      </p>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ul className="space-y-0.5 p-2">
        {conversations.map((conversation) => {
          const current = conversation.id === activeId;
          const label = PURPOSE_LABEL[conversation.purpose];
          return (
            <li key={conversation.id} className="group/item relative">
              <button
                type="button"
                onClick={() => onOpen(conversation.id)}
                aria-current={current ? 'true' : undefined}
                className={cn(
                  'w-full rounded-lg py-2 pr-10 pl-3 text-left transition-colors',
                  current ? 'bg-primary-soft text-foreground' : 'hover:bg-surface-2',
                )}
              >
                <span className="block truncate text-sm font-medium">
                  {conversationTitle(conversation)}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {label ? `${label} · ` : ''}
                  {formatDateTime(conversation.lastMessageAt ?? conversation.createdAt)}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onDelete(conversation)}
                aria-label={`Delete “${conversationTitle(conversation)}”`}
                className="absolute top-1/2 right-2 -translate-y-1/2 opacity-70 group-hover/item:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          );
        })}
      </ul>
      {list.data.meta.total > conversations.length ? (
        <p className="px-4 pb-4 text-xs text-muted-foreground">
          Showing your {HISTORY_PAGE_SIZE} most recent conversations.
        </p>
      ) : null}
    </div>
  );
}

/** The open conversation: its messages, read once, then the live thread. */
function WorkspaceThread({
  conversationId,
  onCreated,
  onAnswered,
  onGone,
  onStartNew,
}: {
  conversationId: string | null;
  onCreated: (conversation: AiConversationSummary) => void;
  onAnswered: (id: string, first: boolean) => void;
  onGone: (id: string) => void;
  onStartNew: () => void;
}) {
  // Read once, when the thread opens on an existing conversation; one started here has nothing to read.
  const [readFrom] = useState(conversationId);
  const answered = useRef(0);
  const chat = useAiChat({
    conversationId,
    create: { purpose: 'workspace' },
    onCreated,
    onAnswered: (id) => {
      answered.current += 1;
      onAnswered(id, readFrom === null && answered.current === 1);
    },
  });
  const detail = useQuery({
    queryKey: AI_KEYS.conversation(readFrom ?? 'none'),
    queryFn: () => api<AiConversationDetail>(`/ai/conversations/${readFrom}`),
    enabled: readFrom !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: (count, error) => !(isApiError(error) && error.status < 500) && count < 1,
  });
  const loaded = useRef(false);
  const { load } = chat;
  useEffect(() => {
    if (detail.data && !loaded.current) {
      loaded.current = true;
      load(detail.data.messages);
    }
  }, [detail.data, load]);
  const gone = detail.isError && isApiError(detail.error) && detail.error.status === 404;
  useEffect(() => {
    if (gone && readFrom) onGone(readFrom);
  }, [gone, readFrom, onGone]);

  if (readFrom && detail.isPending) return <LoadingRows rows={4} className="p-5" />;
  if (gone) {
    return (
      <div className="p-5">
        <EmptyState
          title="This conversation no longer exists"
          description="It was deleted, or it is past the time conversations are kept."
          action={<Button onClick={onStartNew}>Start a new conversation</Button>}
        />
      </div>
    );
  }
  if (detail.isError) {
    return (
      <div className="p-5">
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </div>
    );
  }
  return (
    <ChatThread
      chat={chat}
      intro={
        <>
          <p className="font-medium text-foreground">What are you learning today?</p>
          <p className="mt-1">
            Ask for an explanation, an example or a way to practise. SI Academy AI answers within
            what you can already see, and never during a timed test.
          </p>
        </>
      }
    />
  );
}
