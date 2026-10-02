'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { SectionHeader } from '@/components/section-header';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';

interface FailedJob {
  id: string;
  name: string;
  failedAt: string | null;
  attempts: number;
  error: string;
}

/** Background jobs that ran out of retries, each of which can be run again (ADM-10). */
export function FailedJobs() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'jobs', 'failed'],
    queryFn: () => api<FailedJob[]>('/admin/jobs/failed'),
  });
  const retry = useMutation({
    mutationFn: (id: string) =>
      api<{ retried: boolean }>(`/admin/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST' }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      toast.success(
        result.retried ? 'Queued to run again' : 'Jobs run inline here; nothing to retry',
      );
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The job could not be retried'),
  });

  return (
    <section aria-labelledby="failed-jobs" className="mt-8">
      <SectionHeader
        id="failed-jobs"
        title="Failed jobs"
        description="Background work that ran out of retries, newest first. Running one again is recorded."
      />
      {query.isPending ? <LoadingRows rows={3} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState title="Nothing has failed" description="Every background job finished." />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-xs">{job.name}</TableCell>
                  <TableCell>{job.failedAt ? formatDateTime(job.failedAt) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{job.attempts}</TableCell>
                  <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                    {job.error}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(job.id)}
                    >
                      Retry
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}
