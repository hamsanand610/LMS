'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { AttemptResult, TestCard } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api/http';
import { PageHeader } from '@/shell/page-header';

/** What a learner sees after a test: their score, and the review their trainer allowed. */
export function TestResult({ testId }: { testId: string }) {
  const cards = useQuery({
    queryKey: ['my-tests'],
    queryFn: () => api<TestCard[]>('/me/tests'),
  });
  const card = cards.data?.find((t) => t.testId === testId);

  const result = useQuery({
    queryKey: ['attempt-result', card?.attemptId],
    queryFn: () => api<AttemptResult>(`/attempts/${card?.attemptId}/result`),
    enabled: Boolean(card?.attemptId),
  });

  if (cards.isPending) return <LoadingRows rows={5} />;
  if (cards.isError) return <ErrorState error={cards.error} onRetry={() => cards.refetch()} />;
  if (!card?.attemptId) {
    return (
      <EmptyState
        title="You have not sat this test"
        description="Once you have, your result appears here."
        action={
          <Button asChild variant="outline">
            <Link href="/tests">Back to your tests</Link>
          </Button>
        }
      />
    );
  }
  if (result.isPending) return <LoadingRows rows={5} />;
  if (result.isError) return <ErrorState error={result.error} onRetry={() => result.refetch()} />;
  const attempt = result.data;

  if (!attempt.released) {
    return (
      <>
        <PageHeader title={attempt.title} description="Your paper is in." />
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-base">Results are not out yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              You submitted on{' '}
              {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'this test'}.
              Your trainer releases the results once every written answer has been marked.
            </p>
            {attempt.pendingGrading > 0 ? (
              <p>{attempt.pendingGrading} of your answers still need a person to read them.</p>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/tests">Back to your tests</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={attempt.title}
        description={
          attempt.submittedAt
            ? `Submitted on ${new Date(attempt.submittedAt).toLocaleString()}`
            : undefined
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl tabular-nums">
              {attempt.score} / {attempt.totalMarks}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={attempt.percentage} aria-label={`${attempt.percentage} per cent`} />
            <p className="mt-2 text-xs text-muted-foreground">{attempt.percentage}%</p>
          </CardContent>
        </Card>
        {attempt.rank ? (
          <Stat label="Rank" value={`${attempt.rank} of ${attempt.cohortSize}`} />
        ) : null}
        {attempt.sections.map((section) => (
          <Stat
            key={section.id}
            label={section.title}
            value={`${section.score} / ${section.totalMarks}`}
          />
        ))}
      </div>

      {attempt.reviewPolicy === 'full' && attempt.questions.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Your answers</h2>
          {attempt.questions.map((question, index) => (
            <Card key={question.testQuestionId}>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">
                    {index + 1}. {question.title}
                  </CardTitle>
                  <Badge
                    className={
                      question.status === 'correct'
                        ? 'bg-success-soft text-success'
                        : question.status === 'partial'
                          ? 'bg-warning-soft text-warning'
                          : 'bg-muted text-muted-foreground'
                    }
                  >
                    {question.awardedMarks} / {question.marks}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {question.body ? (
                  <p className="whitespace-pre-wrap text-muted-foreground">{question.body}</p>
                ) : null}
                {question.yourText ? (
                  <div className="rounded-md border border-border p-3 whitespace-pre-wrap">
                    {question.yourText}
                  </div>
                ) : null}
                {question.graderComment ? (
                  <p className="rounded-md bg-muted p-3">
                    <span className="font-medium">Your trainer said: </span>
                    {question.graderComment}
                  </p>
                ) : null}
                {question.explanation ? (
                  <p className="rounded-md bg-muted p-3">
                    <span className="font-medium">Why: </span>
                    {question.explanation}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {attempt.reviewPolicy === 'score_only'
            ? 'Your trainer has released the score but not the paper.'
            : 'Your trainer has not released the paper for review.'}
        </p>
      )}
    </>
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
