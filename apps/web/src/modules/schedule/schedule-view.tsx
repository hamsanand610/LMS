'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, PlayCircle, Radio, Video } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  addDaysToDateKey,
  toLocalDateKey,
  type ScheduleDeadline,
  type SessionItem,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import {
  formatDateKey,
  formatDateRange,
  formatMonthYear,
  formatTime,
  formatTimeRange,
} from '@/lib/format';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { useCan, useMe } from '@/shell/me-context';
import { RecordingDialog } from './recording-dialog';

const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' });
const DAY = new Intl.DateTimeFormat('en-IN', { day: 'numeric', timeZone: 'UTC' });

/** Monday of the week `offset` weeks from today, counted in the institute's time zone. */
function weekOf(now: number, offset: number): { days: string[]; today: string } {
  const today = toLocalDateKey(new Date(now));
  const sinceMonday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const monday = addDaysToDateKey(today, offset * 7 - sinceMonday);
  return { days: Array.from({ length: 7 }, (_, i) => addDaysToDateKey(monday, i)), today };
}

/** The weeks that cover the month `offset` months from today, Monday first, as date keys. */
function monthOf(now: number, offset: number): { month: string; days: string[]; today: string } {
  const today = toLocalDateKey(new Date(now));
  const [year, month] = today.split('-').map(Number) as [number, number];
  const index = year * 12 + (month - 1) + offset;
  const first = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
  const nextFirst = `${Math.floor((index + 1) / 12)}-${String(((index + 1) % 12) + 1).padStart(2, '0')}-01`;
  const last = addDaysToDateKey(nextFirst, -1);
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const trail = 6 - ((new Date(`${last}T12:00:00Z`).getUTCDay() + 6) % 7);
  const start = addDaysToDateKey(first, -lead);
  const count = lead + Number(last.slice(8)) + trail;
  return {
    month: first.slice(0, 7),
    days: Array.from({ length: count }, (_, i) => addDaysToDateKey(start, i)),
    today,
  };
}

const WEEKDAY_HEADINGS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The timetable as a week agenda (the default) or a month calendar. */
export function ScheduleView() {
  const [view, setView] = useState<'week' | 'month'>('week');
  return (
    <div className="space-y-5">
      <Tabs filter value={view} onValueChange={(value) => setView(value as 'week' | 'month')}>
        <TabsList variant="segmented" aria-label="View">
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === 'week' ? <WeekView /> : <MonthView />}
    </div>
  );
}

/**
 * A month at a glance: each day with its classes, today ringed. Choosing a day lists its classes
 * in full below, with the same controls as the week view.
 */
