'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type { SessionItem } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { useCan } from '@/shell/me-context';
import { RecordingDialog } from './recording-dialog';

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** The caller's own timetable, grouped by day. Trainers also get the controls to run a class. */
export function ScheduleView() {
  const canRun = useCan('sessions:run');
  const [weeks, setWeeks] = useState(0);
  const from = new Date();
  from.setDate(from.getDate() + weeks * 7 - from.getDay() + 1);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  const range = `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;

  const query = useQuery({
    queryKey: ['schedule', range],
    queryFn: () => api<SessionItem[]>(`/me/schedule?${range}`),
  });

  const days = new Map<string, SessionItem[]>();
  for (const session of query.data ?? []) {
    const key = dayKey(session.startsAt);
    days.set(key, [...(days.get(key) ?? []), session]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setWeeks((w) => w - 1)}>
          Previous week
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWeeks(0)} disabled={weeks === 0}>
          This week
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWeeks((w) => w + 1)}>
          Next week
        </Button>
        <span className="text-sm text-muted-foreground">
          {from.toLocaleDateString()} – {to.toLocaleDateString()}
        </span>
      </div>

      {query.isPending ? <LoadingRows rows={4} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          title="No classes this week"
          description="Your timetable fills in as your institute schedules classes for your batch."
        />
      ) : null}

      {[...days.entries()].map(([day, sessions]) => (
        <section key={day} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{day}</h2>
          <div className="space-y-2">
            {sessions.map((session) => (
              <SessionRow key={session.id} session={session} canRun={canRun} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function SessionRow({ session, canRun }: { session: SessionItem; canRun: boolean }) {
  const queryClient = useQueryClient();
  const setStatus = useMutation({
    mutationFn: (status: string) =>
      api<SessionItem>(`/sessions/${session.id}/status`, { method: 'POST', body: { status } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule'] });
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Class updated');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The class could not be updated'),
  });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
      <div className="w-28 shrink-0 text-sm tabular-nums">
        {time(session.startsAt)} – {time(session.endsAt)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{session.title || session.subject}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[session.batchCode, session.trainerName].filter(Boolean).join(' · ')}
        </p>
      </div>
      <StatusBadge status={session.status} />
      {session.recordingLessonId && session.recordingCourseId ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/courses/${session.recordingCourseId}/lessons/${session.recordingLessonId}`}>
            Recording
          </Link>
        </Button>
      ) : null}
      {session.joinable ? (
        <Button size="sm" asChild>
          <a href={session.joinUrl} target="_blank" rel="noopener noreferrer">
            Join
          </a>
        </Button>
      ) : null}
      {canRun && session.status === 'scheduled' ? (
        <Button
          variant="outline"
          size="sm"
          disabled={setStatus.isPending}
          onClick={() => setStatus.mutate('completed')}
        >
          Mark taught
        </Button>
      ) : null}
      {canRun && session.status === 'completed' && !session.recordingLessonId ? (
        <RecordingDialog sessionId={session.id} subject={session.subject} />
      ) : null}
    </div>
  );
}
