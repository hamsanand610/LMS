'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Briefcase,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  FileText,
  Megaphone,
  Radio,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import {
  toLocalDateKey,
  type CourseProgress,
  type PlacementSummary,
  type StudentDashboard as StudentDashboardData,
} from '@lms/shared';
import { ErrorState } from '@/components/page-states';
import { ProgressRing, type ProgressTone } from '@/components/progress-ring';
import { SectionHeader } from '@/components/section-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/http';
import {
  daysFrom,
  formatDate,
  formatRelativeDay,
  formatTime,
  formatTimeRange,
  formatWeekdayDate,
  humanise,
} from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { CourseCard } from '@/modules/courses/course-card';
import { LeaderboardSnapshot } from '@/modules/leaderboard/leaderboard-board';
import { AdherenceCard, StreakCard, useConsistency } from '@/modules/progress/consistency';
import { useModuleOn } from '@/shell/me-context';

type Data = StudentDashboardData;

/** The course to resume: the one touched most recently that is not finished, else the first to start. */
function courseToResume(courses: CourseProgress[]): CourseProgress | null {
  const open = courses.filter(
    (c) => c.status !== 'completed' && c.progressPct < 100 && c.nextLessonId,
  );
  const touched = open
    .filter((c) => c.lastAccessedAt)
    .sort((a, b) => Date.parse(b.lastAccessedAt!) - Date.parse(a.lastAccessedAt!));
  return touched[0] ?? open.find((c) => c.progressPct > 0) ?? open[0] ?? null;
}

/** The hero's own light: the Burgundy Glow from the top-right, a faint grid inside it, fine grain. */
function HeroLight() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(52rem 30rem at 100% 0%, var(--glow-brand-strong), transparent 62%), radial-gradient(34rem 22rem at 0% 110%, color-mix(in oklab, var(--brand-primary) 16%, transparent), transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="knowledge-grid pointer-events-none absolute inset-0 -z-10 text-white/[0.04]"
        style={{
          maskImage: 'radial-gradient(44rem 26rem at 100% 0%, #000, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(44rem 26rem at 100% 0%, #000, transparent 72%)',
        }}
      />
      <div
        aria-hidden="true"
        className="grain pointer-events-none absolute inset-0 -z-10 opacity-[0.06] mix-blend-overlay"
      />
    </>
  );
}

