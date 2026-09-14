'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ProgressOverview as ProgressOverviewData } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api/http';

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
  const { overall, courses, assessment, activity, pending } = query.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Courses" value={`${overall.completedCourses} / ${overall.courses}`} />
        <Stat label="Lessons" value={`${overall.completedLessons} / ${overall.lessons}`} />
        <Stat label="Overall" value={`${overall.progressPct}%`} />
        <Stat label="Minutes watched" value={String(overall.minutesWatched)} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">By course</h2>
        {courses.length === 0 ? (
          <EmptyState
            title="Nothing enrolled yet"
            description="Progress appears here once a course is published to your batch."
          />
        ) : (
          <div className="space-y-3">
            {courses.map((course) => (
              <div key={course.courseId} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/courses/${course.courseId}`}
                    className="font-medium hover:underline"
                  >
                    {course.title}
                  </Link>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {course.completedLessons} of {course.lessonCount} lessons · {course.progressPct}
                    %
                  </span>
                </div>
                <Progress
                  className="mt-3"
                  value={course.progressPct}
                  aria-label={`${course.title} ${course.progressPct}% complete`}
                />
                {course.nextLessonTitle ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Next: {course.nextLessonTitle}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Assessment</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Assignment questions"
            value={`${assessment.assignments.solved} / ${assessment.assignments.questions}`}
          />
          <Stat
            label="Assignment marks"
            value={`${assessment.assignments.awardedMarks} / ${assessment.assignments.totalMarks}`}
          />
          <Stat label="Tests sat" value={String(assessment.tests.taken)} />
          <Stat label="Test average" value={`${assessment.tests.averagePercentage}%`} />
        </div>
        {assessment.tests.history.length > 0 ? (
          <div className="space-y-2">
            {assessment.tests.history.slice(0, 5).map((entry) => (
              <div
                key={entry.attemptId}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm"
              >
                <Link
                  href={`/tests/${entry.testId}/result`}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {entry.title}
                </Link>
                <span className="text-muted-foreground tabular-nums">
                  {entry.released
                    ? `${entry.score} / ${entry.totalMarks} · ${entry.percentage}%`
                    : 'Results not out yet'}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {assessment.practice.solved + assessment.practice.attempted > 0 ? (
          <p className="text-sm text-muted-foreground">
            Practice: {assessment.practice.solved} solved, {assessment.practice.attempted} tried,{' '}
            {assessment.practice.points} points.
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>The last things that were finished.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <span className="flex-1">
                    {item.link ? (
                      <Link href={item.link} className="hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.occurredAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Not measured yet</CardTitle>
            <CardDescription>
              These figures are named rather than guessed at, so nothing here is invented.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {pending.map((item) => (
              <div key={item.key}>
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground"> — {item.reason}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
