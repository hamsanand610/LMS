'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type { CourseEnrollmentRow, Paginated, PublicationScope } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
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
import { formatDate } from '@/lib/format';

const SOURCE: Record<PublicationScope, string> = {
  all: 'The whole institute',
  program: 'Their programme',
  batch: 'Their batch',
  learner: 'On their own',
};

/**
 * Everyone enrolled in a course, however they came (D8). A learner enrolled on their own is
 * withdrawn here; everyone else follows their batch or programme (ADR-0010).
 */
export function CourseEnrolments({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q.trim()) params.set('q', q.trim());
  const query = useQuery({
    queryKey: ['course', courseId, 'enrolments', params.toString()],
    queryFn: () =>
      api<Paginated<CourseEnrollmentRow>>(`/courses/${courseId}/enrollments?${params.toString()}`),
  });
  const withdraw = useMutation({
    mutationFn: (publicationId: string) =>
      api<{ removed: number }>(`/courses/${courseId}/publications/${publicationId}`, {
        method: 'DELETE',
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(
        result.removed === 0
          ? 'Withdrawn. They had started, so they keep what they did.'
          : 'Withdrawn from the course.',
      );
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The learner could not be withdrawn'),
  });

  return (
    <div className="space-y-4">
      <SearchInput
        wrapperClassName="w-full max-w-xs"
        placeholder="Search name or code"
        aria-label="Search enrolled learners"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      {query.isPending ? <LoadingRows rows={4} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="Nobody enrolled yet"
          description="Publish the course to a batch or a programme, or enrol one learner from Publishing."
        />
      ) : null}
      {query.data && query.data.data.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Through</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((row) => (
                  <TableRow key={row.studentId}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        href={`/admin/students/${row.studentId}`}
                      >
                        {row.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{row.studentCode}</p>
                    </TableCell>
                    <TableCell className="text-sm">{SOURCE[row.source]}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.progressPct}%</TableCell>
                    <TableCell>{formatDate(row.enrolledAt)}</TableCell>
                    <TableCell className="text-right">
                      {row.individualPublicationId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={withdraw.isPending}
                          onClick={() => withdraw.mutate(row.individualPublicationId!)}
                        >
                          Withdraw
                        </Button>
                      ) : null}
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
            noun="learners"
          />
        </>
      ) : null}
    </div>
  );
}
