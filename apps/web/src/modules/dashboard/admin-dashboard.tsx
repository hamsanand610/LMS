'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { DashboardResponse } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { api } from '@/lib/api/http';

/** Tiles for what the platform can measure today; the rest say which phase brings them. */
export function AdminDashboard({ batchesHref = '/admin/batches' }: { batchesHref?: string }) {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardResponse>('/reports/dashboard'),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <Card key={metric.key} className={metric.pending ? 'border-dashed' : undefined}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                {metric.label}
                <Tooltip>
                  <TooltipTrigger
                    className="cursor-help text-muted-foreground"
                    aria-label={`What ${metric.label} means`}
                  >
                    ⓘ
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">{metric.definition}</TooltipContent>
                </Tooltip>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metric.value === null ? (
                <p className="text-sm text-muted-foreground">{metric.pending}</p>
              ) : (
                <p className="text-3xl font-semibold tabular-nums">
                  {metric.value}
                  {metric.unit === 'percent' ? '%' : ''}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Batches</CardTitle>
              <CardDescription>How full each cohort is.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={batchesHref}>All batches</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No batches yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead className="w-40">Enrolment</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <Link
                          href={`${batchesHref}/${batch.id}`}
                          className="font-medium hover:underline"
                        >
                          {batch.code}
                        </Link>
                        <p className="text-xs text-muted-foreground">{batch.name}</p>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{batch.startDate}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={
                              batch.capacity === 0 ? 0 : (batch.studentCount / batch.capacity) * 100
                            }
                            className="h-2"
                          />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {batch.studentCount}/{batch.capacity}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={batch.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently added students</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.recentStudents.map((student) => (
                  <li key={student.id} className="text-sm">
                    <Link
                      href={`/admin/students/${student.id}`}
                      className="font-medium hover:underline"
                    >
                      {student.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{student.studentCode}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Figures cover {data.range.from} to {data.range.to}, read at{' '}
        {new Date(data.asOf).toLocaleTimeString()}.
      </p>
    </div>
  );
}
