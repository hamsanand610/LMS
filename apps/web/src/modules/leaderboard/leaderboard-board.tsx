'use client';

import { useQuery } from '@tanstack/react-query';
import { Info, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  LEADERBOARD_PERIODS,
  LEADERBOARD_PERIOD_LABELS,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  type LeaderboardResponse,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { formatDateKey, formatNumber, plural } from '@/lib/format';
import { cn } from '@/lib/utils';

export function useLeaderboard(period: LeaderboardPeriod, batchId?: string, limit = 50) {
  const params = new URLSearchParams({ period, limit: String(limit) });
  if (batchId) params.set('batchId', batchId);
  return useQuery({
    queryKey: ['leaderboard', params.toString()],
    queryFn: () => api<LeaderboardResponse>(`/leaderboard?${params.toString()}`),
  });
}

/** Gold, then quieter golds: a podium, not a race-game trophy wall. */
const PODIUM_TONE = [
  'bg-achievement text-card shadow-[0_0_0_3px_var(--achievement-soft)]',
  'bg-achievement-soft text-achievement ring-1 ring-achievement/35 ring-inset',
  'bg-achievement-soft/70 text-achievement ring-1 ring-achievement/20 ring-inset',
];

function Initials({ entry, className }: { entry: LeaderboardEntry; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-foreground-secondary',
        entry.isYou && 'bg-achievement-soft text-achievement',
        className,
      )}
    >
      {entry.initials}
    </span>
  );
}

function Breakdown({ entry }: { entry: LeaderboardEntry }) {
  const parts = [
    ['Lessons', entry.breakdown.lessons],
    ['Practice', entry.breakdown.practice],
    ['Assignments', entry.breakdown.assignments],
    ['Tests', entry.breakdown.tests],
  ] as const;
  return (
    <span className="text-xs text-muted-foreground">
      {parts
        .filter(([, value]) => value > 0)
        .map(([label, value]) => `${label} ${formatNumber(value)}`)
        .join(' · ') || 'No points yet in this period'}
    </span>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  return (
    <li
      aria-current={entry.isYou ? 'true' : undefined}
      className={cn(
        'relative flex items-center gap-3 px-4 py-3',
        entry.isYou && 'bg-achievement-soft/45',
      )}
    >
      {entry.isYou ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-achievement"
        />
      ) : null}
      <span
        className={cn(
          'w-8 shrink-0 text-center text-sm font-semibold tabular-nums',
          entry.rank <= 3 ? 'text-achievement' : 'text-muted-foreground',
        )}
      >
        {entry.rank}
      </span>
      <Initials entry={entry} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">
          {entry.displayName}
          {entry.isYou ? (
            <span className="ml-1.5 text-xs font-semibold text-achievement">You</span>
          ) : null}
        </span>
        <Breakdown entry={entry} />
      </span>
      <span className="shrink-0 text-right">
        <span className="stat-figure block text-lg">{formatNumber(entry.points)}</span>
        <span className="block text-[11px] text-muted-foreground">points</span>
      </span>
    </li>
  );
}

