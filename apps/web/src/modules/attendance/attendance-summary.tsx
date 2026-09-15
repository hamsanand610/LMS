'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { AttendanceStatus, AttendanceSummary, StudentAttendanceView } from '@lms/shared';
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';

const TONE: Record<AttendanceStatus, string> = {
  present: 'bg-success-soft text-success',
  late: 'bg-warning-soft text-warning',
  excused: 'bg-muted text-muted-foreground',
  absent: 'bg-danger-soft text-danger',
};

/** The tile a learner sees on their dashboard and progress page. */
export function AttendanceTile({ summary }: { summary: AttendanceSummary | null }) {
  if (!summary || summary.conducted === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Attendance</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No class has been marked for you yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className={summary.belowThreshold ? 'border-danger/40' : undefined}>
      <CardHeader className="pb-2">
        <CardDescription>Attendance</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{summary.percentage}%</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Progress value={summary.percentage ?? 0} aria-label={`${summary.percentage} per cent`} />
        <p className="text-xs text-muted-foreground">
          {summary.attended} of {summary.conducted} classes.{' '}
          {summary.belowThreshold
            ? `Below the ${summary.thresholdPct}% the institute expects.`
            : `The institute expects ${summary.thresholdPct}%.`}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * One person's attendance in full: the summary, the subjects, and a day-by-day list
 * (plan DP-S06). The same component serves the learner and the staff views of a learner.
 */
export function AttendanceDetail({
  endpoint,
  title = 'Attendance',
}: {
  endpoint: string;
  title?: string;
}) {
  // The range is set in the handler rather than computed while rendering: the React Compiler
  // rules this project runs under forbid calling `Date.now()` during render. An empty range means
  // "whatever the API's own default is", which it states back in `range`.
  const [days, setDays] = useState(0);
  const [from, setFrom] = useState('');
  const query = useQuery({
    queryKey: ['attendance-detail', endpoint, from],
    queryFn: () => api<StudentAttendanceView>(`${endpoint}${from ? `?from=${from}` : ''}`),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const view = query.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <label className="text-sm text-muted-foreground">
          <span className="mr-2">Covering</span>
          <select
            value={days}
            onChange={(event) => {
              const value = Number(event.target.value);
              setDays(value);
              setFrom(
                value === 0
                  ? ''
                  : new Date(Date.now() - value * 86_400_000).toISOString().slice(0, 10),
              );
            }}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value={0}>the default range</option>
            <option value={30}>the last 30 days</option>
            <option value={60}>the last 60 days</option>
            <option value={180}>the last 6 months</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AttendanceTile summary={view.summary} />
        {ATTENDANCE_STATUSES.map((status) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardDescription>{ATTENDANCE_STATUS_LABELS[status]}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{view.summary.counts[status]}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {view.bySubject.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By subject</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Attended</TableHead>
                  <TableHead className="text-right">Classes</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.bySubject.map((row) => (
                  <TableRow key={row.subject}>
                    <TableCell className="font-medium">{row.subject}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.attended}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.conducted}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.percentage === null ? '—' : `${row.percentage}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Class by class</CardTitle>
          <CardDescription>
            {view.range.from} to {view.range.to}. A class with no mark has not been taken yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {view.days.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classes in this range.</p>
          ) : (
            <ul className="space-y-3">
              {view.days.map((day) => (
                <li key={day.date}>
                  <p className="text-xs font-medium tabular-nums text-muted-foreground">
                    {day.date}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {day.entries.map((entry) => (
                      <li
                        key={entry.sessionId}
                        className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{entry.title}</span>
                        <span className="text-xs text-muted-foreground">{entry.subject}</span>
                        <span className="ml-auto flex items-center gap-2">
                          {entry.note ? (
                            <span className="text-xs text-muted-foreground">{entry.note}</span>
                          ) : null}
                          {entry.cancelled ? (
                            <Badge className="bg-muted text-muted-foreground">Cancelled</Badge>
                          ) : entry.status ? (
                            <Badge className={TONE[entry.status]}>
                              {ATTENDANCE_STATUS_LABELS[entry.status]}
                            </Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground">
                              {entry.upcoming ? 'Upcoming' : 'Not marked'}
                            </Badge>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
