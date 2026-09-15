'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { TrainerDashboard as TrainerDashboardData } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/http';

/**
 * The trainer's day (plan DP-T01). Today's classes come first with the roll call one click away,
 * because that is where journey J-05 begins; then what is waiting to be marked, how each batch is
 * doing, and who is slipping.
 */
export function TrainerDashboard() {
  const query = useQuery({
    queryKey: ['trainer-dashboard'],
    queryFn: () => api<TrainerDashboardData>('/trainer/dashboard'),
  });

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

  return (
    <div className="space-y-6">
      {data.unmarked.length > 0 ? (
        <Card className="border-warning/40 bg-warning-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {data.unmarked.length} {data.unmarked.length === 1 ? 'class needs' : 'classes need'} a
              roll call
            </CardTitle>
            <CardDescription>A class nobody marks counts towards nobody.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.unmarked.map((session) => (
                <li
                  key={session.sessionId}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <span className="font-medium">{session.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    {session.batchCode} · {new Date(session.startsAt).toLocaleString()}
                  </span>
                  <Button size="sm" className="ml-auto" asChild>
                    <Link href={`/trainer/sessions/${session.sessionId}/attendance`}>
                      Mark attendance
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today</CardTitle>
            <CardDescription>Your classes for the next day and a half.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.today.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {data.today.map((session) => (
                  <li
                    key={session.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{session.subject}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {session.batchCode} ·{' '}
                      {new Date(session.startsAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <StatusBadge status={session.status} />
                    <span className="ml-auto flex gap-2">
                      {session.joinUrl ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={session.joinUrl} target="_blank" rel="noreferrer">
                            Join
                          </a>
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/trainer/sessions/${session.id}/attendance`}>Attendance</Link>
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Waiting for you</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center justify-between">
              <Link href="/trainer/assignments" className="hover:underline">
                Assignment answers to mark
              </Link>
              <span className="font-semibold tabular-nums">{data.grading.assignments}</span>
            </p>
            <p className="flex items-center justify-between">
              <Link href="/trainer/tests" className="hover:underline">
                Test answers to mark
              </Link>
              <span className="font-semibold tabular-nums">{data.grading.tests}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Your batches</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.batches.map((batch) => (
            <Card key={batch.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    <Link href={`/trainer/batches/${batch.id}`} className="hover:underline">
                      {batch.code}
                    </Link>
                  </CardTitle>
                  <StatusBadge status={batch.status} />
                </div>
                <CardDescription>
                  {batch.students} {batch.students === 1 ? 'student' : 'students'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-2 text-center">
                <Figure label="Attendance" value={batch.attendancePct} suffix="%" />
                <Figure label="Assignments" value={batch.assignmentCompletionPct} suffix="%" />
                <Figure label="Last test" value={batch.lastTestAveragePct} suffix="%" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {data.atRisk.length > 0 ? (
        <Card className="border-danger/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Students slipping</CardTitle>
            <CardDescription>Below the attendance the institute expects.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.atRisk.map((student) => (
                <li
                  key={`${student.studentId}-${student.batchId}`}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <Link
                    href={`/trainer/students/${student.studentId}`}
                    className="font-medium hover:underline"
                  >
                    {student.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {student.studentCode} · {student.batchCode}
                  </span>
                  <Badge className="ml-auto bg-danger-soft text-danger tabular-nums">
                    {student.percentage}% ({student.attended}/{student.conducted})
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {data.announcements.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {data.announcements.map((announcement) => (
                <li key={announcement.id}>
                  <p className="font-medium">{announcement.title}</p>
                  <p className="text-muted-foreground">{announcement.body}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Figure({
  label,
  value,
  suffix = '',
}: {
  label: string;
  value: number | null;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums">
        {value === null ? '—' : `${value}${suffix}`}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
