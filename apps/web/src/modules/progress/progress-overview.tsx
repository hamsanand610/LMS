'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Award,
  BookCheck,
  CircleCheck,
  Code,
  FileClock,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ProgressOverview as ProgressOverviewData } from '@lms/shared';
import { Meter } from '@/components/meter';
import { OverviewBand } from '@/components/overview-band';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { ProgressRing } from '@/components/progress-ring';
import { SectionHeader } from '@/components/section-header';
import { api } from '@/lib/api/http';
import { formatDate, formatNumber, humanise } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CourseCover } from '@/modules/courses/course-card';
import { AttendanceDetail } from '@/modules/attendance/attendance-summary';
import { ConsistencySection } from '@/modules/progress/consistency';

/** Icons for the activity feed, by the kind of thing that was finished. */
const ACTIVITY_ICON: Record<string, LucideIcon> = {
  'lesson.completed': BookCheck,
  'course.completed': Award,
};

/**
 * How far a learner has got. `path` is `/me/progress` for the learner's own page and
 * `/students/:id/progress` when a member of staff is looking at somebody else's.
 */
export function ProgressOverview({ path = '/me/progress' }: { path?: string }) {
  const query = useQuery({
    queryKey: ['progress', path],
    queryFn: () => api<ProgressOverviewData>(path),
  });

  if (query.isPending) return <LoadingRows rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const { overall, courses, assessment, attendance, activity, pending } = query.data;
  const own = path === '/me/progress';
  const measured = attendance && attendance.conducted > 0 ? attendance : null;

  return (
    <div className="space-y-10">
      <OverviewBand
        label="Course completion"
        pct={overall.progressPct}
        detail={`${formatNumber(overall.completedLessons)} of ${formatNumber(overall.lessons)} lessons finished`}
        figures={[
          { label: 'Courses finished', value: `${overall.completedCourses} / ${overall.courses}` },
          {
            label: 'Attendance',
            value: measured ? `${measured.percentage}%` : '—',
            tone: measured?.belowThreshold ? 'danger' : 'default',
          },
          { label: 'Minutes watched', value: formatNumber(overall.minutesWatched) },
        ]}
      />

      <ConsistencySection
        path={own ? '/me/consistency' : path.replace(/\/progress$/, '/consistency')}
        self={own}
      />

      <section aria-labelledby="by-course">
        <SectionHeader id="by-course" title="By course" />
        {courses.length === 0 ? (
          <EmptyState
            title="Nothing enrolled yet"
            description="Progress appears here once a course is published to your batch."
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {courses.map((course) => (
              <li key={course.courseId} className="flex items-center gap-4 px-4 py-4 sm:px-5">
                <CourseCover
                  title={course.title}
                  subject={course.subject}
                  thumbnailUrl={course.thumbnailUrl}
                  compact
                  className="hidden h-14 w-20 shrink-0 rounded-lg sm:block"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <Link
                      href={`/courses/${course.courseId}`}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {course.title}
                    </Link>
                    <span className="text-[13px] text-muted-foreground tabular-nums">
                      {course.completedLessons} of {course.lessonCount} lessons ·{' '}
                      <span className="font-semibold text-foreground">{course.progressPct}%</span>
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${course.title} ${course.progressPct}% complete`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={course.progressPct}
                    className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3"
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-700 ease-out',
                        course.status === 'completed' ? 'bg-success' : 'bg-primary',
                      )}
                      style={{ width: `${course.progressPct}%` }}
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {course.status === 'completed' ? (
                      <>
                        <CircleCheck className="size-3.5 text-success" aria-hidden="true" />
                        Finished
                      </>
                    ) : course.nextLessonTitle ? (
                      <>
                        <PlayCircle className="size-3.5" aria-hidden="true" />
                        Next: {course.nextLessonTitle}
                      </>
                    ) : (
                      humanise(course.status)
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="attendance-heading"
          className="rounded-xl border border-border bg-card p-5 sm:p-6"
        >
          <SectionHeader
            id="attendance-heading"
            title="Attendance"
            href={own ? '/attendance' : undefined}
            linkLabel="Class by class"
          />
          {measured ? (
            <div className="space-y-5">
              <Meter
                label="Classes attended"
                value={measured.percentage}
                threshold={measured.thresholdPct}
                tone={measured.belowThreshold ? 'warning' : 'success'}
                detail={
                  <>
                    {measured.attended} of {measured.conducted} classes.{' '}
                    {measured.belowThreshold
                      ? `Below the ${measured.thresholdPct}% the institute expects.`
                      : `The institute expects ${measured.thresholdPct}%.`}
                  </>
                }
              />
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border text-center">
                <Figure label="Held" value={measured.conducted} />
                <Figure label="Attended" value={measured.attended} />
                <Figure
                  label="Absent"
                  value={measured.counts.absent}
                  tone={measured.counts.absent > 0 ? 'danger' : undefined}
                />
              </dl>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No class has been marked for you yet.</p>
          )}
        </section>

        <section
          aria-labelledby="assessment-heading"
          className="rounded-xl border border-border bg-card p-5 sm:p-6"
        >
          <SectionHeader
            id="assessment-heading"
            title="Assessment"
            href={own ? '/tests' : undefined}
            linkLabel="Your tests"
          />
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
            <Figure
              label="Assignment questions"
              value={`${assessment.assignments.solved} / ${assessment.assignments.questions}`}
              align="left"
            />
            <Figure
              label="Assignment marks"
              value={`${assessment.assignments.awardedMarks} / ${assessment.assignments.totalMarks}`}
              align="left"
            />
            <Figure label="Tests sat" value={assessment.tests.taken} align="left" />
            <Figure
              label="Test average"
              // An average needs a released result; until then there is nothing to average.
              value={
                assessment.tests.history.some((h) => h.released && h.totalMarks > 0)
                  ? `${assessment.tests.averagePercentage}%`
                  : '—'
              }
              align="left"
            />
          </dl>
          {assessment.tests.history.length > 0 ? (
            <ul className="mt-4 divide-y divide-border">
              {assessment.tests.history.slice(0, 5).map((entry) => (
                <li key={entry.attemptId} className="flex items-center gap-3 py-2.5 text-sm">
                  {entry.released ? (
                    <ProgressRing
                      value={entry.percentage}
                      size={32}
                      stroke={4}
                      label={`${entry.title}: ${entry.percentage}%`}
                    >
                      <span />
                    </ProgressRing>
                  ) : (
                    <span className="grid size-8 place-items-center rounded-full bg-info-soft text-info">
                      <FileClock className="size-4" aria-hidden="true" />
                    </span>
                  )}
                  <Link
                    href={`/tests/${entry.testId}/result`}
                    className="min-w-0 flex-1 truncate font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {entry.title}
                  </Link>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {entry.released
                      ? `${entry.score} / ${entry.totalMarks} · ${entry.percentage}%`
                      : 'Results not out yet'}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {assessment.practice.solved + assessment.practice.attempted > 0 ? (
            <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
              <Code className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Labs:{' '}
                <span className="font-medium text-foreground">{assessment.practice.solved}</span>{' '}
                solved, {assessment.practice.attempted} tried, {assessment.practice.points} points.{' '}
                <Link href="/labs" className="font-medium text-brand hover:underline">
                  Open the Labs
                </Link>
              </span>
            </p>
          ) : null}
        </section>
      </div>

      {own ? (
        <details className="group rounded-xl border border-border bg-card px-4 py-3 sm:px-5">
          <summary className="cursor-pointer list-none text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
            Attendance by subject and class by class
            <span className="ml-2 text-xs font-normal text-muted-foreground group-open:hidden">
              Show
            </span>
          </summary>
          <div className="mt-4">
            <AttendanceDetail endpoint="/me/attendance" title="Attendance in detail" />
          </div>
        </details>
      ) : null}

      <div className={cn('grid gap-6', pending.length > 0 && 'lg:grid-cols-2')}>
        <section aria-labelledby="activity-heading">
          <SectionHeader
            id="activity-heading"
            title="Recent activity"
            description="The last things that were finished."
          />
          {activity.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
              Nothing recorded yet.
            </p>
          ) : (
            <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border">
              {activity.map((item) => {
                const Icon = ACTIVITY_ICON[item.type] ?? CircleCheck;
                return (
                  <li key={item.id} className="relative flex items-start gap-3">
                    <span className="relative grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 pt-1.5">
                      <p className="text-sm text-foreground">
                        {item.link ? (
                          <Link
                            href={item.link}
                            className="group/activity inline-flex items-center gap-1 underline-offset-4 hover:underline"
                          >
                            {item.title}
                            <ArrowRight
                              className="size-3 opacity-0 transition-opacity group-hover/activity:opacity-100"
                              aria-hidden="true"
                            />
                          </Link>
                        ) : (
                          item.title
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(item.occurredAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {pending.length > 0 ? (
          <section
            aria-labelledby="pending-heading"
            className="rounded-xl border border-dashed border-border p-5 sm:p-6"
          >
            <SectionHeader
              id="pending-heading"
              title="Not measured yet"
              description="These figures are named rather than guessed at, so nothing here is invented."
            />
            <ul className="space-y-2 text-sm">
              {pending.map((item) => (
                <li key={item.key}>
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground"> — {item.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
  align = 'center',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'danger';
  align?: 'center' | 'left';
}) {
  return (
    <div className={cn('bg-card px-4 py-3', align === 'left' && 'text-left')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-lg font-semibold tracking-tight tabular-nums',
          tone === 'danger' ? 'text-danger' : 'text-foreground',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
