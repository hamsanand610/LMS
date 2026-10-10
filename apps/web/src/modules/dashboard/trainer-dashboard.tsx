'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CircleCheck,
  ClipboardList,
  ExternalLink,
  FileCheck,
  Megaphone,
  MessageCircleQuestion,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import type {
  DoubtSummary,
  Paginated,
  TrainerDashboard as TrainerDashboardData,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { ProgressRing, type ProgressTone } from '@/components/progress-ring';
import { SectionHeader } from '@/components/section-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/http';
import { formatDateTime, formatTime, formatTimeRange, formatWeekday } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useModuleOn } from '@/shell/me-context';

/**
 * The trainer's day (plan DP-T01). What needs them comes first, with the roll call one click
 * away, because that is where journey J-05 begins; then today's classes, how each batch is doing,
 * and who is slipping.
 */
export function TrainerDashboard() {
  const query = useQuery({
    queryKey: ['trainer-dashboard'],
    queryFn: () => api<TrainerDashboardData>('/trainer/dashboard'),
  });
  const doubtsOn = useModuleOn('doubts');
  const doubts = useQuery({
    queryKey: ['doubts', 'staff', 'waiting-count'],
    queryFn: () => api<Paginated<DoubtSummary>>('/doubts?status=open&pageSize=1'),
    enabled: doubtsOn,
  });
  const waiting = doubts.data?.meta.total ?? 0;
  // Doubts are spoken of only while their module is on and their count has arrived.
  const doubtsKnown = doubtsOn && doubts.data !== undefined;

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;

  if (data.batches.length === 0) {
    return (
      <EmptyState
        title="No batches yet"
        description="An administrator assigns you to a batch; it then appears here with its roster, its timetable and its attendance."
      />
    );
  }

  const toMark = data.grading.assignments + data.grading.tests;

  return (
    <div className="space-y-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <section
          aria-labelledby="needs-heading"
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <h2 id="needs-heading" className="text-[15px] font-semibold text-foreground">
              Needs you
            </h2>
            <div className="flex flex-wrap justify-end gap-1.5">
              {data.unmarked.length > 0 ? (
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning tabular-nums">
                  {data.unmarked.length} roll {data.unmarked.length === 1 ? 'call' : 'calls'}
                </span>
              ) : null}
              {toMark > 0 ? (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-foreground-secondary tabular-nums">
                  {toMark} to mark
                </span>
              ) : null}
              {waiting > 0 ? (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-foreground-secondary tabular-nums">
                  {waiting} {waiting === 1 ? 'doubt' : 'doubts'}
                </span>
              ) : null}
            </div>
          </div>

          {data.unmarked.length === 0 && toMark === 0 && waiting === 0 ? (
            <p className="flex items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
              <CircleCheck className="size-5 text-success" aria-hidden="true" />
              {doubtsKnown
                ? 'Every class is marked, nothing is waiting to be graded and every doubt is answered.'
                : 'Every class is marked and nothing is waiting to be graded.'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.unmarked.map((session) => (
                <li
                  key={session.sessionId}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning">
                    <CalendarCheck className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      Roll call for {session.subject}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {session.batchCode} · {formatDateTime(session.startsAt)}
                    </p>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={`/trainer/sessions/${session.sessionId}/attendance`}>
                      Mark attendance
                    </Link>
                  </Button>
                </li>
              ))}
              <GradingRow
                href="/trainer/reviews"
                label="Assignment answers to review"
                count={data.grading.assignments}
                icon={ClipboardList}
              />
              <GradingRow
                href="/trainer/tests"
                label="Test answers to mark"
                count={data.grading.tests}
                icon={FileCheck}
              />
              <GradingRow
                href="/trainer/doubts"
                label="Doubts waiting for an answer"
                count={waiting}
                icon={MessageCircleQuestion}
              />
            </ul>
          )}
          {doubtsOn && doubts.isError ? (
            <p
              className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground"
              role="alert"
            >
              The waiting doubts could not be counted.{' '}
              <Button
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => void doubts.refetch()}
              >
                Try again
              </Button>
            </p>
          ) : null}
          {data.unmarked.length > 0 ? (
            <p className="border-t border-border bg-surface-2/50 px-5 py-2.5 text-xs text-muted-foreground">
              A class nobody marks counts towards nobody.
            </p>
          ) : null}
        </section>

        <section
          aria-labelledby="today-heading"
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <div>
              <h2 id="today-heading" className="text-[15px] font-semibold text-foreground">
                Today
              </h2>
              <p className="text-xs text-muted-foreground">
                Your classes for the next day and a half.
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/trainer/schedule">
                Schedule
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
          {data.today.length === 0 ? (
            <p className="flex items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
              <CalendarClock className="size-5" aria-hidden="true" />
              Nothing scheduled.
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {data.today.map((session) => {
                const live = session.status === 'live';
                return (
                  <li key={session.id} className="flex gap-4 px-5 py-3.5">
                    <div className="w-[4.75rem] shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
                      <p className={cn('font-medium', live ? 'text-brand' : 'text-foreground')}>
                        {formatTime(session.startsAt)}
                      </p>
                      <p>{formatWeekday(session.startsAt)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{session.subject}</p>
                        <StatusBadge status={session.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {session.batchCode} · {formatTimeRange(session.startsAt, session.endsAt)}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {session.joinUrl ? (
                          <Button variant={live ? 'default' : 'outline'} size="sm" asChild>
                            <a href={session.joinUrl} target="_blank" rel="noreferrer">
                              Join
                              <ExternalLink aria-hidden="true" />
                            </a>
                          </Button>
                        ) : null}
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/trainer/sessions/${session.id}/attendance`}>
                            Attendance
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <section aria-labelledby="batches-heading">
        <SectionHeader
          id="batches-heading"
          title="Your batches"
          description="Attendance, assignment completion and the last test, batch by batch."
          href="/trainer/batches"
          linkLabel="All batches"
        />
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.batches.map((batch) => (
            <li
              key={batch.id}
              className="group/batch relative rounded-xl border border-border bg-card p-5 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-foreground">
                    <Link
                      href={`/trainer/batches/${batch.id}`}
                      className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-focus"
                    >
                      {batch.code}
                    </Link>
                  </h3>
                  <p className="truncate text-xs text-muted-foreground">{batch.name}</p>
                </div>
                <StatusBadge status={batch.status} />
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                <Users className="size-3.5" aria-hidden="true" />
                {batch.students} {batch.students === 1 ? 'student' : 'students'}
              </p>
              <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4">
                <Measure label="Attendance" value={batch.attendancePct} tone="success" />
                <Measure
                  label="Assignments done"
                  value={batch.assignmentCompletionPct}
                  tone="neutral"
                />
                <Measure
                  label="Last test average"
                  value={batch.lastTestAveragePct}
                  tone="achievement"
                />
              </dl>
            </li>
          ))}
        </ul>
      </section>

      {data.courses.length > 0 || data.deadlines.length > 0 ? (
        <div
          className={cn(
            'grid gap-6',
            data.courses.length > 0 && data.deadlines.length > 0 && 'lg:grid-cols-2',
          )}
        >
          {data.courses.length > 0 ? (
            <section aria-labelledby="courses-heading">
              <SectionHeader
                id="courses-heading"
                title="Your courses"
                description="The ones you are in charge of first, then those your batches have."
                href="/trainer/courses"
                linkLabel="All courses"
              />
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {data.courses.map((course) => (
                  <li key={course.id}>
                    <Link
                      href={`/trainer/courses/${course.id}`}
                      className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-surface-2/60"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{course.title}</span>
                      {course.inCharge ? (
                        <StatusBadge status="staff" label="You edit" tone="brand" />
                      ) : null}
                      <StatusBadge status={course.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {data.deadlines.length > 0 ? (
            <section aria-labelledby="deadlines-heading">
              <SectionHeader
                id="deadlines-heading"
                title="Coming up"
                description="What closes in the next seven days."
              />
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {data.deadlines.map((deadline) => (
                  <li key={`${deadline.kind}-${deadline.id}-${deadline.batchCode}`}>
                    <Link
                      href={`/trainer/${deadline.kind === 'test' ? 'tests' : 'assignments'}/${deadline.id}`}
                      className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-surface-2/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{deadline.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {deadline.kind === 'test' ? 'Test window closes' : 'Assignment due'} ·{' '}
                          {deadline.batchCode}
                        </span>
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatDateTime(deadline.at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {data.atRisk.length > 0 || data.announcements.length > 0 ? (
        <div
          className={cn(
            'grid gap-6',
            data.atRisk.length > 0 && data.announcements.length > 0 && 'lg:grid-cols-2',
          )}
        >
          {data.atRisk.length > 0 ? (
            <section
              aria-labelledby="slipping-heading"
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="border-b border-border px-5 py-3.5">
                <h2 id="slipping-heading" className="text-[15px] font-semibold text-foreground">
                  Students slipping
                </h2>
                <p className="text-xs text-muted-foreground">
                  Below the attendance the institute expects.
                </p>
              </div>
              <ul className="divide-y divide-border">
                {data.atRisk.map((student) => (
                  <li
                    key={`${student.studentId}-${student.batchId}`}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/trainer/students/${student.studentId}`}
                        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {student.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {student.studentCode} · {student.batchCode}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger tabular-nums">
                      {student.percentage}%
                      <span className="font-normal">
                        {' '}
                        ({student.attended}/{student.conducted})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.announcements.length > 0 ? (
            <section
              aria-labelledby="announcements-heading"
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <h2
                id="announcements-heading"
                className="border-b border-border px-5 py-3.5 text-[15px] font-semibold text-foreground"
              >
                Announcements
              </h2>
              <ul className="divide-y divide-border">
                {data.announcements.map((announcement) => (
                  <li key={announcement.id} className="flex gap-3 px-5 py-3.5">
                    <Megaphone
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{announcement.title}</p>
                      <p className="mt-0.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {announcement.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GradingRow({
  href,
  label,
  count,
  icon: Icon,
}: {
  href: string;
  label: string;
  count: number;
  icon: typeof ClipboardList;
}) {
  if (count === 0) return null;
  return (
    <li>
      <Link
        href={href}
        className="group/row flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/60"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-foreground-secondary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{label}</span>
        <span className="stat-figure text-xl">{count}</span>
        <ArrowRight
          className="size-4 text-muted-foreground transition-transform group-hover/row:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/** One of a batch's three measures as a small arc, coloured by what it means. */
function Measure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: ProgressTone;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, Math.round(value)));
  return (
    // The name comes first for a screen reader; the arc sits above it on screen.
    <div className="flex flex-col-reverse items-center gap-2 text-center">
      <dt className="text-[11.5px] leading-tight text-muted-foreground">{label}</dt>
      <dd>
        <ProgressRing
          value={pct}
          size={56}
          stroke={5}
          tone={tone}
          label={value === null ? `${label}: not measured yet` : `${label}: ${pct}%`}
        >
          {value === null ? <span className="text-sm text-muted-foreground">—</span> : undefined}
        </ProgressRing>
      </dd>
    </div>
  );
}
