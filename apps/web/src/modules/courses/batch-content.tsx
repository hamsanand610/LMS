'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { CourseSummary, Paginated } from '@lms/shared';
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

/**
 * What this batch has been given: the courses a live publication reaches, whether that publication
 * named this batch, its programme, or the whole institute. Publishing itself happens on the course.
 */
export function BatchContent({ batchId }: { batchId: string }) {
  const query = useQuery({
    queryKey: ['batch-content', batchId],
    queryFn: () => api<Paginated<CourseSummary>>(`/courses?batchId=${batchId}&pageSize=100`),
  });

  if (query.isPending) return <LoadingRows rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data.data.length === 0) {
    return (
      <EmptyState
        title="Nothing published yet"
        description="Open a course and publish it to this batch; everyone in the batch is enrolled straight away."
      />
    );
  }

  return (
    <div className="space-y-3 pt-4">
      <p className="text-sm text-muted-foreground">
        Everyone in this batch is enrolled in these. Open one to see every audience it reaches.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="text-right">Lessons</TableHead>
              <TableHead className="text-right">Audiences</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.data.map((course) => (
              <TableRow key={course.id}>
                <TableCell>
                  <Link
                    className="font-medium hover:underline"
                    href={`/admin/courses/${course.id}`}
                  >
                    {course.title}
                  </Link>
                </TableCell>
                <TableCell className="capitalize">{course.subject || '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{course.lessonCount}</TableCell>
                <TableCell className="text-right tabular-nums">{course.publicationCount}</TableCell>
                <TableCell>
                  <StatusBadge status={course.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
