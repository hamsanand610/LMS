'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { DashboardAttentionItem, DashboardMetric, DashboardResponse } from '@lms/shared';
import { BarChartCard, LineChartCard } from '@/components/charts';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { SectionHeader } from '@/components/section-header';
import { StatusBadge } from '@/components/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { api } from '@/lib/api/http';
import { formatDateKey, formatNumber, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The figures in three plain groups, so fifteen numbers read as three questions — who is here,
 * what is being taught, how it is going — rather than a wall of look-alike tiles. A key this page
 * does not know yet still shows, under "More figures", so a new metric is never dropped.
 */
const GROUPS: { title: string; description: string; keys: string[] }[] = [
  {
    title: 'People',
    description: 'Who is on the platform, and who is using it.',
    keys: [
      'students.total',
      'students.active_7d',
      'students.active_30d',
      'students.new',
      'trainers.assigned',
    ],
  },
  {
    title: 'Delivery',
    description: 'What is being taught right now.',
    keys: ['batches.running', 'courses.published', 'attendance.percentage'],
  },
  {
    title: 'Outcomes',
    description: 'How far learners have got, and how they score.',
    keys: ['progress.completion', 'assessments.average', 'assignments.completion'],
  },
  {
    title: 'Placement',
    description: 'Selections recorded on the drives board.',
    keys: ['placements.status', 'placements.companies'],
  },
];

const ATTENTION_TONE: Record<
  DashboardAttentionItem['tone'],
  { icon: LucideIcon; className: string }
> = {
  danger: { icon: CircleAlert, className: 'bg-danger-soft text-danger' },
  warning: { icon: TriangleAlert, className: 'bg-warning-soft text-warning' },
  info: { icon: Info, className: 'bg-info-soft text-info' },
};

/**
 * The admin dashboard (plan DP-A01): what wants attention, the fifteen figures the customer asked
 * for with a definition on each, the trends, and the batches and courses behind them. A figure
 * whose module is not in this build says so instead of showing a number nobody could stand behind.
 */
export function AdminDashboard({ batchesHref = '/admin/batches' }: { batchesHref?: string }) {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardResponse>('/reports/dashboard'),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;

  // A figure with a stated reason is not in this build; one without is measured, even when
  // the range held nothing to measure (it then reads as a dash, not as missing).
  const measured = data.metrics.filter((m) => m.pending === null);
  const pending = data.metrics.filter((m) => m.pending !== null);
  const known = new Set(GROUPS.flatMap((g) => g.keys));
  const groups = [
    ...GROUPS.map((group) => ({
      ...group,
      metrics: group.keys
        .map((key) => measured.find((m) => m.key === key))
        .filter((m): m is DashboardMetric => Boolean(m)),
    })),
    {
      title: 'More figures',
      description: 'Measured, and not yet placed in a group.',
      keys: [],
      metrics: measured.filter((m) => !known.has(m.key)),
    },
  ].filter((group) => group.metrics.length > 0);

  return (
    <div className="space-y-10">
      <section
        aria-labelledby="attention-heading"
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <h2 id="attention-heading" className="text-[15px] font-semibold text-foreground">
            Needs attention
          </h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            Figures cover {formatDateKey(data.range.from)} to {formatDateKey(data.range.to)}, read
            at {formatTime(data.asOf)}.
          </p>
        </div>
        {data.attention.length === 0 ? (
          <p className="flex items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
            <CircleCheck className="size-5 text-success" aria-hidden="true" />
            Nothing is waiting on anybody right now.
          </p>
        ) : (
          <ul className="grid divide-y divide-border md:grid-cols-2 md:divide-y-0 md:[&>li:nth-child(n+3)]:border-t md:[&>li:nth-child(even)]:border-l md:[&>li]:border-border">
            {data.attention.map((item) => {
              const tone = ATTENTION_TONE[item.tone] ?? ATTENTION_TONE.info;
              const Icon = tone.icon;
              return (
                <li key={item.key}>
                  <Link
                    href={item.route}
                    className="group/item flex h-full items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface-2/60"
                  >
                    <span
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-lg',
                        tone.className,
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        {item.label}
                      </span>
                      <span className="block text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                    <span className="stat-figure text-2xl">{formatNumber(item.count)}</span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/item:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {groups.map((group) => (
          <section
            key={group.title}
            aria-labelledby={`group-${group.title}`}
            className={cn(group.metrics.length > 3 && 'xl:col-span-2')}
          >
            <SectionHeader
              id={`group-${group.title}`}
              title={group.title}
              description={group.description}
            />
            <dl className="flex flex-wrap gap-px overflow-hidden rounded-xl border border-border bg-border">
              {group.metrics.map((metric) => (
                <Figure key={metric.key} metric={metric} />
              ))}
            </dl>
          </section>
        ))}
      </div>

      {pending.length > 0 ? (
        <section aria-labelledby="pending-heading">
          <SectionHeader
            id="pending-heading"
            title="Not measured by this installation"
            description="Named rather than guessed at: each needs a module this installation does not have, or has switched off."
          />
          <ul className="flex flex-wrap gap-px overflow-hidden rounded-xl border border-dashed border-border bg-border">
            {pending.map((metric) => (
              <li key={metric.key} className="min-w-0 flex-1 basis-64 bg-background px-5 py-4">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground-secondary">
                  {metric.label}
                  <Definition metric={metric} />
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {metric.pending}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="attendance-trend"
          className="rounded-xl border border-border bg-card p-5"
        >
          <SectionHeader
            id="attendance-trend"
            title="Attendance"
            description="Every mark taken each day, across the batches in scope."
          />
          <LineChartCard
            data={data.charts.attendance}
            xKey="date"
            series={[{ key: 'value', label: 'Attendance %' }]}
            unit="%"
            label="Daily attendance percentage"
            emptyMessage="No class has been marked in this range."
          />
        </section>
        <section
          aria-labelledby="active-trend"
          className="rounded-xl border border-border bg-card p-5"
        >
          <SectionHeader
            id="active-trend"
            title="Active students"
            description="People who did something on the platform that day."
          />
          <BarChartCard
            data={data.charts.activeStudents}
            xKey="date"
            series={[{ key: 'value', label: 'Students' }]}
            label="Active students per day"
            emptyMessage="No activity recorded in this range."
          />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="batches-heading" className="min-w-0">
          <SectionHeader
            id="batches-heading"
            title="Batches"
            description="How full each cohort is."
            href={batchesHref}
            linkLabel="All batches"
          />
          {data.batches.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
              No batches yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead className="w-44">Enrolment</TableHead>
                    <TableHead className="text-right">Attendance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.batches.map((batch) => {
                    const fill =
                      batch.capacity === 0
                        ? 0
                        : Math.min(100, (batch.studentCount / batch.capacity) * 100);
                    return (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <Link
                            href={`${batchesHref}/${batch.id}`}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {batch.code}
                          </Link>
                          <p className="text-xs text-muted-foreground">{batch.name}</p>
                        </TableCell>
                        <TableCell className="text-foreground-secondary">
                          {formatDateKey(batch.startDate)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div
                              role="meter"
                              aria-label={`${batch.code} enrolment`}
                              aria-valuemin={0}
                              aria-valuemax={batch.capacity}
                              aria-valuenow={batch.studentCount}
                              className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"
                            >
                              <div
                                className="h-full rounded-full bg-foreground-secondary/70"
                                style={{ width: `${fill}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {batch.studentCount}/{batch.capacity}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {batch.attendancePct === null ? '—' : `${batch.attendancePct}%`}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={batch.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section aria-labelledby="recent-heading">
          <SectionHeader id="recent-heading" title="Recently added students" />
          {data.recentStudents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
              No students yet.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {data.recentStudents.map((student) => (
                <li key={student.id}>
                  <Link
                    href={`/admin/students/${student.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-foreground-secondary"
                    >
                      {student.name
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase())
                        .join('')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {student.name}
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {student.studentCode}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data.courses.length > 0 ? (
        <section aria-labelledby="courses-heading">
          <SectionHeader
            id="courses-heading"
            title="Courses"
            description="How many of these students each course has, and how far through they are."
          />
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-right">Enrolled</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="w-56">Mean progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium text-foreground">{course.title}</TableCell>
                    <TableCell className="text-right">{course.enrolled}</TableCell>
                    <TableCell className="text-right">{course.completed}</TableCell>
                    <TableCell>
                      {course.completionPct === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <div
                            aria-hidden="true"
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"
                          >
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${course.completionPct}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs text-foreground-secondary">
                            {course.completionPct}%
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** A figure's definition behind a small, labelled button, so every number can say what it is. */
function Definition({ metric }: { metric: DashboardMetric }) {
  return (
    <Tooltip>
      <TooltipTrigger
        className="grid size-5 cursor-help place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        aria-label={`What ${metric.label} means`}
      >
        <Info className="size-3.5" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{metric.definition}</TooltipContent>
    </Tooltip>
  );
}

/** A percentage's colour follows what it measures: attendance emerald, scores gold, work ink. */
function barTone(key: string): string {
  if (key.startsWith('attendance')) return 'bg-success';
  if (key.startsWith('assessments')) return 'bg-achievement';
  if (key.startsWith('assignments')) return 'bg-foreground-secondary/70';
  return 'bg-primary';
}

function Figure({ metric }: { metric: DashboardMetric }) {
  const percent = metric.unit === 'percent';
  const value = metric.value;
  const delta = metric.delta;
  return (
    <div className="min-w-0 flex-1 basis-40 bg-card px-5 py-4">
      <dt className="flex min-h-8 items-start gap-1.5 text-xs leading-4 text-muted-foreground">
        <span className="line-clamp-2">{metric.label}</span>
        <Definition metric={metric} />
      </dt>
      <dd className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="stat-figure text-[2rem] text-foreground">
          {value === null ? '—' : percent ? `${value}%` : formatNumber(value)}
        </span>
        {delta !== null && delta !== 0 ? (
          <span
            className={cn(
              'inline-flex items-center text-xs font-medium tabular-nums',
              delta > 0 ? 'text-success' : 'text-danger',
            )}
          >
            {delta > 0 ? (
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="size-3.5" aria-hidden="true" />
            )}
            {delta > 0 ? '+' : '−'}
            {formatNumber(Math.abs(delta))}
            {percent ? ' pts' : ''}
          </span>
        ) : null}
      </dd>
      {percent && value !== null ? (
        <dd aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
          <div
            className={cn('h-full rounded-full', barTone(metric.key))}
            style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          />
        </dd>
      ) : null}
    </div>
  );
}
