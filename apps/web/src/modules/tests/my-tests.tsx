'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, Clock, FileText, Hash, RotateCcw, Timer } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { TestCard } from '@lms/shared';
import { EmptyState, ErrorState } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import {
  daysFrom,
  formatDate,
  formatDateTime,
  formatRelativeDay,
  formatTime,
  humanise,
} from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { useModuleOn } from '@/shell/me-context';

/** When the window opens or closes, in words once the clock is known. */
function windowText(test: TestCard, now: number | null): string {
  const at = test.window === 'upcoming' ? test.opensAt : test.closesAt;
  if (test.window === 'closed') return `Closed ${formatDate(test.closesAt)}`;
  const verb = test.window === 'upcoming' ? 'Opens' : 'Closes';
  if (now === null) return `${verb} ${formatDateTime(at)}`;
  const days = daysFrom(now, at);
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : formatRelativeDay(at, now);
  return `${verb} ${when}, ${formatTime(at)}`;
}

/** Upcoming, open now, and everything already sat. */
export function MyTests() {
  const now = useNow();
  const labsOn = useModuleOn('practice');
  const [tab, setTab] = useState('live');
  const query = useQuery({
    queryKey: ['my-tests'],
    queryFn: () => api<TestCard[]>('/me/tests'),
  });

  if (query.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <span className="sr-only">Loading…</span>
        <Skeleton className="h-11 w-96 max-w-full" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-60 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  // Open now: what this learner can start or resume. A test whose attempts are used up (submitted,
  // marked or abandoned) is listed under "Already sat" only, even while its window is open.
  const live = query.data.filter(
    (t) => t.window === 'live' && (t.canStart || t.attemptStatus === 'in_progress'),
  );
  const upcoming = query.data.filter((t) => t.window === 'upcoming');
  const history = query.data.filter(
    (t) => t.window === 'closed' || (t.attemptStatus && t.attemptStatus !== 'in_progress'),
  );
  const groups: Array<{ key: string; label: string; cards: TestCard[] }> = [
    { key: 'live', label: 'Open now', cards: live },
    { key: 'upcoming', label: 'Coming up', cards: upcoming },
    { key: 'history', label: 'Already sat', cards: history },
  ];

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList aria-label="Tests by when they are open">
        {groups.map((g) => (
          <TabsTrigger key={g.key} value={g.key}>
            {g.label}
            <TabsCount>{g.cards.length}</TabsCount>
          </TabsTrigger>
        ))}
      </TabsList>
      {groups.map(({ key, cards }) => (
        <TabsContent key={key} value={key}>
          {cards.length === 0 ? (
            <EmptyState
              title={
                key === 'live'
                  ? 'Nothing open at the moment'
                  : key === 'upcoming'
                    ? 'Nothing scheduled yet'
                    : 'You have not sat a test yet'
              }
              description={
                key === 'live' && labsOn
                  ? 'Your trainer opens a test to your batch for a window of time. Keep your hand in with a lab meanwhile.'
                  : 'Your trainer opens a test to your batch for a window of time.'
              }
              action={
                key === 'live' && labsOn ? (
                  <Button asChild variant="outline">
                    <Link href="/labs">Try a lab</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((test) => (
                <TestCardView key={test.scheduleId} test={test} now={now} />
              ))}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function TestCardView({ test, now }: { test: TestCard; now: number | null }) {
  const live = test.window === 'live';
  const scored = test.resultAvailable && test.score !== null;
  const pct =
    scored && test.totalMarks > 0 ? Math.round(((test.score ?? 0) / test.totalMarks) * 100) : null;
  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-xl border bg-card p-5 transition-[border-color,box-shadow] duration-200 hover:shadow-sm',
        live && test.canStart ? 'border-primary-muted' : 'border-border hover:border-border-strong',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow truncate">
            {[humanise(test.kind), test.subject && humanise(test.subject)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <h3 className="mt-1.5 text-base leading-snug font-semibold text-foreground">
            {test.title}
          </h3>
        </div>
        {live ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-soft px-2 py-0.5 text-[11.5px] font-medium text-brand">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            Open
          </span>
        ) : (
          <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <dl className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-foreground-secondary">
        <div className="flex items-center gap-1.5">
          <Timer className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <dt className="sr-only">Duration</dt>
          <dd className="tabular-nums">{test.durationMinutes} min</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Hash className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <dt className="sr-only">Marks</dt>
          <dd className="tabular-nums">{test.totalMarks} marks</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <RotateCcw className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <dt className="sr-only">Attempts</dt>
          <dd className="tabular-nums">
            {test.attemptsUsed} of {test.maxAttempts}{' '}
            {test.maxAttempts === 1 ? 'attempt' : 'attempts'}
          </dd>
        </div>
      </dl>

      <p
        className={cn(
          'flex items-center gap-1.5 text-xs',
          live ? 'font-medium text-foreground-secondary' : 'text-muted-foreground',
        )}
      >
        {live ? (
          <Clock className="size-3.5" aria-hidden="true" />
        ) : (
          <CalendarClock className="size-3.5" aria-hidden="true" />
        )}
        {windowText(test, now)}
      </p>

      {scored ? (
        <div className="space-y-1.5 rounded-lg bg-surface-2/60 px-3 py-2.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-foreground-secondary">
              You scored{' '}
              <span className="font-semibold text-foreground tabular-nums">{test.score}</span> of{' '}
              {test.totalMarks}
            </span>
            {pct !== null ? <span className="font-semibold tabular-nums">{pct}%</span> : null}
          </div>
          {pct !== null ? (
            <Progress value={pct} tone="achievement" aria-label={`${pct}% scored`} />
          ) : null}
        </div>
      ) : test.attemptStatus === 'submitted' || test.attemptStatus === 'graded' ? (
        <p className="rounded-lg bg-info-soft px-3 py-2 text-xs font-medium text-info">
          Submitted; results not out yet
        </p>
      ) : null}

      <div className="mt-auto">
        {test.canStart ? (
          <Button asChild className="w-full">
            <Link href={`/tests/${test.testId}`}>
              {test.attemptStatus === 'in_progress' ? 'Carry on' : 'Start'}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : test.resultAvailable && test.attemptId ? (
          <Button asChild variant="outline" className="w-full">
            <Link href={`/tests/${test.testId}/result`}>See the result</Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            {test.window === 'upcoming'
              ? 'You can start once it opens.'
              : test.attemptsUsed >= test.maxAttempts
                ? 'You have used your attempt.'
                : 'This window has closed.'}
          </p>
        )}
      </div>
    </article>
  );
}
