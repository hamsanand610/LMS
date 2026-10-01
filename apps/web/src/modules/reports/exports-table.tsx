'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ExportDownload, ExportJobRecord, Paginated } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';
import { formatDate, formatDateTime } from '@/lib/format';

const TONE: Record<string, string> = {
  ready: 'bg-success-soft text-success',
  running: 'bg-warning-soft text-warning',
  queued: 'bg-muted text-muted-foreground',
  failed: 'bg-danger-soft text-danger',
  expired: 'bg-muted text-muted-foreground',
};

/** The export list (plan DP-A26). Files expire, and the table says when. */
export function ExportsTable() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['exports', page],
    queryFn: () => api<Paginated<ExportJobRecord>>(`/exports?page=${page}&pageSize=25`),
    // A queued export becomes ready in the background; poll gently while anything is waiting.
    refetchInterval: (result) =>
      result.state.data?.data.some((job) => job.status === 'queued' || job.status === 'running')
        ? 3000
        : false,
  });

  const download = useMutation({
    mutationFn: (id: string) => api<ExportDownload>(`/exports/${id}/download`),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isPending) return <LoadingRows rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  if (query.data.data.length === 0) {
    return (
      <EmptyState
        title="No exports yet"
        description="Export a report and the file appears here while it is being written."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report</TableHead>
              <TableHead>Asked for</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Kept until</TableHead>
              <TableHead className="text-right">File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.data.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <p className="font-medium">{job.reportTitle}</p>
                  <p className="text-xs text-muted-foreground">{job.filename}</p>
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {formatDateTime(job.requestedAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{job.rowCount ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {job.sizeBytes === null
                    ? '—'
                    : `${Math.max(1, Math.round(job.sizeBytes / 1024))} KB`}
                </TableCell>
                <TableCell>
                  <Badge className={TONE[job.status] ?? 'bg-muted text-muted-foreground'}>
                    {job.status}
                  </Badge>
                  {job.error ? <p className="mt-1 text-xs text-danger">{job.error}</p> : null}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {job.expiresAt ? formatDate(job.expiresAt) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!job.downloadable || download.isPending}
                    onClick={() => download.mutate(job.id)}
                  >
                    Download
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
        noun="exports"
      />
    </div>
  );
}
