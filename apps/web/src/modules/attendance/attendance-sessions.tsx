'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { AttendanceSessionRow, AttendanceSessionState, Paginated } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATES: { value: AttendanceSessionState; label: string }[] = [
  { value: 'all', label: 'All classes' },
  { value: 'unmarked', label: 'Waiting for a roll call' },
  { value: 'marked', label: 'Marked' },
];

/**
 * Attendance across batches (plan DP-A15). The default view is every class; the "waiting" filter
 * is the one an administrator actually works from, and the dashboard links straight into it.
 */
export function AttendanceSessions({ portal }: { portal: 'admin' | 'trainer' }) {
  const rollCallHref = (id: string) =>
    portal === 'admin' ? `/admin/attendance/${id}` : `/trainer/sessions/${id}/attendance`;
  const params = useSearchParams();
  const [state, setState] = useState<AttendanceSessionState>(() => {
    const requested = params.get('state');
    return STATES.some((option) => option.value === requested)
      ? (requested as AttendanceSessionState)
      : 'all';
  });
  const [batchId] = useState(() => params.get('batchId') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const search = new URLSearchParams({ state, page: String(page), pageSize: '25' });
  if (batchId) search.set('batchId', batchId);
  if (from) search.set('from', from);
  if (to) search.set('to', to);

  const query = useQuery({
    queryKey: ['attendance-sessions', search.toString()],
    queryFn: () => api<Paginated<AttendanceSessionRow>>(`/attendance/sessions?${search}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
          {STATES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={state === option.value}
              onClick={() => {
                setState(option.value);
                setPage(1);
              }}
              className={cn(
                'h-8 rounded-md px-3 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus',
                state === option.value
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-foreground-secondary hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="h-9 w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="h-9 w-40"
            />
          </div>
        </div>
      </div>

      {query.isPending ? <LoadingRows rows={8} /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}

      {query.data ? (
        query.data.data.length === 0 ? (
          <EmptyState
            title={state === 'unmarked' ? 'Every class has been marked' : 'No classes here'}
            description={
              state === 'unmarked'
                ? 'Nothing is waiting for a roll call in this range.'
                : 'Classes appear once a timetable has been created for a batch.'
            }
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead className="text-right">Marked</TableHead>
                    <TableHead className="text-right">Attendance</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Roll call</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.data.map((row) => (
                    <TableRow key={row.sessionId}>
                      <TableCell>
                        <p className="font-medium text-foreground">{row.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(row.startsAt)}
                        </p>
                      </TableCell>
                      <TableCell className="text-foreground-secondary">{row.batchCode}</TableCell>
                      <TableCell className="text-foreground-secondary">
                        {row.trainerName ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-foreground-secondary">
                          {row.markedCount}/{row.rosterSize}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {row.percentage === null ? '—' : `${row.percentage}%`}
                      </TableCell>
                      <TableCell>
                        {row.isMarked ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
                            Marked
                          </span>
                        ) : (
                          <StatusBadge status={row.sessionStatus} />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant={row.isMarked ? 'outline' : 'default'} size="sm" asChild>
                          <Link href={rollCallHref(row.sessionId)}>
                            {row.isMarked ? 'Review' : 'Mark'}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={query.data.meta.page}
              pageSize={query.data.meta.pageSize}
              total={query.data.meta.total}
              onPageChange={setPage}
              noun="classes"
            />
          </>
        )
      ) : null}
    </div>
  );
}
