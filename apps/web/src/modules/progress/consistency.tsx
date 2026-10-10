'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Check, Flame, Info } from 'lucide-react';
import {
  weekdayOfDateKey,
  type ActivityDay,
  type AdherenceDayStatus,
  type LearningConsistency,
} from '@lms/shared';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/http';
import { formatDateKey, formatDateKeyShort, formatDateKeyWeekday, plural } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The learner's streak and adherence, or a trainer's view of one learner's (`/students/:id/consistency`). */
export function useConsistency(path = '/me/consistency') {
  return useQuery({
    queryKey: ['consistency', path],
    queryFn: () => api<LearningConsistency>(path),
  });
}

const WEEKDAY_LETTER: Record<string, string> = {
  mon: 'M',
  tue: 'T',
  wed: 'W',
  thu: 'T',
  fri: 'F',
  sat: 'S',
  sun: 'S',
};

const ADHERENCE: Record<AdherenceDayStatus, { label: string; tone: StatusTone; swatch: string }> = {
  met: { label: 'Met', tone: 'success', swatch: 'bg-success' },
  partial: { label: 'Partly met', tone: 'warning', swatch: 'bg-warning' },
  missed: { label: 'Missed', tone: 'danger', swatch: 'bg-danger' },
};

/** A soft light in a semantic colour from one corner of a card (the streak's emerald, the rank's gold). */
export function CardGlow({ colour, at = '0% 0%' }: { colour: string; at?: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background: `radial-gradient(28rem 15rem at ${at}, color-mix(in oklab, ${colour} 14%, transparent), transparent 70%)`,
      }}
    />
  );
}

