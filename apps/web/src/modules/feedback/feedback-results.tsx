'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  FEEDBACK_MIN_RESPONSES,
  formatDateTime,
  type FeedbackFormDetail,
  type FeedbackQuestionResult,
  type FeedbackResults,
} from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Meter } from '@/components/meter';
import { StatStrip } from '@/components/stat-strip';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { useParentPath } from '@/lib/use-parent-path';
import { PageHeader } from '@/shell/page-header';
import { useCan, useMe } from '@/shell/me-context';
import { FEEDBACK_STATUS } from './feedback-forms';

/**
 * One form's figures, round by round. Below five answers only the counts show, so nobody can be
 * picked out (D10); comments carry a name only on a named form, and only for administrators.
 */
export function FeedbackResultsView({ formId }: { formId: string }) {
  const me = useMe();
  const listHref = useParentPath();
  const canManage = useCan('feedback:manage');
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<string | null>(null);

  const form = useQuery({
    queryKey: ['feedback', 'form', formId],
    queryFn: () => api<FeedbackFormDetail>(`/feedback/forms/${formId}`),
  });
  const results = useQuery({
    queryKey: ['feedback', 'results', formId, period],
    queryFn: () =>
      api<FeedbackResults>(`/feedback/forms/${formId}/results${period ? `?period=${period}` : ''}`),
  });
  const close = useMutation({
    mutationFn: () => api(`/feedback/forms/${formId}/close`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Closed. What was answered stays.');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The form could not be closed'),
  });

  if (form.isPending) return <LoadingRows rows={5} />;
  if (form.isError) return <ErrorState error={form.error} onRetry={() => form.refetch()} />;
  const detail = form.data;
  const status = FEEDBACK_STATUS[detail.status];

  return (
    <>
      <PageHeader
        back={{ href: listHref, label: 'All forms' }}
        eyebrow={`Feedback · ${detail.batch.code}`}
        title={detail.title}
        description={
          [detail.trainer?.name, detail.course?.title].filter(Boolean).join(' · ') ||
          'About the batch’s week'
        }
        meta={<StatusBadge status={detail.status} label={status.label} tone={status.tone} />}
        actions={
          canManage && detail.status !== 'closed' ? (
            <Button variant="outline" disabled={close.isPending} onClick={() => close.mutate()}>
              Close now
            </Button>
          ) : null
        }
      />

      {results.isPending ? <LoadingRows rows={4} /> : null}
      {results.isError ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : null}
      {results.data ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <StatStrip
              items={[
                { label: 'Answers', value: String(results.data.responses) },
                { label: 'Learners in the batch', value: String(results.data.audience) },
                {
                  label: 'Answered',
                  value:
                    results.data.audience === 0
                      ? '—'
                      : `${Math.round((results.data.responses / results.data.audience) * 100)}%`,
                },
              ]}
            />
            {detail.cadence === 'weekly' && results.data.periods.length > 0 ? (
              <div className="space-y-1">
                <Label htmlFor="fb-period">Round</Label>
                <NativeSelect
                  id="fb-period"
                  value={results.data.period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  {results.data.periods.some((p) => p.period === results.data.period) ? null : (
                    <option value={results.data.period}>Week of {results.data.period}</option>
                  )}
                  {results.data.periods.map((p) => (
                    <option key={p.period} value={p.period}>
                      Week of {p.period} ({p.responses})
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
          </div>

          {results.data.suppressed ? (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <EyeOff className="mt-0.5 size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Figures and comments appear once {FEEDBACK_MIN_RESPONSES} learners have answered
                this round, so nobody can be picked out.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {results.data.questions.map((question) => (
                <QuestionResult key={question.id} question={question} />
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {detail.anonymous ? 'Anonymous form. ' : 'Named form. '}
            Opened {formatDateTime(detail.opensAt, { timeZone: me.organization.timezone })}
            {detail.closesAt
              ? `; closes ${formatDateTime(detail.closesAt, { timeZone: me.organization.timezone })}`
              : ''}
            .
          </p>
        </div>
      ) : null}
    </>
  );
}

function QuestionResult({ question }: { question: FeedbackQuestionResult }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="font-medium">{question.prompt}</h3>
      {question.kind === 'rating' ? (
        <>
          <Meter
            label="Average"
            value={question.average === null ? null : (question.average / 5) * 100}
            detail={
              question.average === null
                ? 'No ratings yet'
                : `${question.average} of 5 from ${question.answered} answers`
            }
          />
          <ul className="space-y-1 text-sm" aria-label="How many gave each rating">
            {question.distribution.map((count, index) => (
              <li key={index} className="flex justify-between tabular-nums">
                <span>{index + 1}</span>
                <span className="text-muted-foreground">{count}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {question.kind === 'choice' ? (
        <ul className="space-y-1 text-sm">
          {question.choices.map((choice) => (
            <li key={choice.option} className="flex justify-between">
              <span>{choice.option}</span>
              <span className="tabular-nums text-muted-foreground">{choice.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {question.kind === 'text' ? (
        question.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments this round.</p>
        ) : (
          <ul className="space-y-2">
            {question.comments.map((comment, index) => (
              <li key={index} className="rounded-lg bg-surface-2 p-3 text-sm">
                {comment.text}
                {comment.name ? (
                  <span className="mt-1 block text-xs text-muted-foreground">— {comment.name}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
