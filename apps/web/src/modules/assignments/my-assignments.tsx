'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleDashed, Clock, Lock, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import type { AssignmentDetail, AssignmentProgressCard, AssignmentQuestionView } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api/http';
import { TYPE_LABELS } from '@/modules/questions/questions-table';
import { PageHeader } from '@/shell/page-header';

/** The learner's own assignments, newest deadline first. */
export function MyAssignments() {
  const query = useQuery({
    queryKey: ['my-assignments'],
    queryFn: () => api<AssignmentProgressCard[]>('/me/assignments'),
  });

  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        title="No assignments yet"
        description="They appear the moment your trainer publishes one to your batch."
      />
    );
  }

  const sorted = [...query.data].sort((a, b) =>
    (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'),
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((assignment) => (
        <Card key={assignment.assignmentId} className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">
              <Link href={`/assignments/${assignment.assignmentId}`} className="hover:underline">
                {assignment.title}
              </Link>
            </CardTitle>
            <CardDescription className="capitalize">
              {[assignment.subject, assignment.difficulty].filter(Boolean).join(' · ') ||
                'Practice set'}
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto space-y-3">
            <Progress
              value={assignment.progressPct}
              aria-label={`${assignment.progressPct}% solved`}
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              {assignment.solved} of {assignment.questionCount} solved · {assignment.awardedMarks}{' '}
              of {assignment.totalMarks} marks
            </p>
            {assignment.dueAt ? (
              <p
                className={`flex items-center gap-1 text-xs ${
                  assignment.overdue ? 'text-danger' : 'text-muted-foreground'
                }`}
              >
                <Clock className="size-3.5" aria-hidden />
                {assignment.overdue ? 'Was due ' : 'Due '}
                {new Date(assignment.dueAt).toLocaleDateString()}
              </p>
            ) : null}
            <Button asChild size="sm" className="w-full">
              <Link href={`/assignments/${assignment.assignmentId}`}>
                {assignment.progressPct === 0 ? 'Start' : 'Carry on'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** One assignment, module by module, with what is open and what is not. */
export function AssignmentOutline({ assignmentId }: { assignmentId: string }) {
  const query = useQuery({
    queryKey: ['my-assignment', assignmentId],
    queryFn: () => api<AssignmentDetail>(`/assignments/${assignmentId}/me`),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const assignment = query.data;
  const next = assignment.modules
    .filter((m) => m.unlocked !== false)
    .flatMap((m) => m.questions)
    .find((q) => q.status === 'not_attempted' || q.status === 'incorrect');

  return (
    <>
      <PageHeader
        title={assignment.title}
        description={assignment.description}
        actions={
          next ? (
            <Button asChild>
              <Link href={`/assignments/${assignmentId}/q/${next.id}`}>
                {assignment.progressPct === 0 ? 'Start' : 'Carry on'}
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Solved" value={`${assignment.solved ?? 0} / ${assignment.questionCount}`} />
        <Stat label="Marks" value={`${assignment.awardedMarks ?? 0} / ${assignment.totalMarks}`} />
        <Stat label="Progress" value={`${assignment.progressPct ?? 0}%`} />
        <Stat
          label="Due"
          value={assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString() : 'No date'}
        />
      </div>

      {assignment.overdue ? (
        <p className="mb-4 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
          The due date has passed. You can still answer; your trainer sees when each answer arrived.
        </p>
      ) : null}

      <div className="space-y-4">
        {assignment.modules.map((module, index) => (
          <Card key={module.id} className={module.unlocked === false ? 'opacity-70' : undefined}>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <CardTitle className="text-base">
                {index + 1}. {module.title}
              </CardTitle>
              <span className="ml-auto text-xs text-muted-foreground">
                {module.unlocked === false ? (
                  <span className="flex items-center gap-1">
                    <Lock className="size-3.5" aria-hidden />
                    {module.lockReason}
                  </span>
                ) : (
                  `${module.solved ?? 0} of ${module.questions.length} solved`
                )}
              </span>
            </CardHeader>
            <CardContent className="space-y-1">
              {module.questions.map((question) => (
                <QuestionRow
                  key={question.id}
                  question={question}
                  assignmentId={assignmentId}
                  locked={module.unlocked === false}
                />
              ))}
              {module.questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No questions in this module yet.</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function QuestionRow({
  question,
  assignmentId,
  locked,
}: {
  question: AssignmentQuestionView;
  assignmentId: string;
  locked: boolean;
}) {
  const Icon =
    question.status === 'correct'
      ? CheckCircle2
      : question.status === 'partial' || question.status === 'awaiting_grading'
        ? PlayCircle
        : CircleDashed;
  const body = (
    <>
      <Icon
        className={
          question.status === 'correct' ? 'size-4 text-success' : 'size-4 text-muted-foreground'
        }
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{question.title}</span>
      <span className="text-xs text-muted-foreground">
        {TYPE_LABELS[question.type] ?? question.type}
      </span>
      <span className="text-xs text-muted-foreground capitalize">{question.difficulty}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {question.awardedMarks ?? 0} / {question.marks}
      </span>
      {question.status === 'awaiting_grading' ? (
        <Badge className="bg-warning-soft text-warning">Waiting to be marked</Badge>
      ) : null}
    </>
  );

  if (locked) {
    return (
      <div
        className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground"
        aria-disabled="true"
      >
        {body}
      </div>
    );
  }
  return (
    <Link
      href={`/assignments/${assignmentId}/q/${question.id}`}
      className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
    >
      {body}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
