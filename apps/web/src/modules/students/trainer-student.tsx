'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  AssessmentProgress,
  ProgressOverview,
  StudentDetail,
  StudentNoteRecord,
} from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { AttendanceDetail } from '@/modules/attendance/attendance-summary';
import { PageHeader } from '@/shell/page-header';

/**
 * A learner as their trainer sees them (plan DP-T05): how they are getting on, class by class and
 * course by course, and the staff notes. Nothing sensitive is here — the API withholds the
 * personal fields from anybody without `students:read_sensitive`, and this page never asks for
 * them, so a trainer sees a teaching record rather than a personnel file.
 */
export function TrainerStudent({ studentId }: { studentId: string }) {
  const student = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => api<StudentDetail>(`/students/${studentId}`),
  });
  const progress = useQuery({
    queryKey: ['student-progress', studentId],
    queryFn: () => api<ProgressOverview>(`/students/${studentId}/progress`),
  });

  if (student.isPending) return <LoadingRows rows={6} />;
  if (student.isError) {
    return <ErrorState error={student.error} onRetry={() => void student.refetch()} />;
  }
  const detail = student.data;

  return (
    <>
      <PageHeader
        title={detail.name}
        description={`${detail.studentCode} · ${detail.email}`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/trainer/batches">Back to your batches</Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusBadge status={detail.status} />
          </CardContent>
        </Card>
        {progress.data ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Course progress</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {progress.data.overall.progressPct}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={progress.data.overall.progressPct} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {progress.data.overall.completedLessons} of {progress.data.overall.lessons}{' '}
                  lessons
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Assignments solved</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {progress.data.assessment.assignments.solved}
                  <span className="text-base text-muted-foreground">
                    /{progress.data.assessment.assignments.questions}
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Test average</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {progress.data.assessment.tests.taken === 0
                    ? '—'
                    : `${progress.data.assessment.tests.averagePercentage}%`}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {progress.data.assessment.tests.taken}{' '}
                {progress.data.assessment.tests.taken === 1 ? 'test' : 'tests'} sat
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="pt-4">
          <AttendanceDetail
            endpoint={`/attendance/students/${studentId}`}
            title="Their attendance"
          />
        </TabsContent>

        <TabsContent value="courses" className="pt-4">
          {progress.isPending ? <LoadingRows rows={4} /> : null}
          {progress.data ? (
            <div className="space-y-2">
              {progress.data.courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No courses published to them yet.</p>
              ) : (
                progress.data.courses.map((course) => (
                  <div
                    key={course.courseId}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <span className="min-w-48 flex-1 font-medium">{course.title}</span>
                    <Progress value={course.progressPct} className="h-2 w-40" />
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {course.progressPct}% · {course.completedLessons}/{course.lessonCount}
                    </span>
                    <StatusBadge status={course.status} />
                  </div>
                ))
              )}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="assessment" className="pt-4">
          {progress.data ? <TestHistory assessment={progress.data.assessment} /> : null}
        </TabsContent>

        <TabsContent value="notes" className="pt-4">
          <Notes studentId={studentId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function TestHistory({ assessment }: { assessment: AssessmentProgress }) {
  if (assessment.tests.history.length === 0) {
    return <p className="text-sm text-muted-foreground">They have not sat a test yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {assessment.tests.history.map((entry) => (
        <li
          key={entry.attemptId}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm"
        >
          <span className="min-w-48 flex-1 font-medium">{entry.title}</span>
          <span className="tabular-nums">
            {entry.score}/{entry.totalMarks} ({entry.percentage}%)
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {entry.submittedAt ? new Date(entry.submittedAt).toLocaleDateString() : '—'}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Notes({ studentId }: { studentId: string }) {
  const client = useQueryClient();
  const [text, setText] = useState('');
  const query = useQuery({
    queryKey: ['student-notes', studentId],
    queryFn: () => api<StudentNoteRecord[]>(`/students/${studentId}/notes`),
  });
  const add = useMutation({
    mutationFn: () => api(`/students/${studentId}/notes`, { method: 'POST', body: { text } }),
    onSuccess: () => {
      setText('');
      toast.success('Note saved');
      void client.invalidateQueries({ queryKey: ['student-notes', studentId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add a note</CardTitle>
          <CardDescription>
            Notes are kept between staff. The learner never sees them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="What did you notice, and what did you agree to do about it?"
            aria-label="Note"
          />
          <Button
            onClick={() => add.mutate()}
            disabled={add.isPending || text.trim().length === 0}
            size="sm"
          >
            Save note
          </Button>
        </CardContent>
      </Card>

      {query.isPending ? <LoadingRows rows={3} /> : null}
      {query.data && query.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : null}
      <ul className="space-y-2">
        {(query.data ?? []).map((note) => (
          <li key={note.id} className="rounded-lg border border-border p-3 text-sm">
            <p className="whitespace-pre-wrap">{note.text}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {note.author.name} · {new Date(note.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
