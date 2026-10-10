'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { AttendanceSessionRow, Paginated, ReportData } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

/**
 * The Attendance tab of a batch (plan DP-A11): every class with its percentage, and every student
 * with theirs. Both come from the same figures the reports and the learner's own page use.
 */
export function BatchAttendance({
  batchId,
  portal = 'admin',
}: {
  batchId: string;
  portal?: 'admin' | 'trainer';
}) {
  const rollCallHref = (id: string) =>
    portal === 'admin' ? `/admin/attendance/${id}` : `/trainer/sessions/${id}/attendance`;
  const studentHref = (id: string) =>
    portal === 'admin' ? `/admin/students/${id}` : `/trainer/students/${id}`;
  const sessions = useQuery({
    queryKey: ['attendance-sessions', 'batch', batchId],
    queryFn: () =>
      api<Paginated<AttendanceSessionRow>>(
        `/attendance/sessions?batchId=${batchId}&pageSize=50&state=all`,
      ),
  });
  const students = useQuery({
    queryKey: ['attendance-report', batchId],
    queryFn: () =>
      api<ReportData>(`/reports/attendance?batchId=${batchId}&pageSize=100&sort=percentage`),
  });

  if (sessions.isPending) return <LoadingRows rows={6} />;
  if (sessions.isError) {
    return <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />;
  }

  if (sessions.data.data.length === 0) {
    return (
      <EmptyState
        title="No classes yet"
        description="Create a timetable on the Timetable tab; attendance follows the classes it creates."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Classes</CardTitle>
          <CardDescription>
            Newest first. A class nobody marked counts towards nobody.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Marked</TableHead>
                <TableHead className="text-right">Attendance</TableHead>
                <TableHead className="text-right">Roll call</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.data.data.map((row) => (
                <TableRow key={row.sessionId}>
                  <TableCell>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">{row.subject}</p>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {formatDateTime(row.startsAt)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {row.isMarked ? (
                      `${row.markedCount}/${row.rosterSize}`
                    ) : (
                      <Badge className="bg-warning-soft text-warning">Not marked</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {row.percentage === null ? '—' : `${row.percentage}%`}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Students</CardTitle>
          <CardDescription>Lowest attendance first.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {students.isPending ? <LoadingRows rows={5} /> : null}
          {students.isError ? (
            <ErrorState error={students.error} onRetry={() => void students.refetch()} />
          ) : null}
          {students.data && students.data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students in this batch yet.</p>
          ) : null}
          {students.data && students.data.rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">Present</TableHead>
                  <TableHead className="text-right">Absent</TableHead>
                  <TableHead className="text-right">Classes</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.data.rows.map((row) => (
                  <TableRow key={String(row.studentId)}>
                    <TableCell>
                      <Link
                        href={studentHref(String(row.studentId))}
                        className="font-medium hover:underline"
                      >
                        {String(row.name)}
                      </Link>
                      <p className="text-xs text-muted-foreground">{String(row.studentCode)}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.present}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.absent}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.conducted}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.percentage === null ? '—' : `${row.percentage}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
