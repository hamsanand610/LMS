'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock, FilterX } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import {
  LEARNER_ASSIGNMENT_SORTS,
  type FacetCount,
  type LearnerAssignmentList,
  type LearnerAssignmentRow,
  type LearnerAssignmentSort,
} from '@lms/shared';
import { OverviewBand } from '@/components/overview-band';
import { EmptyState, ErrorState } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { TechMark } from '@/components/tech-mark';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/http';
import { daysFrom, formatDate, formatRelativeDay, plural } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { useModuleOn } from '@/shell/me-context';
import { AssignmentStatusBadge, KindLabel } from './status';
import { useUrlState } from './use-url-state';

const PAGE_SIZE = 12;
const FILTERS = [
  'q',
  'status',
  'technology',
  'kind',
  'level',
  'courseId',
  'topic',
  'sort',
  'page',
] as const;

const SORT_LABELS: Record<LearnerAssignmentSort, string> = {
  due: 'Due date',
  recent: 'Recently worked on',
  title: 'Title',
  progress: 'Progress',
};

/** "Due tomorrow" with a tone for how close it is; the date alone until the clock is known. */
export function DueLabel({
  row,
  now,
  className,
}: {
  row: Pick<LearnerAssignmentRow, 'dueAt' | 'opensAt' | 'status' | 'closesAt'>;
  now: number | null;
  className?: string;
}) {
  if (row.status === 'upcoming' && row.opensAt) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-xs text-achievement', className)}>
        <Clock className="size-3.5" aria-hidden="true" />
        Opens {now === null ? formatDate(row.opensAt) : formatRelativeDay(row.opensAt, now)}
      </span>
    );
  }
  if (!row.dueAt) {
    return <span className={cn('text-xs text-muted-foreground', className)}>No due date</span>;
  }
  const finished = ['completed', 'passed', 'failed', 'submitted'].includes(row.status);
  const days = now === null ? null : daysFrom(now, row.dueAt);
  const tone = finished
    ? 'text-muted-foreground'
    : row.status === 'overdue' || row.status === 'locked'
      ? 'text-danger'
      : days !== null && days <= 2
        ? 'text-warning'
        : 'text-muted-foreground';
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', tone, className)}>
      <Clock className="size-3.5" aria-hidden="true" />
      {days !== null && days < 0 ? 'Was due ' : 'Due '}
      {days === null
        ? formatDate(row.dueAt)
        : `${formatRelativeDay(row.dueAt, now!)} · ${formatDate(row.dueAt)}`}
    </span>
  );
}

function FacetSelect({
  label,
  value,
  options,
  onChange,
  allLabel,
}: {
  label: string;
  value: string;
  options: FacetCount[];
  onChange: (value: string) => void;
  allLabel: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label} ({option.count})
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

function actionLabel(row: LearnerAssignmentRow): string {
  if (row.status === 'upcoming' || row.status === 'locked') return 'View';
  if (['completed', 'passed', 'failed', 'submitted'].includes(row.status)) return 'Review';
  return row.answered === 0 ? 'Start' : 'Continue';
}

function AssignmentRow({ row, now }: { row: LearnerAssignmentRow; now: number | null }) {
  const href = `/assignments/${row.id}`;
  const cta =
    row.next && !['upcoming', 'locked'].includes(row.status)
      ? `/assignments/${row.id}/q/${row.next.placementId}`
      : href;
  return (
    <li className="group/row relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:bg-surface-2/50 sm:px-5 lg:grid-cols-[auto_minmax(0,1fr)_8.5rem_10rem_10rem_auto] lg:items-center">
      <TechMark technology={row.technology} label={row.technology || 'General'} />
      <div className="min-w-0">
        <h3 className="text-[15px] leading-snug font-semibold text-foreground">
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-inset"
          >
            {row.title}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          <KindLabel kind={row.kind} />
          <span aria-hidden="true">·</span>
          <span>{plural(row.questionCount, 'question')}</span>
          {row.courseTitle ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{row.courseTitle}</span>
            </>
          ) : null}
          {row.estimatedMinutes > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                About {Math.round(row.estimatedMinutes / 5) * 5 || row.estimatedMinutes} min
              </span>
            </>
          ) : null}
        </p>
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2 lg:col-span-1 lg:contents">
        <div className="lg:justify-self-start">
          <AssignmentStatusBadge status={row.status} />
        </div>
        <div className="min-w-32 flex-1 lg:flex-none">
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground tabular-nums">
              {row.answered}/{row.questionCount} answered
            </span>
            <span className="font-medium tabular-nums">
              {row.awardedMarks}/{row.totalMarks}
            </span>
          </div>
          <Progress
            value={row.progressPct}
            tone={row.status === 'completed' || row.status === 'passed' ? 'success' : 'default'}
            aria-label={`${row.title}: ${row.progressPct}% answered`}
          />
        </div>
        <DueLabel row={row} now={now} className="lg:justify-self-start" />
      </div>
      <div className="relative z-10 col-span-2 lg:col-span-1 lg:justify-self-end">
        <Button
          asChild
          size="sm"
          variant={row.status === 'in_progress' || row.status === 'overdue' ? 'default' : 'outline'}
        >
          <Link href={cta} aria-label={`${actionLabel(row)}: ${row.title}`}>
            {actionLabel(row)}
            <ArrowRight
              aria-hidden="true"
              className="transition-transform group-hover/row:translate-x-0.5"
            />
          </Link>
        </Button>
      </div>
    </li>
  );
}

/**
 * The learner's assignments: a summary, then every assignment as a row with its status, progress
 * and date. Filters, search, sorting and paging happen on the server and live in the address.
 */