/** Days in a row with learning activity, the best run, and the last seven days at a glance. */
export function StreakCard({
  data,
  className,
  self = true,
}: {
  data: LearningConsistency;
  className?: string;
  /** Written to the learner ("you") or about them (a trainer's view). */
  self?: boolean;
}) {
  const { streak, practiceStreak } = data;
  const week = streak.days.slice(-7);
  const prompt = streak.activeToday
    ? self
      ? 'Today already counts. Anything more is a bonus.'
      : 'Active today.'
    : streak.current > 0
      ? self
        ? 'Do one thing today — a lesson, an answer or a problem — to keep it going.'
        : 'Not active yet today.'
      : self
        ? 'Complete a lesson, submit an answer or solve a problem to start a streak.'
        : 'No current streak.';
  const alive = streak.current > 0;
  return (
    <Card className={cn('relative isolate flex flex-col', className)}>
      {alive ? <CardGlow colour="var(--streak)" /> : null}
      <CardHeader>
        <CardTitle>Learning streak</CardTitle>
        <CardDescription>Days in a row with learning activity.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2.5">
              <span className="stat-figure text-[3.25rem] text-foreground">{streak.current}</span>
              <span className="flex flex-col">
                <Flame
                  aria-hidden="true"
                  className={cn(
                    'size-5',
                    alive
                      ? 'fill-streak/20 text-streak drop-shadow-[0_0_6px_color-mix(in_oklab,var(--streak)_55%,transparent)]'
                      : 'text-muted-foreground',
                  )}
                />
                <span className="text-sm text-muted-foreground">
                  {streak.current === 1 ? 'day' : 'days'}
                </span>
              </span>
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{prompt}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground">Best</p>
            <p className="stat-figure mt-1 text-xl">{streak.longest}</p>
          </div>
        </div>

        <ol className="grid grid-cols-7 gap-1.5" aria-label="The last seven days">
          {week.map((day, index) => {
            const active = day.count > 0;
            const isToday = index === week.length - 1;
            return (
              <li key={day.date} className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'text-[11px] font-medium',
                    isToday ? 'text-foreground' : 'text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  {WEEKDAY_LETTER[weekdayOfDateKey(day.date)]}
                </span>
                <span
                  className={cn(
                    'flex aspect-square w-full max-w-8 items-center justify-center rounded-full text-xs transition-colors',
                    active
                      ? 'bg-streak text-card shadow-[0_0_0_3px_var(--streak-soft)]'
                      : isToday
                        ? 'border border-dashed border-streak/60 text-muted-foreground'
                        : 'bg-surface-2 text-muted-foreground',
                  )}
                >
                  {active ? (
                    <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                  ) : null}
                  <span className="sr-only">
                    {`${formatDateKeyWeekday(day.date)}${isToday ? ' (today)' : ''}: ${
                      active ? plural(day.count, 'activity', 'activities') : 'no activity'
                    }`}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>Coding practice streak</span>
          <span>
            <span className="font-semibold text-foreground tabular-nums">
              {plural(practiceStreak.current, 'day')}
            </span>{' '}
            · best {plural(practiceStreak.longest, 'day')}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

/** How often the learner kept the class-day routine: attend the day's classes and do some learning. */
export function AdherenceCard({
  data,
  className,
  self = true,
}: {
  data: LearningConsistency;
  className?: string;
  self?: boolean;
}) {
  const { adherence } = data;
  const { today } = adherence;
  const total = adherence.measuredDays;
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <CardTitle>Class-day adherence</CardTitle>
        <CardDescription>On a day with classes: attend them and do some learning.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="stat-figure text-[3.25rem] text-foreground">
              {adherence.percentage === null ? '—' : adherence.percentage}
              {adherence.percentage === null ? null : (
                <span className="ml-0.5 text-[0.45em] font-medium text-muted-foreground">%</span>
              )}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {total > 0
                ? `${adherence.metDays} of ${plural(total, 'class day')} met, last ${adherence.windowDays} days`
                : 'Measured once a class of yours has been marked.'}
            </p>
          </div>
          <CalendarCheck
            className="mb-1 size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        {total > 0 ? (
          <div className="space-y-2.5">
            <div className="flex h-2 gap-[3px]" aria-hidden="true">
              {(['met', 'partial', 'missed'] as const).map((status) => {
                const count =
                  status === 'met'
                    ? adherence.metDays
                    : status === 'partial'
                      ? adherence.partialDays
                      : adherence.missedDays;
                return count > 0 ? (
                  <span
                    key={status}
                    className={cn('h-full rounded-full', ADHERENCE[status].swatch)}
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                ) : null;
              })}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <li className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-success" aria-hidden="true" />
                Met {adherence.metDays}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
                Partly met {adherence.partialDays}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-danger" aria-hidden="true" />
                Missed {adherence.missedDays}
              </li>
            </ul>
          </div>
        ) : null}

        <div className="mt-auto rounded-xl bg-surface-2/70 px-3.5 py-3 text-[13px]">
          <p className="font-medium text-foreground">Today</p>
          {today.classesScheduled === 0 ? (
            <p className="mt-0.5 text-muted-foreground">
              No class today, so today does not count either way.
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              <li>
                {plural(today.classesScheduled, 'class', 'classes')} scheduled
                {today.classesMarked > 0
                  ? ` · attended ${today.classesAttended} of ${today.classesMarked} marked`
                  : ' · not marked yet'}
              </li>
              <li>
                Learning activity:{' '}
                <span
                  className={cn(
                    'font-medium',
                    today.activityDone ? 'text-success' : 'text-foreground',
                  )}
                >
                  {today.activityDone
                    ? 'done'
                    : self
                      ? 'not yet — any lesson, answer or problem counts'
                      : 'not yet'}
                </span>
              </li>
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function level(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

const LEVEL_CLASS = [
  'bg-surface-3',
  'bg-streak/25',
  'bg-streak/45',
  'bg-streak/70',
  'bg-streak',
] as const;

const MONDAY_OFFSET: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

/** A calendar of the last weeks, one square a day, darker for more learning. Weeks run Monday first. */
export function ActivityHeatmap({ days, weeks = 26 }: { days: ActivityDay[]; weeks?: number }) {
  if (days.length === 0) return null;
  const last = days.at(-1)!;
  // Whole weeks ending with the current one, so every column is Monday → Sunday.
  const trailing = 6 - (MONDAY_OFFSET[weekdayOfDateKey(last.date)] ?? 6);
  const span = weeks * 7 - trailing;
  const shown = days.slice(-span);
  const lead = Math.max(0, span - shown.length);
  const cells: (ActivityDay | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...shown,
    ...Array.from({ length: trailing }, () => null),
  ];
  const active = shown.filter((d) => d.count > 0).length;
  const first = shown[0]!;
  return (
    <figure className="space-y-3">
      {/* On a phone the calendar scrolls sideways; keyboard users scroll it once it has focus. */}
      <div
        tabIndex={0}
        role="group"
        aria-label="Activity calendar"
        className="overflow-x-auto rounded-sm pb-1 outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <div
          role="img"
          aria-label={`Learning activity from ${formatDateKey(first.date)} to ${formatDateKey(last.date)}: ${plural(active, 'active day')}.`}
          className="grid w-max grid-flow-col grid-rows-7 gap-[3px]"
        >
          {cells.map((day, index) =>
            day ? (
              <span
                key={day.date}
                title={`${formatDateKeyWeekday(day.date)}: ${day.count > 0 ? plural(day.count, 'activity', 'activities') : 'no activity'}`}
                className={cn('size-3 rounded-[3px]', LEVEL_CLASS[level(day.count)])}
              />
            ) : (
              <span key={`pad-${index}`} className="size-3" />
            ),
          )}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {formatDateKeyShort(first.date)} – {formatDateKeyShort(last.date)} ·{' '}
          {plural(active, 'active day')}
        </span>
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          Less
          {LEVEL_CLASS.map((cls) => (
            <span key={cls} className={cn('size-3 rounded-[3px]', cls)} />
          ))}
          More
        </span>
      </figcaption>
    </figure>
  );
}

/** The last measured class days, newest first, each with what happened. */
export function AdherenceDays({ data, limit = 10 }: { data: LearningConsistency; limit?: number }) {
  const days = data.adherence.days.slice(0, limit);
  if (days.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No class day has been measured yet: a day counts once its classes are marked.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {days.map((day) => (
        <li key={day.date} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
          <span className="w-28 shrink-0 font-medium tabular-nums">
            {formatDateKeyWeekday(day.date)}
          </span>
          <StatusBadge
            status={day.status}
            label={ADHERENCE[day.status].label}
            tone={ADHERENCE[day.status].tone}
          />
          <span className="text-muted-foreground">
            Attended {day.classesAttended} of {plural(day.classesMarked, 'class', 'classes')} ·{' '}
            {plural(day.activities, 'activity', 'activities')}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The rules behind the figures, in words, next to the figures. */
export function ConsistencyRules({ data }: { data: LearningConsistency }) {
  return (
    <details className="group rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <Info className="size-4 text-muted-foreground" aria-hidden="true" />
        How the streak and adherence are counted
      </summary>
      <div className="mt-3 space-y-3 text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">Learning activity is any of:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {data.definitions.activity.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
        <p>
          <span className="font-medium text-foreground">Streak. </span>
          {data.definitions.streak}
        </p>
        <p>
          <span className="font-medium text-foreground">Adherence. </span>
          {data.definitions.adherence}
        </p>
      </div>
    </details>
  );
}

/**
 * Streak, adherence, the activity calendar and the day-by-day record, with the rules beside them.
 * `path` is `/me/consistency` for the learner, `/students/:id/consistency` for staff.
 */
export function ConsistencySection({
  path = '/me/consistency',
  self = true,
}: {
  path?: string;
  self?: boolean;
}) {
  const query = useConsistency(path);
  if (query.isPending) {
    return (
      <div className="grid gap-5 md:grid-cols-2" aria-busy="true">
        <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
      </div>
    );
  }
  if (query.isError) {
    // A secondary section: a quiet line with a retry, not a page-sized alarm.
    return (
      <p className="text-sm text-muted-foreground" role="alert">
        The learning habits could not be loaded.{' '}
        <Button variant="link" className="h-auto p-0" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </p>
    );
  }
  const data = query.data;
  return (
    <section aria-labelledby="habits-heading" className="space-y-5">
      <div>
        <h2 id="habits-heading" className="text-base font-semibold tracking-[-0.005em]">
          Learning habits
        </h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {self
            ? 'How regularly you learn, counted from what you actually did.'
            : 'How regularly this learner works, counted from recorded activity.'}
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <StreakCard data={data} self={self} />
        <AdherenceCard data={data} self={self} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Activity calendar</CardTitle>
            <CardDescription>
              {plural(data.streak.activeDays, 'active day')} in the last year · last active{' '}
              {data.streak.lastActiveOn ? formatDateKey(data.streak.lastActiveOn) : 'never'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityHeatmap days={data.streak.days} weeks={26} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent class days</CardTitle>
            <CardDescription>
              Newest first. A day counts once its classes are marked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdherenceDays data={data} limit={8} />
          </CardContent>
        </Card>
      </div>
      <ConsistencyRules data={data} />
    </section>
  );
}
