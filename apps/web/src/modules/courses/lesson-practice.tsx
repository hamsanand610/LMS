'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { CircleCheck, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type { LessonPracticeView } from '@lms/shared';
import { ChoiceRow } from '@/components/choice-row';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { InlineText } from '@/modules/workspace/statement';
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
        back={{ href: `/courses/${courseId}/lessons/${lessonId}`, label: 'Back to the lesson' }}
        eyebrow="Practice"
        title={view.lessonTitle}
        description="Answer this to finish the lesson."
        meta={
          view.completed ? (
            <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-success-soft px-2 text-[11.5px] font-medium text-success">
              <CircleCheck className="size-3" aria-hidden="true" />
              You have finished this lesson
            </span>
          ) : undefined
        }
      />

      {!view.question ? (
        <p className="max-w-3xl rounded-xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
          {view.reason ?? 'There is nothing to answer here.'}
        </p>
      ) : (
        <section
          aria-labelledby="practice-question"
          className="max-w-3xl space-y-5 rounded-xl border border-border bg-card px-5 py-5 sm:px-6 sm:py-6"
        >
          <div className="space-y-2">
            <h2
              id="practice-question"
              className="text-lg leading-snug font-semibold text-foreground"
            >
              {view.question.title}
            </h2>
            <p className="text-[15px] leading-7 whitespace-pre-wrap text-foreground-secondary">
              {view.question.body}
            </p>
          </div>
          {view.answerable ? (
            <>
              <fieldset className="space-y-2.5">
                <legend className="mb-3 text-xs font-medium text-muted-foreground">
                  {single ? 'Choose one' : 'Choose all that apply'}
                </legend>
                {view.question.options.map((option) => (
                  <ChoiceRow
                    key={option.id}
                    selected={chosen.includes(option.id)}
                    control={
                      single ? (
                        <input
                          type="radio"
                          name="answer"
                          checked={chosen.includes(option.id)}
                          onChange={() => setChosen([option.id])}
                          className="size-4 accent-primary"
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
                      )
                    }
                  >
                    {option.body}
                  </ChoiceRow>
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
                  role="status"
                  className={cn(
                    'flex gap-3 rounded-lg px-4 py-3 text-sm leading-relaxed',
                    outcome.correct ? 'bg-success-soft' : 'bg-warning-soft',
                  )}
                >
                  {outcome.correct ? (
                    <CircleCheck
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden="true"
                    />
                  ) : (
                    <RotateCcw className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  )}
                  <div className="min-w-0 space-y-1 text-foreground-secondary">
                    <p
                      className={cn(
                        'font-medium',
                        outcome.correct ? 'text-success' : 'text-warning',
                      )}
                    >
                      {outcome.correct ? 'Correct.' : 'Not right yet. Have another go.'}
                    </p>
                    {outcome.explanation ? (
                      <p>
                        <InlineText text={outcome.explanation} />
                      </p>
                    ) : null}
                    {outcome.completed ? (
                      <p>
                        The lesson is marked finished.{' '}
                        <Link
                          href={`/courses/${courseId}`}
                          className="font-medium text-brand underline-offset-4 hover:underline"
                        >
                          Back to the course
                        </Link>
                        .
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              {view.reason}
            </p>
          )}
        </section>
      )}
    </>
  );
}