/** Where you left off, inside the hero: the course, its arc, the next lesson and the one action. */
function ContinuePanel({ course, loading }: { course: CourseProgress | null; loading: boolean }) {
  const panel =
    'relative flex min-w-0 flex-col gap-6 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] sm:flex-row sm:items-center sm:p-6';
  if (loading) {
    return (
      <div className={panel} aria-hidden="true">
        <div className="size-[120px] shrink-0 animate-pulse rounded-full border-[9px] border-white/[0.07]" />
        <div className="flex-1 space-y-3">
          <div className="h-3 w-40 animate-pulse rounded bg-white/[0.07]" />
          <div className="h-7 w-56 animate-pulse rounded bg-white/[0.07]" />
          <div className="h-12 w-full animate-pulse rounded-lg bg-white/[0.05]" />
        </div>
      </div>
    );
  }
  if (!course) {
    return (
      <div className={panel}>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-nav-muted uppercase">
            Continue learning
          </p>
          <h2 className="font-display mt-2 text-2xl">Nothing to pick up yet</h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-nav-muted">
            No course is published to your batch yet, or you have finished everything. Nothing is
            being kept from you.
          </p>
          <Button
            asChild
            variant="ghost"
            className="mt-4 -ml-3 text-nav-foreground hover:bg-white/[0.06] hover:text-nav-foreground"
          >
            <Link href="/courses">
              See your courses <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }
  const started = course.progressPct > 0;
  return (
    <section aria-labelledby="continue-heading" className={panel}>
      <div className="flex shrink-0 flex-col items-center gap-2 self-start sm:self-center">
        <ProgressRing
          value={course.progressPct}
          size={120}
          stroke={9}
          tone="onDark"
          label={`${course.title}: ${course.progressPct}% complete`}
        />
        <p className="text-xs text-nav-muted tabular-nums">
          {course.completedLessons} of {course.lessonCount}{' '}
          {course.optionalLessons > 0 ? 'required' : 'lessons'}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-nav-muted uppercase">
          {started ? 'Continue where you left off' : 'Start here'}
        </p>
        <h2
          id="continue-heading"
          className="font-display mt-1.5 text-[1.625rem] leading-[1.08] text-balance"
        >
          {course.title}
        </h2>
        <p className="mt-1 text-[13px] text-nav-muted">
          {[course.subject, course.level].filter(Boolean).map(humanise).join(' · ')}
        </p>
        {course.nextLessonTitle ? (
          <div className="mt-4 border-l-2 border-nav-accent/70 pl-3.5">
            <p className="text-xs text-nav-muted">{started ? 'Next lesson' : 'First lesson'}</p>
            <p className="mt-0.5 truncate text-[15px] font-medium">{course.nextLessonTitle}</p>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button asChild size="lg">
            <Link href={`/courses/${course.courseId}/lessons/${course.nextLessonId}`}>
              {started ? 'Resume lesson' : 'Start the course'}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="text-nav-muted hover:bg-white/[0.06] hover:text-nav-foreground"
          >
            <Link href={`/courses/${course.courseId}`}>Course outline</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** A class that is live right now, one tap from the hero. */
function LiveNow({ session }: { session: Data['today'][number] }) {
  return (
    <a
      href={session.joinUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-6 inline-flex w-fit max-w-full items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pr-4 pl-1.5 text-sm transition-colors hover:bg-white/[0.09]"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-current" />
        Live
      </span>
      <span className="truncate">
        {session.title || session.subject}
        <span className="text-nav-muted"> · join the class</span>
      </span>
      <Video className="size-4 shrink-0 text-nav-muted" aria-hidden="true" />
    </a>
  );
}

/**
 * The learner's hero, the page's one ink plane: who they are and what day it is, then where they
 * left off with the Progress Arc. The greeting is the page's heading, so it shows while the rest
 * loads.
 */
function DashboardHero({
  greeting,
  date,
  welcome,
  course,
  live,
  loading,
}: {
  greeting: string;
  date: string;
  welcome: string;
  course: CourseProgress | null;
  live: Data['today'][number] | null;
  loading: boolean;
}) {
  return (
    <div
      data-nav-plane=""
      className="relative isolate overflow-hidden rounded-[1.75rem] bg-nav text-nav-foreground shadow-lg"
    >
      <HeroLight />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 p-6 sm:p-8 lg:p-10 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-center xl:gap-12">
        <div className="flex min-w-0 flex-col">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-nav-muted uppercase">
            {date}
          </p>
          <h1 className="font-display mt-3 text-[2.25rem] leading-[1.02] text-balance sm:text-[2.75rem] xl:text-[3.1rem]">
            {greeting}
          </h1>
          {welcome ? (
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-pretty text-nav-muted">
              {welcome}
            </p>
          ) : null}
          {live ? <LiveNow session={live} /> : null}
        </div>
        <ContinuePanel course={course} loading={loading} />
      </div>
    </div>
  );
}

/** Today's and tomorrow's classes; the next one first, with Join when it is live. */
function TodayCard({ sessions, now }: { sessions: Data['today']; now: number | null }) {
  const todayKey = now === null ? null : toLocalDateKey(new Date(now));
  const dayLabel = (iso: string) => {
    if (!todayKey || now === null) return formatWeekdayDate(iso);
    const days = daysFrom(now, iso);
    return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : formatWeekdayDate(iso);
  };
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Today and tomorrow</CardTitle>
        <CardDescription>Your next classes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {sessions.length === 0 ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-1 rounded-xl bg-surface-2/70 px-4 py-5">
            <p className="font-medium text-foreground">No classes coming up</p>
            <p className="text-[13px] text-muted-foreground">
              Your whole timetable is on the schedule page.
            </p>
          </div>
        ) : (
          <ol className="relative flex flex-col">
            {sessions.slice(0, 4).map((session) => {
              const live = session.joinable || session.status === 'live';
              return (
                <li
                  key={session.id}
                  className={cn(
                    'relative grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 rounded-xl px-3 py-3',
                    live && 'bg-primary-soft/60 ring-1 ring-primary-muted/70 ring-inset',
                  )}
                >
                  <div className="border-r border-border pr-3">
                    <p className="stat-figure text-lg text-foreground">
                      {formatTime(session.startsAt)}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                      {dayLabel(session.startsAt)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-foreground">
                        {session.title || session.subject}
                      </p>
                      {live ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand">
                          <Radio className="size-3" aria-hidden="true" /> Live now
                        </span>
                      ) : (
                        <StatusBadge status={session.status} className="shrink-0" />
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="text-[13px] text-muted-foreground tabular-nums">
                        {formatTimeRange(session.startsAt, session.endsAt)}
                      </p>
                      {session.joinable ? (
                        <Button size="sm" asChild>
                          <a href={session.joinUrl} target="_blank" rel="noopener noreferrer">
                            <Video aria-hidden="true" /> Join
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <Button variant="outline" size="sm" asChild className="mt-4 w-full">
          <Link href="/schedule">Open the schedule</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Assignments and tests due soon, each with how soon in words and an edge in the urgency colour. */
function DueSoon({
  tasks,
  now,
  className,
}: {
  tasks: Data['tasks'];
  now: number | null;
  className?: string;
}) {
  return (
    <section aria-labelledby="due-heading" className={className}>
      <SectionHeader
        id="due-heading"
        title="Due soon"
        description="Assignments and tests waiting for you."
        href="/assignments"
        linkLabel="All assignments"
      />
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border-strong/80 px-5 py-9 text-center">
          <CircleCheck className="mb-1 size-5 text-success" aria-hidden="true" />
          <p className="font-medium">Nothing due right now</p>
          <p className="text-sm text-muted-foreground">
            A good moment for some{' '}
            <Link href="/practice" className="font-medium text-brand hover:underline">
              coding practice
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {tasks.map((task) => {
            const Icon = task.kind === 'test' ? FileText : ClipboardList;
            const days = task.dueAt && now !== null ? daysFrom(now, task.dueAt) : null;
            const urgency =
              days === null ? 'none' : days < 0 ? 'overdue' : days <= 2 ? 'soon' : 'later';
            return (
              <li key={`${task.kind}-${task.id}`}>
                <Link
                  href={task.link}
                  className="group/row relative flex items-center gap-4 py-3.5 pr-4 pl-5 transition-colors hover:bg-surface-2/60"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-y-3 left-0 w-[3px] rounded-r-full',
                      urgency === 'overdue'
                        ? 'bg-danger'
                        : urgency === 'soon'
                          ? 'bg-warning'
                          : 'bg-border-strong',
                    )}
                  />
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-secondary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{task.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {task.kind === 'test' ? 'Test' : 'Assignment'} · {task.status}
                    </span>
                  </span>
                  {task.dueAt ? (
                    <span
                      className={cn(
                        'shrink-0 text-right text-xs tabular-nums',
                        urgency === 'overdue'
                          ? 'text-danger'
                          : urgency === 'soon'
                            ? 'text-warning'
                            : 'text-muted-foreground',
                      )}
                    >
                      <span className="block font-semibold">
                        {days === null
                          ? formatDate(task.dueAt)
                          : `Due ${formatRelativeDay(task.dueAt, now!)}`}
                      </span>
                      {days !== null ? (
                        <span className="block text-muted-foreground">
                          {formatDate(task.dueAt)}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/row:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** One measure as a small arc beside its name and context. */
function RingMeasure({
  label,
  value,
  detail,
  tone = 'default',
  threshold,
}: {
  label: string;
  value: number | null;
  detail: string;
  tone?: ProgressTone;
  threshold?: number;
}) {
  return (
    <li className="flex items-center gap-4">
      <ProgressRing
        value={value ?? 0}
        size={56}
        stroke={5}
        tone={tone}
        threshold={threshold}
        label={value === null ? `${label}: not measured yet` : `${label}: ${value}%`}
      >
        {value === null ? <span className="text-sm text-muted-foreground">—</span> : undefined}
      </ProgressRing>
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}

/** The measures that matter to a learner, each an arc with its context. */
function ProgressSnapshot({
  progress,
  attendance,
  assessment,
}: {
  progress: Data['progress'];
  attendance: Data['attendance'];
  assessment: Data['assessment'];
}) {
  const measured = attendance && attendance.conducted > 0;
  const released = assessment
    ? assessment.tests.history.filter((h) => h.released && h.totalMarks > 0).length
    : 0;
  const hours = Math.round((progress.minutesWatched / 60) * 10) / 10;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your progress</CardTitle>
        <CardDescription>Across every course and class.</CardDescription>
      </CardHeader>
      <CardContent className="gap-5">
        <ul className="flex flex-col gap-4">
          <RingMeasure
            label="Overall progress"
            value={progress.progressPct}
            detail={`${progress.completedLessons} of ${progress.lessons} lessons across ${progress.courses} courses`}
          />
          <RingMeasure
            label="Attendance"
            value={measured ? (attendance.percentage ?? 0) : null}
            threshold={measured ? attendance.thresholdPct : undefined}
            tone={measured && attendance.belowThreshold ? 'warning' : 'success'}
            detail={
              measured
                ? `${attendance.attended} of ${attendance.conducted} classes. ${
                    attendance.belowThreshold
                      ? `Below the ${attendance.thresholdPct}% the institute expects.`
                      : `The institute expects ${attendance.thresholdPct}%.`
                  }`
                : 'No class has been marked for you yet.'
            }
          />
          {assessment && assessment.assignments.questions > 0 ? (
            <RingMeasure
              label="Assignments"
              value={assessment.assignments.progressPct}
              tone="neutral"
              detail={`${assessment.assignments.solved} of ${assessment.assignments.questions} questions solved · ${assessment.assignments.awardedMarks} of ${assessment.assignments.totalMarks} marks`}
            />
          ) : null}
          {assessment ? (
            <RingMeasure
              label="Test average"
              value={released > 0 ? assessment.tests.averagePercentage : null}
              tone="achievement"
              detail={
                released > 0
                  ? `Across ${released} ${released === 1 ? 'test' : 'tests'} with results out.`
                  : assessment.tests.taken > 0
                    ? `${assessment.tests.taken} sat; the results are not out yet.`
                    : 'No test sat yet.'
              }
            />
          ) : null}
        </ul>
        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          <div>
            <dt className="text-xs text-muted-foreground">Courses finished</dt>
            <dd className="stat-figure mt-1.5 text-2xl">
              {progress.completedCourses}
              <span className="text-sm font-normal tracking-normal text-muted-foreground">
                {' '}
                / {progress.courses}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Video watched</dt>
            <dd className="stat-figure mt-1.5 text-2xl">
              {hours}
              <span className="text-sm font-normal tracking-normal text-muted-foreground"> h</span>
            </dd>
          </div>
        </dl>
        <Link
          href="/progress"
          className="group/see inline-flex w-fit items-center gap-1 text-[13px] font-medium text-brand hover:underline"
        >
          Your full progress
          <ArrowRight
            className="size-3.5 transition-transform group-hover/see:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </CardContent>
    </Card>
  );
}

/** Streak, class-day adherence and, where the institute runs one, the batch leaderboard. */
function ConsistencyRow({ leaderboard }: { leaderboard: boolean }) {
  const query = useConsistency();
  if (query.isPending) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
        {leaderboard ? <Skeleton className="h-72 rounded-2xl md:col-span-2 xl:col-span-1" /> : null}
      </div>
    );
  }
  if (query.isError) return null;
  return (
    <section
      aria-label="Your learning habits"
      className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      <StreakCard data={query.data} />
      <AdherenceCard data={query.data} />
      {leaderboard ? <LeaderboardSnapshot className="md:col-span-2 xl:col-span-1" /> : null}
    </section>
  );
}

/** Open drives the learner can apply to, and the next closing date, one tap from the board. */
function PlacementBand() {
  const now = useNow();
  const query = useQuery({
    queryKey: ['placement-summary'],
    queryFn: () => api<PlacementSummary>('/me/placement'),
  });
  if (!query.data) return null;
  const { eligibleOpen, applied, shortlisted, selected, nextDeadline } = query.data;
  return (
    <section
      aria-labelledby="placement-heading"
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:p-6"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-achievement-soft text-achievement">
        <Briefcase className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">Placements</p>
        <h2 id="placement-heading" className="mt-1 text-[15px] font-semibold text-foreground">
          {eligibleOpen > 0
            ? `${eligibleOpen} open ${eligibleOpen === 1 ? 'drive' : 'drives'} you can apply to`
            : 'Placements'}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {nextDeadline
            ? `${nextDeadline.company} · ${nextDeadline.role} closes ${
                now === null
                  ? formatDate(nextDeadline.applyBy)
                  : formatRelativeDay(nextDeadline.applyBy, now)
              }.`
            : applied > 0
              ? `${applied} ${applied === 1 ? 'application' : 'applications'} in progress${
                  shortlisted > 0 ? `, ${shortlisted} shortlisted` : ''
                }${selected > 0 ? `, ${selected} selected` : ''}.`
              : 'No drive is open to you right now. Interview prep is always open.'}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/placements">See drives</Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/interview-prep">Interview prep</Link>
        </Button>
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl md:col-span-2 xl:col-span-1" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Skeleton className="h-64 rounded-xl xl:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * The learner's home, in order of what matters: the hero (who, when, and where they left off), the
 * habits that keep them going, what is due and when class is, then everything else.
 */
export function StudentDashboard({
  greeting,
  date,
  welcome,
}: {
  greeting: string;
  date: string;
  welcome: string;
}) {
  const now = useNow();
  const query = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => api<Data>('/me/dashboard'),
  });

  const data = query.data;
  const resume = data ? courseToResume(data.continueLearning) : null;
  const live = data?.today.find((session) => session.joinable) ?? null;

  return (
    <div className="space-y-10">
      <DashboardHero
        greeting={greeting}
        date={date}
        welcome={welcome}
        course={resume}
        live={live}
        loading={query.isPending}
      />
      {query.isPending ? <DashboardSkeleton /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {data ? <DashboardBody data={data} now={now} resume={resume} /> : null}
    </div>
  );
}

function DashboardBody({
  data,
  now,
  resume,
}: {
  data: Data;
  now: number | null;
  resume: CourseProgress | null;
}) {
  const leaderboardOn = useModuleOn('gamification');
  const placementOn = useModuleOn('placement');
  const { today, continueLearning, progress, tasks, announcements, attendance, assessment } = data;
  const { batches, pending } = data;
  const others = continueLearning.filter((c) => c.courseId !== resume?.courseId);
  return (
    <>
      <ConsistencyRow leaderboard={leaderboardOn} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <DueSoon tasks={tasks} now={now} className="xl:col-span-2" />
        <TodayCard sessions={today} now={now} />
      </div>

      {placementOn ? <PlacementBand /> : null}

      {others.length > 0 ? (
        <section aria-labelledby="courses-heading">
          <SectionHeader
            id="courses-heading"
            title="Your other courses"
            href="/courses"
            linkLabel="All courses"
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {others.slice(0, 6).map((course) => (
              <CourseCard key={course.courseId} course={course} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <div className="flex flex-col gap-5 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Announcements</CardTitle>
              <CardDescription>From your institute and your trainers.</CardDescription>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing announced at the moment.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {announcements.map((announcement) => (
                    <li key={announcement.id} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-secondary">
                        <Megaphone className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{announcement.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          {announcement.body}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                          {formatDate(announcement.startsAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your batches</CardTitle>
              <CardDescription>Where your courses and classes come from.</CardDescription>
            </CardHeader>
            <CardContent>
              {batches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You are not in a batch yet. Your institute adds you to one before classes begin.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {batches.map((batch) => (
                    <li key={batch.id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{batch.code}</p>
                        <p className="truncate text-xs text-muted-foreground">{batch.name}</p>
                      </div>
                      <StatusBadge status={batch.status} />
                    </li>
                  ))}
                </ul>
              )}
              {pending.length > 0 ? (
                <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Still to come: {pending.map((item) => item.label.toLowerCase()).join(', ')}.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <ProgressSnapshot progress={progress} attendance={attendance} assessment={assessment} />
      </div>
    </>
  );
}
