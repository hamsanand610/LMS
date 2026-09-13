'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { StudentDashboard as StudentDashboardData } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api/http';
import { CourseCard } from '@/modules/courses/course-catalogue';

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** The student home page: today's classes, what to carry on with, and what has been said. */
export function StudentDashboard() {
  const query = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => api<StudentDashboardData>('/me/dashboard'),
  });

  if (query.isPending) return <LoadingRows rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const { today, continueLearning, progress, announcements, batches, pending } = query.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overall progress</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{progress.progressPct}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progress.progressPct} aria-label="Overall progress" />
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {progress.completedLessons} of {progress.lessons} lessons across {progress.courses}{' '}
              courses
            </p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today and tomorrow</CardTitle>
            <CardDescription>Your next classes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {today.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing scheduled. Your whole timetable is on the schedule page.
              </p>
            ) : (
              today.slice(0, 4).map((session) => (
                <div key={session.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 tabular-nums">
                    {time(session.startsAt)} – {time(session.endsAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{session.subject}</span>
                  <StatusBadge status={session.status} />
                  {session.joinable ? (
                    <Button size="sm" asChild>
                      <a href={session.joinUrl} target="_blank" rel="noopener noreferrer">
                        Join
                      </a>
                    </Button>
                  ) : null}
                </div>
              ))
            )}
            <Button variant="outline" size="sm" asChild className="mt-2">
              <Link href="/schedule">Open the schedule</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Carry on learning</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/courses">All courses</Link>
          </Button>
        </div>
        {continueLearning.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No course is published to your batch yet. Nothing is being kept from you.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {continueLearning.map((course) => (
              <CourseCard key={course.courseId} course={course} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Announcements</CardTitle>
            <CardDescription>From your institute and your trainers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing announced at the moment.</p>
            ) : (
              announcements.map((announcement) => (
                <div key={announcement.id}>
                  <p className="text-sm font-medium">{announcement.title}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{announcement.body}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your batches</CardTitle>
            <CardDescription>Where your courses and classes come from.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You are not in a batch yet. Your institute adds you to one before classes begin.
              </p>
            ) : (
              batches.map((batch) => (
                <div key={batch.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{batch.code}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {batch.name}
                  </span>
                  <StatusBadge status={batch.status} />
                </div>
              ))
            )}
            {pending.length > 0 ? (
              <p className="pt-2 text-xs text-muted-foreground">
                Still to come: {pending.map((item) => item.label.toLowerCase()).join(', ')}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
