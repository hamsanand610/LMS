'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ReportData } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';
import { formatDate } from '@/lib/format';

/**
 * How the learners of one course are getting on, from the progress report, so the figures are
 * the report's own. A trainer sees the learners of the batches they teach; an administrator, all.
 */
export function CourseLearners({
  courseId,
  studentsBase,
}: {
  courseId: string;
  /** Where a learner's page lives in this portal, e.g. `/trainer/students`. */
  studentsBase: string;
}) {
  const query = useQuery({
    queryKey: ['course', courseId, 'learners'],
    queryFn: () => api<ReportData>(`/reports/progress?courseId=${courseId}&pageSize=100&sort=name`),
  });

  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const rows = query.data.rows;
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No learners yet"
        description="Learners appear here once the course is published to a batch they are in."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Progress</TableHead>
              <TableHead>Last opened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${String(row.studentId)}-${String(row.batchCode)}`}>
                <TableCell>
                  <Link
                    className="font-medium hover:underline"
                    href={`${studentsBase}/${String(row.studentId)}`}
                  >
                    {String(row.name)}
                  </Link>
                  <p className="text-xs text-muted-foreground">{String(row.studentCode)}</p>
                </TableCell>
                <TableCell>{String(row.batchCode || '—')}</TableCell>
                <TableCell>
                  <StatusBadge status={String(row.status)} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(row.progressPct ?? 0)}%
                </TableCell>
                <TableCell>
                  {row.lastAccessedAt ? formatDate(String(row.lastAccessedAt)) : 'Not yet'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {query.data.meta.total > rows.length ? (
        <p className="text-xs text-muted-foreground">
          Showing {rows.length} of {query.data.meta.total}. The progress report has them all.
        </p>
      ) : null}
    </div>
  );
}
