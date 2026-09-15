'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { AttendanceSessionRow, AttendanceSessionState, Paginated } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
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
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-1">
          {STATES.map((option) => (
            <Button
              key={option.value}
              variant={state === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setState(option.value);
                setPage(1);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div>
          <Label htmlFor="from" className="text-xs">
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
        <div>
          <Label htmlFor="to" className="text-xs">
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
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
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
                        <p className="font-medium">{row.title}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {new Date(row.startsAt).toLocaleString()}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{row.batchCode}</TableCell>
                      <TableCell className="text-sm">{row.trainerName ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {row.markedCount}/{row.rosterSize}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {row.percentage === null ? '—' : `${row.percentage}%`}
                      </TableCell>
                      <TableCell>
                        {row.isMarked ? (
                          <Badge className="bg-success-soft text-success">Marked</Badge>
                        ) : (
                          <StatusBadge status={row.sessionStatus} />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
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
