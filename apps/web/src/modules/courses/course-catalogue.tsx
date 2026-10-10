'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toLocalDateKey, type CourseProgress, type SessionItem } from '@lms/shared';
import { EmptyState, ErrorState } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsCount, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { formatTimeRange } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { CourseCard } from './course-card';

export { CourseCard } from './course-card';

type Filter = 'all' | 'in_progress' | 'not_started' | 'completed';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'not_started', label: 'Not started' },
  { value: 'completed', label: 'Completed' },
];

function statusOf(course: CourseProgress): Exclude<Filter, 'all'> {
  if (course.status === 'completed' || course.progressPct >= 100) return 'completed';
  return course.progressPct > 0 || course.status === 'in_progress' ? 'in_progress' : 'not_started';
}

/** Today's next live class, if any: the bridge between recorded courses and the timetable. */
function LiveStrip() {
  const now = useNow();
  const today = now === null ? null : toLocalDateKey(new Date(now));
  const query = useQuery({
    queryKey: ['schedule', today, today],
    queryFn: () => api<SessionItem[]>(`/me/schedule?from=${today}&to=${today}`),
    enabled: Boolean(today),
  });
  const next = (query.data ?? []).find(
    (s) =>
      s.status !== 'completed' && s.status !== 'cancelled' && Date.parse(s.endsAt) > (now ?? 0),
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <CalendarClock className="size-4 shrink-0 text-brand" aria-hidden="true" />
      {query.isPending || !today ? (
        <Skeleton className="h-4 w-56" />
      ) : next ? (
        <p className="min-w-0 flex-1">
          <span className="font-medium text-foreground">{next.title || next.subject}</span>
          <span className="text-muted-foreground">
            {' '}
            · today, {formatTimeRange(next.startsAt, next.endsAt)}
          </span>
        </p>
      ) : query.isError ? (
        <p className="min-w-0 flex-1 text-muted-foreground" role="alert">
          Today’s live classes could not be loaded.{' '}
          <Button variant="link" className="h-auto p-0" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </p>
      ) : (
        <p className="min-w-0 flex-1 text-muted-foreground">No more live classes today.</p>
      )}
      <Link
        href="/schedule"
        className="group/s inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline"
      >
        View schedule
        <ArrowRight
          className="size-3.5 transition-transform group-hover/s:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}

/** The learner's own courses, ordered by what they touched last, filterable by status. */
export function CourseCatalogue() {
  const [filter, setFilter] = useState<Filter>('all');
  const [term, setTerm] = useState('');
  const query = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => api<CourseProgress[]>('/me/courses'),
  });

  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const courses = query.data ?? [];
  const counts: Record<Filter, number> = {
    all: courses.length,
    in_progress: 0,
    not_started: 0,
    completed: 0,
  };
  for (const course of courses) counts[statusOf(course)] += 1;
  const needle = term.trim().toLowerCase();
  const shown = courses.filter(
    (c) =>
      (filter === 'all' || statusOf(c) === filter) &&
      (!needle || `${c.title} ${c.subject} ${c.level}`.toLowerCase().includes(needle)),
  );

  return (
    <div className="space-y-6">
      <LiveStrip />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs
          filter
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          className="min-w-0 flex-1"
        >
          <TabsList aria-label="Filter courses by status">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
                <TabsCount>{query.isPending ? '·' : counts[f.value]}</TabsCount>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full lg:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search your courses"
            aria-label="Search your courses"
            className="pl-9"
          />
        </div>
      </div>

      {query.isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Courses appear the moment your institute publishes one to your batch. Nothing is hidden from you here."
        />
      ) : shown.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          description={
            needle ? `No course matches “${term.trim()}”.` : 'No course is in this state yet.'
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((course) => (
            <CourseCard key={course.courseId} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
