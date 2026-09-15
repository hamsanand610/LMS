'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type { LessonPracticeView } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { PageHeader } from '@/shell/page-header';

/**
 * A question embedded in a lesson (plan DP-S05). Getting it right completes the lesson, which is
 * what makes a practice lesson worth having in a course at all.
 */
export function LessonPractice({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<{
    correct: boolean;
    explanation: string;
    completed: boolean;
  } | null>(null);

  const query = useQuery({
    queryKey: ['lesson-practice', lessonId],
    queryFn: () => api<LessonPracticeView>(`/lessons/${lessonId}/practice`),
  });

  const submit = useMutation({
    mutationFn: () =>
      api<{ correct: boolean; explanation: string; completed: boolean }>(
        `/lessons/${lessonId}/practice/submissions`,
        { method: 'POST', body: { optionIds: chosen } },
      ),
    onSuccess: (result) => {
      setOutcome(result);
      if (result.correct) toast.success('That is right');
      else toast.error('Not quite — try again');
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'Could not send that'),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const view = query.data;
  const single = view.question?.type !== 'mcq_multi';

  return (
    <>
      <PageHeader
        title={view.lessonTitle}
        description="Answer this to finish the lesson."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/courses/${courseId}/lessons/${lessonId}`}>Back to the lesson</Link>
          </Button>
        }
      />

      {view.completed ? (
        <Badge className="mb-4 bg-success-soft text-success">You have finished this lesson</Badge>
      ) : null}

      {!view.question ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-sm text-muted-foreground">
            {view.reason ?? 'There is nothing to answer here.'}
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base">{view.question.title}</CardTitle>
            <CardDescription className="whitespace-pre-wrap">{view.question.body}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {view.answerable ? (
              <>
                <fieldset className="space-y-2" aria-label="Your answer">
                  {view.question.options.map((option) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm hover:bg-muted"
                    >
                      {single ? (
                        <input
                          type="radio"
                          name="answer"
                          checked={chosen.includes(option.id)}
                          onChange={() => setChosen([option.id])}
                          className="mt-1"
                        />
                      ) : (
                        <Checkbox
                          checked={chosen.includes(option.id)}
                          onCheckedChange={(checked) =>
                            setChosen((current) =>
                              checked === true
                                ? [...current, option.id]
                                : current.filter((id) => id !== option.id),
                            )
                          }
                        />
                      )}
                      <span>{option.body}</span>
                    </label>
                  ))}
                </fieldset>

                <Button
                  onClick={() => submit.mutate()}
                  disabled={submit.isPending || chosen.length === 0}
                >
                  {submit.isPending ? 'Checking…' : 'Check my answer'}
                </Button>

                {outcome ? (
                  <div
                    className={`rounded-md p-3 text-sm ${
                      outcome.correct
                        ? 'bg-success-soft text-success'
                        : 'bg-warning-soft text-warning'
                    }`}
                    role="status"
                  >
                    <p className="font-medium">
                      {outcome.correct ? 'Correct.' : 'Not right yet. Have another go.'}
                    </p>
                    {outcome.explanation ? <p className="mt-1">{outcome.explanation}</p> : null}
                    {outcome.completed ? (
                      <p className="mt-2">
                        The lesson is marked finished.{' '}
                        <Link href={`/courses/${courseId}`} className="underline">
                          Back to the course
                        </Link>
                        .
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                {view.reason}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
