'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, MessageSquareHeart, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  FEEDBACK_RATING_MAX,
  formatDateTime,
  type FeedbackQuestion,
  type LearnerFeedbackItem,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { cn } from '@/lib/utils';
import { useMe } from '@/shell/me-context';

function useMyFeedback() {
  return useQuery({
    queryKey: ['me', 'feedback'],
    queryFn: () => api<LearnerFeedbackItem[]>('/me/feedback'),
  });
}

/** The forms open for the learner's batches now, and which they have answered. */
export function LearnerFeedbackList() {
  const me = useMe();
  const query = useMyFeedback();
  if (query.isPending) return <LoadingRows rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        title="Nothing to answer right now"
        description="Feedback forms for your batch appear here while they are open, often from Friday to Sunday."
      />
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {query.data.map((item) => (
        <li key={`${item.formId}-${item.period}`}>
          <Link
            href={`/feedback/${item.formId}`}
            className="flex items-center gap-4 p-4 transition-colors hover:bg-surface-2"
          >
            <MessageSquareHeart className="size-5 shrink-0 text-brand" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                Open until {formatDateTime(item.closesAt, { timeZone: me.organization.timezone })}
                {item.anonymous ? ' · anonymous' : ''}
              </p>
            </div>
            {item.answered ? (
              <Badge variant="secondary">Answered</Badge>
            ) : (
              <Badge>Waiting for you</Badge>
            )}
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

type Answer = number | string;

/** One form, answered in one go. An anonymous form says so before anything is written. */
export function LearnerFeedbackForm({ formId }: { formId: string }) {
  const query = useMyFeedback();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const item = query.data?.find((f) => f.formId === formId);

  const submit = useMutation({
    mutationFn: () =>
      api<{ period: string }>(`/me/feedback/${formId}/responses`, {
        method: 'POST',
        body: { answers },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me', 'feedback'] });
      toast.success('Thank you. Your answers are in.');
    },
    onError: (error) => {
      if (isApiError(error) && error.problem?.errors?.length) {
        toast.error(error.problem.errors.map((e) => e.message).join(' '));
      } else {
        toast.error(isApiError(error) ? error.message : 'Your answers could not be sent');
      }
    },
  });

  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!item) {
    return (
      <EmptyState
        title="This form is not open"
        description="It may have closed, or it was not given to your batch."
        action={
          <Button asChild variant="outline">
            <Link href="/feedback">All feedback</Link>
          </Button>
        }
      />
    );
  }
  if (item.answered) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-5">
        <CheckCircle2 className="mt-0.5 size-5 text-success" aria-hidden />
        <div>
          <p className="font-medium">You have answered this one</p>
          <p className="text-sm text-muted-foreground">
            Each round takes one answer from each learner.
          </p>
        </div>
      </div>
    );
  }

  const missing = item.questions.filter(
    (q) => q.required && (answers[q.id] === undefined || answers[q.id] === ''),
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit.mutate();
      }}
    >
      {item.description ? <p className="text-muted-foreground">{item.description}</p> : null}
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4" aria-hidden />
        {item.anonymous
          ? 'Anonymous: your name is not kept with your answers, and figures appear only once five people have answered.'
          : 'Not anonymous: the institute’s administrators can see your name with your answers.'}
      </p>
      {item.questions.map((question, index) => (
        <QuestionField
          key={question.id}
          number={index + 1}
          question={question}
          value={answers[question.id]}
          onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
        />
      ))}
      <Button type="submit" disabled={missing.length > 0 || submit.isPending}>
        {submit.isPending ? 'Sending…' : 'Send answers'}
      </Button>
    </form>
  );
}

function QuestionField({
  number,
  question,
  value,
  onChange,
}: {
  number: number;
  question: FeedbackQuestion;
  value: Answer | undefined;
  onChange: (value: Answer) => void;
}) {
  const labelId = `q-${question.id}`;
  return (
    <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
      <legend id={labelId} className="px-1 text-sm font-medium">
        {number}. {question.prompt}
        {question.required ? null : <span className="ml-1 text-muted-foreground">(optional)</span>}
      </legend>
      {question.kind === 'rating' ? (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={labelId}>
          {Array.from({ length: FEEDBACK_RATING_MAX }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              onClick={() => onChange(n)}
              className={cn(
                'size-11 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-2',
                value === n
                  ? 'border-brand bg-primary-soft text-brand'
                  : 'border-border hover:bg-surface-2',
              )}
            >
              {n}
            </button>
          ))}
          <span className="self-center text-xs text-muted-foreground">
            1 = poor, {FEEDBACK_RATING_MAX} = excellent
          </span>
        </div>
      ) : null}
      {question.kind === 'choice' ? (
        <div className="space-y-2" role="radiogroup" aria-labelledby={labelId}>
          {question.options.map((option) => {
            const id = `${question.id}-${option}`;
            return (
              <div key={option} className="flex items-center gap-2">
                <input
                  id={id}
                  type="radio"
                  name={question.id}
                  className="size-4 accent-brand"
                  checked={value === option}
                  onChange={() => onChange(option)}
                />
                <Label htmlFor={id} className="font-normal">
                  {option}
                </Label>
              </div>
            );
          })}
        </div>
      ) : null}
      {question.kind === 'text' ? (
        <Textarea
          aria-labelledby={labelId}
          rows={3}
          maxLength={2000}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </fieldset>
  );
}