/** The top three, side by side on wide screens; the rest of the board follows as a ranked list. */
function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const top = entries.slice(0, 3).filter((e) => e.points > 0);
  if (top.length === 0) return null;
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Top of the board">
      {top.map((entry, index) => (
        <li
          key={entry.studentId}
          className={cn(
            'relative isolate flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-xs',
            index === 0 && 'sm:py-5',
            entry.isYou && 'border-achievement/40',
          )}
        >
          {index === 0 ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(20rem 10rem at 100% 0%, color-mix(in oklab, var(--achievement) 16%, transparent), transparent 70%)',
              }}
            />
          ) : null}
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
              PODIUM_TONE[index],
            )}
          >
            {entry.rank}
            <span className="sr-only"> place</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-foreground">
              {entry.displayName}
              {entry.isYou ? <span className="ml-1.5 text-xs text-achievement">You</span> : null}
            </span>
            <span className="block text-sm text-muted-foreground tabular-nums">
              {formatNumber(entry.points)} points
            </span>
          </span>
          {index === 0 ? (
            <Trophy className="size-5 shrink-0 text-achievement" aria-hidden="true" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * The points board for one batch. A learner sees their own batch; staff pick among the batches
 * their scope reaches. Names are short (first name and an initial) for everybody.
 */
export function LeaderboardBoard({ staff = false }: { staff?: boolean }) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const [batchId, setBatchId] = useState<string | undefined>(undefined);
  const query = useLeaderboard(period, batchId);
  const data = query.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          filter
          value={period}
          onValueChange={(value) => setPeriod(value as LeaderboardPeriod)}
        >
          <TabsList variant="segmented" aria-label="Period">
            {LEADERBOARD_PERIODS.map((value) => (
              <TabsTrigger key={value} value={value}>
                {LEADERBOARD_PERIOD_LABELS[value]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {staff && data && data.batches.length > 1 ? (
          <Select value={data.batch?.id ?? ''} onValueChange={(value) => setBatchId(value)}>
            <SelectTrigger className="w-full sm:w-64" aria-label="Batch">
              <SelectValue placeholder="Choose a batch" />
            </SelectTrigger>
            <SelectContent>
              {data.batches.map((batch) => (
                <SelectItem key={batch.id} value={batch.id}>
                  {batch.code} · {batch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {query.isPending ? <LoadingRows rows={6} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {data && !data.batch ? (
        <EmptyState
          title="No batch to rank"
          description={
            staff
              ? 'The leaderboard ranks the learners of one batch. None is assigned to you yet.'
              : 'The leaderboard ranks the learners of your batch. You are not in one yet.'
          }
        />
      ) : null}

      {data?.batch ? (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.batch.code}</span> ·{' '}
            {plural(data.total, 'learner')} ·{' '}
            {data.from ? `since ${formatDateKey(data.from)}` : 'since the batch began'}
          </p>
          <Podium entries={data.entries} />
          <Card className="gap-0 overflow-hidden py-0">
            <ol className="divide-y divide-border" aria-label="Ranking">
              {data.entries.map((entry) => (
                <Row key={entry.studentId} entry={entry} />
              ))}
            </ol>
            {data.you ? (
              <div className="border-t-2 border-border">
                <p className="px-4 pt-3 text-xs font-medium text-muted-foreground">Your place</p>
                <ol>
                  <Row entry={data.you} />
                </ol>
              </div>
            ) : null}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="size-4 text-muted-foreground" aria-hidden="true" />
                How points are counted
              </CardTitle>
              <CardDescription>
                Everything comes from work already recorded elsewhere.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {data.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

/** The dashboard's slice of the board: the top few this week and the learner's own place. */
export function LeaderboardSnapshot({ className }: { className?: string }) {
  const query = useLeaderboard('week', undefined, 5);
  const data = query.data;
  const mine = data ? (data.entries.find((e) => e.isYou) ?? data.you) : null;
  return (
    <Card className={cn('relative isolate flex flex-col', className)}>
      {mine ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(28rem 15rem at 100% 0%, color-mix(in oklab, var(--achievement) 13%, transparent), transparent 70%)',
          }}
        />
      ) : null}
      <CardHeader>
        <CardTitle>This week’s leaderboard</CardTitle>
        <CardDescription>
          {data?.batch ? `${data.batch.code} · points since Monday` : 'Points in your batch.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {query.isPending ? <Skeleton className="h-40 rounded-lg" /> : null}
        {query.isError ? (
          <p className="text-sm text-muted-foreground">The leaderboard could not be loaded.</p>
        ) : null}
        {data && !data.batch ? (
          <p className="text-sm text-muted-foreground">You join a board when you join a batch.</p>
        ) : null}
        {data?.batch ? (
          <>
            {mine ? (
              <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-muted-foreground">
                You are{' '}
                <span className="stat-figure text-[2.5rem] text-achievement">#{mine.rank}</span> of{' '}
                {data.total} with{' '}
                <span className="font-semibold text-foreground tabular-nums">
                  {formatNumber(mine.points)}
                </span>{' '}
                points.
              </p>
            ) : null}
            <ol className="flex flex-col gap-1">
              {data.entries.slice(0, 5).map((entry) => (
                <li
                  key={entry.studentId}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2 py-1.5',
                    entry.isYou && 'bg-achievement-soft/60 ring-1 ring-achievement/25 ring-inset',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                      entry.rank <= 3
                        ? 'bg-achievement-soft text-achievement'
                        : 'text-muted-foreground',
                    )}
                  >
                    {entry.rank}
                  </span>
                  <Initials entry={entry} className="size-7 text-[11px]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {entry.displayName}
                    {entry.isYou ? (
                      <span className="ml-1 text-xs text-achievement">You</span>
                    ) : null}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatNumber(entry.points)}
                  </span>
                </li>
              ))}
            </ol>
            <Link
              href="/leaderboard"
              className="mt-auto pt-1 text-[13px] font-medium text-brand hover:underline"
            >
              The full board and how points work
            </Link>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
