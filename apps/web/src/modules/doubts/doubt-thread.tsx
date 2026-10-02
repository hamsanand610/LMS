'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CircleCheck, RotateCcw, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { DOUBT_STATUS_LABELS, type DoubtThread as DoubtThreadData } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/shell/page-header';
import { initials } from '@/shell/user-menu';
import { DOUBT_TONE, doubtsEndpoint, type DoubtRole } from './doubts-list';

/** One doubt and its conversation. Either side can write; either side can resolve or reopen. */
export function DoubtThread({
  id,
  role,
  back,
}: {
  id: string;
  role: DoubtRole;
  back: { href: string; label: string };
}) {
  const client = useQueryClient();
  const endpoint = `${doubtsEndpoint(role)}/${id}`;
  const query = useQuery({
    queryKey: ['doubt', role, id],
    queryFn: () => api<DoubtThreadData>(endpoint),
  });
  const [reply, setReply] = useState('');

  const onSaved = (thread: DoubtThreadData) => {
    client.setQueryData(['doubt', role, id], thread);
    void client.invalidateQueries({ queryKey: ['doubts', role] });
  };
  const send = useMutation({
    mutationFn: () =>
      api<DoubtThreadData>(`${endpoint}/replies`, { method: 'POST', body: { body: reply } }),
    onSuccess: (thread) => {
      onSaved(thread);
      setReply('');
      toast.success('Reply sent');
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'The reply could not be sent'),
  });
  const setStatus = useMutation({
    mutationFn: (status: 'open' | 'resolved') =>
      api<DoubtThreadData>(`${endpoint}/status`, { method: 'POST', body: { status } }),
    onSuccess: (thread) => {
      onSaved(thread);
      toast.success(thread.status === 'resolved' ? 'Marked resolved' : 'Reopened');
    },
    onError: (error: Error) => toast.error(isApiError(error) ? error.message : 'That did not work'),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const doubt = query.data;
  const resolved = doubt.status === 'resolved';
  const about = doubt.lesson?.title ?? doubt.course?.title ?? null;

  return (
    <>
      <PageHeader
        back={back}
        eyebrow={
          role === 'staff'
            ? `${doubt.student.name} · ${doubt.student.batchCodes.join(', ') || doubt.student.studentCode}`
            : 'Your doubt'
        }
        title={doubt.title}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={doubt.status}
              label={DOUBT_STATUS_LABELS[doubt.status]}
              tone={DOUBT_TONE[doubt.status]}
            />
            {about ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <BookOpen className="size-3.5" aria-hidden="true" />
                {doubt.course ? (
                  <Link
                    href={
                      role === 'learner'
                        ? doubt.lesson
                          ? `/courses/${doubt.course.id}/lessons/${doubt.lesson.id}`
                          : `/courses/${doubt.course.id}`
                        : `${back.href.replace(/\/doubts$/, '')}/courses/${doubt.course.id}`
                    }
                    className="hover:text-foreground hover:underline"
                  >
                    {about}
                  </Link>
                ) : (
                  about
                )}
              </span>
            ) : null}
          </div>
        }
        actions={
          doubt.canResolve ? (
            resolved ? (
              <Button
                variant="outline"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate('open')}
              >
                <RotateCcw aria-hidden="true" />
                Reopen
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate('resolved')}
              >
                <CircleCheck aria-hidden="true" />
                Mark resolved
              </Button>
            )
          ) : undefined
        }
      />

      <div className="max-w-3xl space-y-4">
        <Message
          name={role === 'learner' ? 'You' : doubt.student.name}
          person={doubt.student.name}
          staff={false}
          you={role === 'learner'}
          at={doubt.createdAt}
          body={doubt.body}
        />
        {doubt.replies.map((message) => (
          <Message
            key={message.id}
            name={message.author.isYou ? 'You' : message.author.name}
            person={message.author.name}
            staff={message.author.isStaff}
            you={message.author.isYou}
            at={message.createdAt}
            body={message.body}
          />
        ))}

        {doubt.canReply ? (
          <form
            className="rounded-xl border border-border bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (reply.trim().length === 0) return;
              send.mutate();
            }}
          >
            <Label htmlFor="reply">
              {role === 'staff' ? 'Your answer' : resolved ? 'Write again (reopens it)' : 'Reply'}
            </Label>
            <Textarea
              id="reply"
              rows={4}
              maxLength={4000}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder={
                role === 'staff'
                  ? 'Explain it the way you would in class. Code is fine.'
                  : 'Add what you tried, or say what is still unclear.'
              }
              className="mt-2"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {role === 'staff'
                  ? 'The learner is told when you answer.'
                  : 'Your trainers are told when you write.'}
              </p>
              <Button type="submit" disabled={send.isPending || reply.trim().length === 0}>
                <Send aria-hidden="true" />
                {send.isPending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </>
  );
}

function Message({
  name,
  person,
  staff,
  you,
  at,
  body,
}: {
  name: string;
  /** Whose initials to show, even when the label says "You". */
  person: string;
  staff: boolean;
  you: boolean;
  at: string;
  body: string;
}) {
  return (
    <article
      className={cn(
        'rounded-xl border px-4 py-3.5',
        staff ? 'border-info/25 bg-info-soft/40' : 'border-border bg-card',
      )}
    >
      <header className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
            staff
              ? 'bg-info-soft text-info ring-1 ring-info/30'
              : you
                ? 'bg-primary-soft text-brand'
                : 'bg-surface-2 text-foreground-secondary',
          )}
        >
          {initials(person)}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {name}
          {staff ? <span className="ml-1.5 text-xs font-normal text-info">Staff</span> : null}
        </p>
        <time dateTime={at} className="shrink-0 text-xs text-muted-foreground">
          {formatDateTime(at)}
        </time>
      </header>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground-secondary">
        {body}
      </p>
    </article>
  );
}
