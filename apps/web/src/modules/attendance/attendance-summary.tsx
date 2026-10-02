'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { AttendanceStatus, AttendanceSummary, StudentAttendanceView } from '@lms/shared';
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';
import { formatDateKey, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { NativeSelect } from '@/components/ui/native-select';

const TONE: Record<AttendanceStatus, string> = {
  present: 'bg-success-soft text-success',
  late: 'bg-warning-soft text-warning',
  excused: 'bg-info-soft text-info',
  absent: 'bg-danger-soft text-danger',
};

const DOT: Record<AttendanceStatus, string> = {
  present: 'bg-success',
  late: 'bg-warning',
  excused: 'bg-info',
  absent: 'bg-danger',
};

/** One person's attendance as a single measure, with the institute's expectation marked on it. */
export function AttendanceTile({ summary }: { summary: AttendanceSummary | null }) {
  if (!summary || summary.conducted === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <p className="text-xs text-muted-foreground">Attendance</p>
        <p className="mt-2 text-sm text-muted-foreground">No class has been marked for you yet.</p>
      </div>
    );
  }
  const pct = summary.percentage ?? 0;
  return (
    <div
      className={cn(
        'rounded-xl border bg-card px-5 py-4',
        summary.belowThreshold ? 'border-danger/40' : 'border-border',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted-foreground">Attendance</p>
        <p
          className={cn(
            'text-2xl font-semibold tracking-tight tabular-nums',
            summary.belowThreshold ? 'text-danger' : 'text-foreground',
          )}
        >
          {summary.percentage}%
        </p>
      </div>
      <div
        role="meter"
        aria-label="Attendance"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="relative mt-3 h-1.5 rounded-full bg-surface-3"
      >
        <div
          className={cn('h-full rounded-full', summary.belowThreshold ? 'bg-danger' : 'bg-primary')}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground/60"
          style={{ left: `${summary.thresholdPct}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground tabular-nums">
        {summary.attended} of {summary.conducted} classes.{' '}
        {summary.belowThreshold
          ? `Below the ${summary.thresholdPct}% the institute expects.`
          : `The institute expects ${summary.thresholdPct}%.`}
      </p>
    </div>
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
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Covering</span>
          <NativeSelect
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
          >
            <option value={0}>since the batch began</option>
            <option value={30}>the last 30 days</option>
            <option value={60}>the last 60 days</option>
            <option value={180}>the last 6 months</option>
          </NativeSelect>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <AttendanceTile summary={view.summary} />
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {ATTENDANCE_STATUSES.map((status) => (
            <div key={status} className="bg-card px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden="true" className={cn('size-2 rounded-full', DOT[status])} />
                {ATTENDANCE_STATUS_LABELS[status]}
              </dt>
              <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
                {view.summary.counts[status]}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {view.bySubject.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">By subject</h3>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
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
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Class by class</h3>
          <p className="text-xs text-muted-foreground">
            {formatDateKey(view.range.from)} to {formatDateKey(view.range.to)}. A class with no mark
            has not been taken yet.
          </p>
        </div>
        {view.days.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
            No classes in this range.
          </p>
        ) : (
          <ol className="overflow-hidden rounded-xl border border-border bg-card">
            {view.days.map((day) => (
              <li key={day.date} className="border-b border-border last:border-0">
                <p className="bg-surface-2/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                  {formatDateKey(day.date)}
                </p>
                <ul className="divide-y divide-border">
                  {day.entries.map((entry) => (
                    <li
                      key={entry.sessionId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm"
                    >
                      <span className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatTime(entry.startsAt)}
                      </span>
                      <span className="font-medium text-foreground">{entry.title}</span>
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
          </ol>
        )}
      </section>
    </div>
  );
}