function MonthView() {
  const canRun = useCan('sessions:run');
  const now = useNow();
  const [months, setMonths] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const grid = now === null ? null : monthOf(now, months);
  const from = grid?.days[0];
  const to = grid?.days.at(-1);
  const query = useQuery({
    queryKey: ['schedule', from, to],
    queryFn: () => api<SessionItem[]>(`/me/schedule?from=${from}&to=${to}`),
    enabled: Boolean(from && to),
  });
  const byDay = new Map<string, SessionItem[]>();
  for (const session of query.data ?? []) {
    const key = toLocalDateKey(session.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), session]);
  }
  const selected =
    picked && grid?.days.includes(picked)
      ? picked
      : grid && grid.today.startsWith(grid.month)
        ? grid.today
        : (grid?.days.find((d) => d.startsWith(grid.month) && byDay.has(d)) ?? null);
  const chosen = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {grid ? (
          <p aria-live="polite" className="text-lg font-semibold tracking-tight">
            {formatMonthYear(`${grid.month}-15T12:00:00Z`)}
          </p>
        ) : (
          <Skeleton className="h-7 w-40" />
        )}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 shadow-xs">
          <Button variant="ghost" size="sm" onClick={() => setMonths((m) => m - 1)}>
            <ChevronLeft aria-hidden="true" />
            Previous month
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonths(0)} disabled={months === 0}>
            This month
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonths((m) => m + 1)}>
            Next month
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {!grid || query.isPending ? <LoadingRows rows={5} /> : null}

      {grid && query.data ? (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-border">
            <div className="grid grid-cols-7 gap-px" aria-hidden="true">
              {WEEKDAY_HEADINGS.map((name) => (
                <div
                  key={name}
                  className="bg-surface-2 px-2 py-1.5 text-center text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
                >
                  {name}
                </div>
              ))}
            </div>
            <ol className="grid grid-cols-7 gap-px">
              {grid.days.map((day) => {
                const sessions = byDay.get(day) ?? [];
                const inMonth = day.startsWith(grid.month);
                const isToday = day === grid.today;
                const isSelected = day === selected;
                return (
                  <li key={day} className="bg-card">
                    <button
                      type="button"
                      onClick={() => setPicked(day)}
                      aria-pressed={isSelected}
                      aria-label={`${formatDateKey(day)}${isToday ? ' (today)' : ''}: ${
                        sessions.length === 0
                          ? 'no classes'
                          : `${sessions.length} ${sessions.length === 1 ? 'class' : 'classes'}`
                      }`}
                      className={cn(
                        'flex h-full min-h-16 w-full flex-col items-start gap-1 p-1.5 text-left transition-colors outline-none hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset sm:min-h-24 sm:p-2',
                        isSelected && 'bg-primary-soft/50',
                        !inMonth && 'opacity-45',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums',
                          isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
                        )}
                      >
                        {Number(day.slice(8))}
                      </span>
                      {/* On a phone a dot per class; wider, the first two classes by name. */}
                      <span className="flex gap-0.5 sm:hidden" aria-hidden="true">
                        {sessions.slice(0, 3).map((session) => (
                          <span
                            key={session.id}
                            className={cn(
                              'size-1.5 rounded-full',
                              session.status === 'cancelled'
                                ? 'bg-muted-foreground/40'
                                : 'bg-primary',
                            )}
                          />
                        ))}
                      </span>
                      <span className="hidden w-full flex-col gap-0.5 sm:flex" aria-hidden="true">
                        {sessions.slice(0, 2).map((session) => (
                          <span
                            key={session.id}
                            className={cn(
                              'truncate rounded px-1.5 py-0.5 text-[11px] leading-tight',
                              session.status === 'cancelled'
                                ? 'bg-surface-2 text-muted-foreground line-through'
                                : 'bg-primary-soft text-brand',
                            )}
                          >
                            {formatTime(session.startsAt)} {session.subject}
                          </span>
                        ))}
                        {sessions.length > 2 ? (
                          <span className="text-[11px] text-muted-foreground">
                            +{sessions.length - 2} more
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {selected ? (
            <section aria-labelledby="day-heading" className="space-y-3">
              <h2 id="day-heading" className="text-base font-semibold">
                {formatDateKey(selected)}
              </h2>
              {chosen.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes on this day.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {chosen.map((session) => (
                    <SessionRow key={session.id} session={session} canRun={canRun} now={now} />
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * The caller's own timetable as a week agenda: every day of the week in order, today marked, a
 * quiet line for a day without classes. Trainers also get the controls to run a class.
 * "Now" is read after hydration (useNow), so the server and the browser never disagree on the week.
 */
function WeekView() {
  const canRun = useCan('sessions:run');
  const now = useNow();
  const [weeks, setWeeks] = useState(0);
  const week = now === null ? null : weekOf(now, weeks);
  const from = week?.days[0];
  const to = week?.days[6];

  const query = useQuery({
    queryKey: ['schedule', from, to],
    queryFn: () => api<SessionItem[]>(`/me/schedule?from=${from}&to=${to}`),
    enabled: Boolean(from && to),
  });
  // A learner's week also shows what is due: assignments and test windows closing.
  const learner = useMe().person.studentId !== null;
  const deadlines = useQuery({
    queryKey: ['schedule', 'deadlines', from, to],
    queryFn: () => api<ScheduleDeadline[]>(`/me/deadlines?from=${from}&to=${to}`),
    enabled: learner && Boolean(from && to),
  });

  const byDay = new Map<string, SessionItem[]>();
  for (const session of query.data ?? []) {
    const key = toLocalDateKey(session.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), session]);
  }
  const dueByDay = new Map<string, ScheduleDeadline[]>();
  for (const deadline of deadlines.data ?? []) {
    const key = toLocalDateKey(deadline.at);
    dueByDay.set(key, [...(dueByDay.get(key) ?? []), deadline]);
  }
  const anything = (query.data?.length ?? 0) + (deadlines.data?.length ?? 0) > 0;
  // "Nothing this week" also promises nothing is due, so it waits for the deadlines to answer.
  const dueUnknown = deadlines.isLoading || deadlines.isError;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          {week && from && to ? (
            <p
              data-week-range=""
              aria-live="polite"
              className="text-lg font-semibold tracking-tight tabular-nums"
            >
              {formatDateRange(`${from}T12:00:00Z`, `${to}T12:00:00Z`)}
            </p>
          ) : (
            <Skeleton className="h-7 w-44" />
          )}
          {weeks === 0 ? (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-brand">
              This week
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 shadow-xs">
          <Button variant="ghost" size="sm" onClick={() => setWeeks((w) => w - 1)}>
            <ChevronLeft aria-hidden="true" />
            Previous week
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeeks(0)} disabled={weeks === 0}>
            This week
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeeks((w) => w + 1)}>
            Next week
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {deadlines.isError && !query.isError ? (
        <ErrorState
          error={deadlines.error}
          message="What is due this week could not be loaded."
          onRetry={() => void deadlines.refetch()}
        />
      ) : null}
      {!week || query.isPending || (deadlines.isLoading && !anything) ? (
        <LoadingRows rows={5} />
      ) : null}

      {week && query.data && !anything && !dueUnknown ? (
        <EmptyState
          title="Nothing this week"
          description="No classes, and nothing due. Your timetable fills in as your institute schedules classes for your batch. Try the next week."
        />
      ) : null}

      {week && query.data && (anything || deadlines.isError) ? (
        <ol className="overflow-hidden rounded-xl border border-border bg-card">
          {week.days.map((day) => {
            const sessions = byDay.get(day) ?? [];
            const due = dueByDay.get(day) ?? [];
            const isToday = day === week.today;
            const noon = new Date(`${day}T12:00:00Z`);
            return (
              <li
                key={day}
                aria-label={formatDateKey(day)}
                className={cn(
                  'grid grid-cols-[4.5rem_1fr] gap-4 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[5.5rem_1fr] sm:px-5',
                  isToday && 'bg-primary-soft/40',
                )}
              >
                <div className="flex flex-col items-start pt-0.5">
                  <span
                    className={cn(
                      'text-[11px] font-semibold tracking-[0.08em] uppercase',
                      isToday ? 'text-brand' : 'text-muted-foreground',
                    )}
                  >
                    {isToday ? 'Today' : WEEKDAY.format(noon)}
                  </span>
                  <span
                    className={cn(
                      'text-2xl leading-tight font-semibold tabular-nums',
                      isToday ? 'text-brand' : 'text-foreground',
                    )}
                  >
                    {DAY.format(noon)}
                  </span>
                </div>
                {sessions.length === 0 && due.length === 0 ? (
                  <p className="self-center text-sm text-muted-foreground">No classes</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {sessions.map((session) => (
                      <SessionRow key={session.id} session={session} canRun={canRun} now={now} />
                    ))}
                    {due.map((deadline) => (
                      <DeadlineRow key={`${deadline.kind}-${deadline.id}`} deadline={deadline} />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

/**
 * Where a class stands by the clock: a stored status of "scheduled" does not keep a finished class
 * looking ahead, nor does "live" start a class before its time.
 */
function phaseOf(
  session: SessionItem,
  now: number | null,
): 'live' | 'soon' | 'finished' | 'ahead' | 'cancelled' {
  if (session.status === 'cancelled') return 'cancelled';
  if (now === null) return session.status === 'live' ? 'live' : 'ahead';
  const start = Date.parse(session.startsAt);
  const end = Date.parse(session.endsAt);
  if (now > end || session.status === 'completed') return 'finished';
  if (now >= start) return 'live';
  return session.joinable ? 'soon' : 'ahead';
}

/** A date that is not a class: work due, or a test window closing. */
function DeadlineRow({ deadline }: { deadline: ScheduleDeadline }) {
  return (
    <Link
      href={deadline.link}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-dashed border-border-strong bg-surface-2/40 px-4 py-2.5 text-sm transition-colors hover:bg-surface-2"
    >
      <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
        {deadline.kind === 'test' ? 'Closes' : 'Due'} {formatTime(deadline.at)}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{deadline.title}</span>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[11.5px] font-medium',
          deadline.done ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning',
        )}
      >
        {deadline.done
          ? deadline.kind === 'test'
            ? 'Sat'
            : 'Handed in'
          : deadline.kind === 'test'
            ? 'Test window'
            : 'Assignment due'}
      </span>
    </Link>
  );
}

export function SessionRow({
  session,
  canRun,
  now = null,
}: {
  session: SessionItem;
  canRun: boolean;
  now?: number | null;
}) {
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
  const phase = phaseOf(session, now);
  const live = phase === 'live';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border px-4 py-3 transition-colors',
        live
          ? 'border-primary-muted bg-surface'
          : 'border-border bg-surface hover:border-border-strong',
      )}
    >
      <div className="w-32 shrink-0 text-sm font-medium text-foreground tabular-nums">
        {formatTimeRange(session.startsAt, session.endsAt)}
      </div>
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-semibold text-foreground">{session.title || session.subject}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[session.title ? session.subject : null, session.batchCode, session.trainerName]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {session.notes ? (
          <p className="mt-1 text-xs whitespace-pre-line text-foreground-secondary">
            {session.notes}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2 py-0.5 text-[11.5px] font-medium text-brand">
            <Radio className="size-3" aria-hidden="true" />
            Live now
          </span>
        ) : phase === 'soon' ? (
          <StatusBadge status="scheduled" label="Starting soon" />
        ) : phase === 'finished' ? (
          <StatusBadge status="completed" label="Finished" />
        ) : (
          <StatusBadge status={session.status} />
        )}
        {session.recordingLessonId && session.recordingCourseId ? (
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/courses/${session.recordingCourseId}/lessons/${session.recordingLessonId}`}
            >
              <PlayCircle aria-hidden="true" />
              Recording
            </Link>
          </Button>
        ) : null}
        {session.joinable ? (
          <Button size="sm" asChild>
            <a href={session.joinUrl} target="_blank" rel="noopener noreferrer">
              <Video aria-hidden="true" />
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
    </div>
  );
}
