'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { SESSION_STATUSES, type BatchSummary, type Paginated, type SessionItem } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';

const ALL = 'all';

function today(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/** Every class across the institute, for the people who plan them. */
export function SessionsTable() {
  const [page, setPage] = useState(1);
  const [batchId, setBatchId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [from, setFrom] = useState(today(-7));
  const [to, setTo] = useState(today(21));

  const params = new URLSearchParams({ page: String(page), pageSize: '25', from, to });
  if (batchId !== ALL) params.set('batchId', batchId);
  if (status !== ALL) params.set('status', status);

  const query = useQuery({
    queryKey: ['sessions', params.toString()],
    queryFn: () => api<Paginated<SessionItem>>(`/sessions?${params.toString()}`),
  });
  const batches = useQuery({
    queryKey: ['batches', 'options'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="sessions-from">
            From
          </label>
          <Input
            id="sessions-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="sessions-to">
            To
          </label>
          <Input
            id="sessions-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        <Select
          value={batchId}
          onValueChange={(value) => {
            setBatchId(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56" aria-label="Filter by batch">
            <SelectValue placeholder="Any batch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any batch</SelectItem>
            {(batches.data?.data ?? []).map((batch) => (
              <SelectItem key={batch.id} value={batch.id}>
                {batch.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            {SESSION_STATUSES.map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isPending ? <LoadingRows /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No classes in this range"
          description="Timetables are built on a batch, under its Timetable tab."
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Trainer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recording</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="tabular-nums">
                    {new Date(session.startsAt).toLocaleString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="font-medium">{session.subject}</TableCell>
                  <TableCell>{session.batchCode}</TableCell>
                  <TableCell>{session.trainerName ?? '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={session.status} />
                  </TableCell>
                  <TableCell>
                    {session.recordingCourseId && session.recordingLessonId ? (
                      <Link
                        className="text-sm hover:underline"
                        href={`/admin/courses/${session.recordingCourseId}`}
                      >
                        Published
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {query.data ? (
        <PaginationBar
          page={query.data.meta.page}
          pageSize={query.data.meta.pageSize}
          total={query.data.meta.total}
          onPageChange={setPage}
          noun="classes"
        />
      ) : null}
    </div>
  );
}