export function MyAssignments() {
  const now = useNow();
  const labsOn = useModuleOn('practice');
  const [filters, setFilters] = useUrlState(FILTERS);
  // Typing waits a moment before it asks the server, so each keystroke is not a request.
  const searchTimer = useRef<number | undefined>(undefined);
  const search = (value: string) => {
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => setFilters({ q: value.trim() || null }), 300);
  };
  const page = Math.max(1, Number(filters.page) || 1);
  const sort = (LEARNER_ASSIGNMENT_SORTS as readonly string[]).includes(filters.sort)
    ? (filters.sort as LearnerAssignmentSort)
    : 'due';

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort });
  for (const key of ['q', 'status', 'technology', 'kind', 'level', 'courseId', 'topic'] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  const query = useQuery({
    queryKey: ['my-assignments', params.toString()],
    queryFn: () => api<LearnerAssignmentList>(`/me/assignments?${params.toString()}`),
    placeholderData: keepPreviousData,
  });

  if (query.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <span className="sr-only">Loading…</span>
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <div className="space-y-px overflow-hidden rounded-xl border border-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-none" />
          ))}
        </div>
      </div>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const { summary, facets, data, meta } = query.data;
  if (summary.total === 0) {
    return (
      <EmptyState
        title="No assignments yet"
        description="Assignments appear here as soon as your trainer gives one to your batch or to you."
        action={
          labsOn ? (
            <Button asChild variant="outline">
              <Link href="/labs">Try a lab</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  const filtered = (
    ['q', 'status', 'technology', 'kind', 'level', 'courseId', 'topic'] as const
  ).some((key) => filters[key]);
  const finishedPct = summary.total === 0 ? 0 : (summary.completed / summary.total) * 100;
  const nextUp =
    page === 1 && !filtered
      ? data.find((r) => r.next && (r.status === 'in_progress' || r.status === 'overdue'))
      : null;

  return (
    <div className="space-y-6">
      <OverviewBand
        label="Completed"
        pct={finishedPct}
        detail={`${summary.completed} of ${plural(summary.total, 'assignment')} completed`}
        figures={[
          { label: 'Pending', value: summary.pending },
          { label: 'In progress', value: summary.inProgress },
          {
            label: 'Overdue',
            value: summary.overdue,
            tone: summary.overdue > 0 ? 'danger' : 'default',
          },
        ]}
      />

      {nextUp?.next ? (
        <div className="flex flex-col gap-3 rounded-xl border border-primary-muted bg-primary-soft/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow text-brand">Up next</p>
            <p className="mt-1 truncate text-sm text-foreground">
              <span className="font-semibold">{nextUp.next.title}</span>
              <span className="text-muted-foreground"> in {nextUp.title}</span>
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href={`/assignments/${nextUp.id}/q/${nextUp.next.placementId}`}>
              Continue
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : null}

      <section aria-label="Filters" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <SearchInput
              defaultValue={filters.q}
              onChange={(e) => search(e.target.value)}
              placeholder="Search assignments"
              aria-label="Search assignments"
            />
          </div>
          <label className="flex flex-col gap-1.5 sm:w-48">
            <span className="text-xs font-medium text-muted-foreground">Sort by</span>
            <NativeSelect
              value={sort}
              onChange={(e) =>
                setFilters({ sort: e.target.value === 'due' ? null : e.target.value })
              }
              aria-label="Sort by"
            >
              {LEARNER_ASSIGNMENT_SORTS.map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <FacetSelect
            label="Status"
            allLabel="Any status"
            value={filters.status}
            options={facets.statuses}
            onChange={(v) => setFilters({ status: v || null })}
          />
          <FacetSelect
            label="Technology"
            allLabel="Any technology"
            value={filters.technology}
            options={facets.technologies}
            onChange={(v) => setFilters({ technology: v || null })}
          />
          <FacetSelect
            label="Type"
            allLabel="Any type"
            value={filters.kind}
            options={facets.kinds}
            onChange={(v) => setFilters({ kind: v || null })}
          />
          <FacetSelect
            label="Level"
            allLabel="Any level"
            value={filters.level}
            options={facets.levels}
            onChange={(v) => setFilters({ level: v || null })}
          />
          <FacetSelect
            label="Course"
            allLabel="Any course"
            value={filters.courseId}
            options={facets.courses}
            onChange={(v) => setFilters({ courseId: v || null })}
          />
          <FacetSelect
            label="Topic"
            allLabel="Any topic"
            value={filters.topic}
            options={facets.topics}
            onChange={(v) => setFilters({ topic: v || null })}
          />
        </div>
        {filtered ? (
          <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
            <span aria-live="polite">{plural(meta.total, 'assignment')} match</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setFilters({
                  q: null,
                  status: null,
                  technology: null,
                  kind: null,
                  level: null,
                  courseId: null,
                  topic: null,
                })
              }
            >
              <FilterX aria-hidden="true" />
              Clear filters
            </Button>
          </div>
        ) : null}
      </section>

      {data.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          description={
            filters.q
              ? `No assignment matches “${filters.q}” with these filters.`
              : 'No assignment matches these filters.'
          }
        />
      ) : (
        <div
          className={cn(
            'overflow-hidden rounded-xl border border-border bg-card shadow-xs',
            query.isFetching && 'opacity-80',
          )}
        >
          <ul className="divide-y divide-border" aria-label="Assignments">
            {data.map((row) => (
              <AssignmentRow key={row.id} row={row} now={now} />
            ))}
          </ul>
        </div>
      )}

      <PaginationBar
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        noun="assignments"
        onPageChange={(next) => setFilters({ page: next === 1 ? null : next })}
      />
    </div>
  );
}
