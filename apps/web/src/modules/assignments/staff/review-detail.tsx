'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  ExternalLink,
  FileText,
  MessageSquareText,
  RotateCw,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  EXECUTED_TYPES,
  LANGUAGE_LABELS,
  OBJECTIVE_TYPES,
  QUESTION_TYPE_LABELS,
  REVIEW_DECISION_LABELS,
  VERDICT_LABELS,
  type Paginated,
  type ReviewDecision,
  type ReviewInput,
  type ReviewQueueItem,
  type SubmissionView,
} from '@lms/shared';
import { CodeEditor } from '@/components/code-editor';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { InlineText, RichText } from '@/modules/workspace/statement';
import { CaseRow, CompileOutput, Figures } from '@/modules/workspace/result-view';
import { PageHeader } from '@/shell/page-header';
import { VerdictBadge } from '../status';
import { StaffProgressBadge, type StaffPortal } from './review-queue';

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn('rounded-xl border border-border bg-card p-5', className)}
    >
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const DECISIONS: { value: ReviewDecision; label: string; hint: string }[] = [
  { value: 'graded', label: 'Give marks', hint: 'You set the marks.' },
  { value: 'approved', label: 'Approve', hint: 'Accept it as it stands.' },
  {
    value: 'resubmission_requested',
    label: 'Ask for another attempt',
    hint: 'They get one more try.',
  },
];

/**
 * One answer as its reviewer sees it: what was submitted, how the sandbox judged it (every case,
 * hidden ones included), the mark scheme, and the decision. A decision is added to the record;
 * nothing the learner submitted, and no earlier decision, is changed.
 */
export function ReviewDetail({
  submissionId,
  portal,
}: {
  submissionId: string;
  portal: StaffPortal;
}) {
  const query = useQuery({
    queryKey: ['staff-submission', submissionId],
    queryFn: () => api<SubmissionView>(`/submissions/${submissionId}`),
    refetchInterval: (q) => (q.state.data?.status === 'evaluating' ? 2000 : false),
  });
  const waiting = useQuery({
    queryKey: ['review-queue', 'next'],
    queryFn: () => api<Paginated<ReviewQueueItem>>('/submissions?state=pending&pageSize=2'),
  });
  const next = waiting.data?.data.find((item) => item.submissionId !== submissionId) ?? null;

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const submission = query.data;
  const context = submission.reviewContext;
  const executed = EXECUTED_TYPES.includes(submission.questionType);
  const objective = OBJECTIVE_TYPES.includes(submission.questionType);

  return (
    <>
      <PageHeader
        back={{ href: `/${portal}/reviews`, label: 'All reviews' }}
        eyebrow={context?.assignmentTitle || 'Review'}
        title={submission.questionTitle}
        meta={
          <>
            {submission.student ? (
              <span className="font-medium text-foreground">
                {submission.student.name}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {submission.student.code}
                </span>
              </span>
            ) : null}
            <span>{QUESTION_TYPE_LABELS[submission.questionType]}</span>
            <span>Attempt {submission.attempt}</span>
            <span className="tabular-nums">Submitted {formatDateTime(submission.submittedAt)}</span>
            {submission.isLate ? (
              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                Late
              </span>
            ) : null}
            <StaffProgressBadge status={submission.status} />
          </>
        }
        actions={
          next ? (
            <Button asChild variant="outline">
              <Link href={`/${portal}/reviews/${next.submissionId}`}>
                Next waiting answer
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Section title="The answer">
            <Answer submission={submission} />
          </Section>
          {executed ? (
            <Section title="How it ran">
              <Evaluation submission={submission} />
            </Section>
          ) : null}
          {objective && context ? (
            <Section title="The options">
              <ul className="space-y-1.5">
                {context.options.map((option) => {
                  const chosen = submission.optionIds.includes(option.id);
                  return (
                    <li
                      key={option.id}
                      className={cn(
                        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
                        option.isCorrect ? 'border-success/40 bg-success-soft/40' : 'border-border',
                      )}
                    >
                      {option.isCorrect ? (
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-success"
                          aria-label="Correct option"
                        />
                      ) : (
                        <X
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-label="Wrong option"
                        />
                      )}
                      <span className="min-w-0 flex-1">{option.body}</span>
                      {chosen ? (
                        <span className="text-xs font-semibold text-foreground">Chosen</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}
          {context?.body ? (
            <details className="group rounded-xl border border-border bg-card p-5">
              <summary className="cursor-pointer text-base font-semibold">
                The question as set
              </summary>
              <div className="mt-3">
                <RichText text={context.body} />
              </div>
            </details>
          ) : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start" aria-label="Decision">
          <DecisionPanel
            key={`${submission.id}:${submission.reviews.length}`}
            submission={submission}
          />
          {context?.rubric ? (
            <Section title="Mark scheme">
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground-secondary">
                <InlineText text={context.rubric} />
              </p>
            </Section>
          ) : null}
          <Section title="Decisions so far">
            {submission.reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ol className="space-y-3">
                {[...submission.reviews].reverse().map((review) => (
                  <li key={review.id} className="border-l-2 border-info/50 pl-3">
                    <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-info">
                      <MessageSquareText className="size-3.5" aria-hidden="true" />
                      {REVIEW_DECISION_LABELS[review.decision]}
                      {review.marks !== null ? (
                        <span>· {formatNumber(review.marks)} marks</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {review.reviewerName ?? 'A reviewer'} · {formatDateTime(review.createdAt)}
                    </p>
                    {review.comment ? (
                      <p className="mt-1 text-sm whitespace-pre-line">{review.comment}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Section>
          {context && context.attempts.length > 1 ? (
            <Section title="Every attempt">
              <ol className="space-y-1">
                {context.attempts.map((attempt) => {
                  const current = attempt.id === submission.id;
                  return (
                    <li key={attempt.id}>
                      <Link
                        href={`/${portal}/reviews/${attempt.id}`}
                        aria-current={current ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2',
                          current && 'bg-primary-soft font-medium text-brand hover:bg-primary-soft',
                        )}
                      >
                        <span className="min-w-16 shrink-0 whitespace-nowrap">
                          Attempt {attempt.attempt}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {formatDateTime(attempt.submittedAt)}
                        </span>
                        <span className="text-xs tabular-nums">
                          {attempt.marks} / {attempt.maxMarks}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </Section>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function Answer({ submission }: { submission: SubmissionView }) {
  const context = submission.reviewContext;
  const openFile = async (fileId: string) => {
    try {
      const { url } = await api<{ url: string }>(
        `/submissions/${submission.id}/files/${fileId}/link`,
      );
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'The file could not be opened');
    }
  };

  if (EXECUTED_TYPES.includes(submission.questionType)) {
    const lines = submission.code.split('\n').length;
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {submission.language ? LANGUAGE_LABELS[submission.language] : 'Code'} · {lines}{' '}
          {lines === 1 ? 'line' : 'lines'}
        </p>
        <div className="overflow-hidden rounded-lg border border-border">
          <CodeEditor
            value={submission.code}
            language={submission.language ?? 'java'}
            label={`Code submitted in attempt ${submission.attempt}`}
            readOnly
            className="h-[min(28rem,60dvh)]"
          />
        </div>
      </div>
    );
  }

  if (OBJECTIVE_TYPES.includes(submission.questionType)) {
    return (
      <p className="text-sm text-muted-foreground">
        Marked automatically: {submission.marks} of {submission.maxMarks}. The options below show
        what was chosen.
      </p>
    );
  }

  const words = submission.text.trim() ? submission.text.trim().split(/\s+/).length : 0;
  return (
    <div className="space-y-4">
      {submission.links.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            {context?.spec.linkLabel || 'Links'}
          </p>
          <ul className="space-y-1 text-sm">
            {submission.links.map((link) => (
              <li key={link}>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 break-all text-brand underline-offset-4 hover:underline"
                >
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {submission.files.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Files</p>
          <ul className="space-y-1.5">
            {submission.files.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.max(1, Math.round(file.size / 1024))} KB
                </span>
                <Button variant="ghost" size="sm" onClick={() => void openFile(file.id)}>
                  Open
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {context && context.spec.checklist.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">What they confirmed</p>
          <ul className="space-y-1 text-sm">
            {context.spec.checklist.map((point, index) => {
              const confirmed = submission.checklist.includes(index);
              return (
                <li key={point} className="flex items-start gap-2">
                  {confirmed ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="Confirmed" />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Not confirmed" />
                  )}
                  <span className={confirmed ? undefined : 'text-muted-foreground'}>{point}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {submission.text ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            {submission.questionType === 'descriptive'
              ? `Written answer · ${words} words`
              : 'Notes'}
          </p>
          <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-border bg-surface-2/40 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
            {submission.text}
          </div>
        </div>
      ) : submission.links.length === 0 && submission.files.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing was written.</p>
      ) : null}
    </div>
  );
}

function Evaluation({ submission }: { submission: SubmissionView }) {
  const queryClient = useQueryClient();
  const sql = submission.questionType === 'sql';
  const again = useMutation({
    mutationFn: () =>
      api<SubmissionView>(`/submissions/${submission.id}/re-evaluate`, { method: 'POST' }),
    onSuccess: (result) => {
      queryClient.setQueryData(['staff-submission', submission.id], result);
      toast.success('Sent to the sandbox again');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'It could not be sent again'),
  });

  if (submission.status === 'evaluating') {
    return (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Running against every case in the sandbox. This page updates when it finishes.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {submission.verdict ? <VerdictBadge verdict={submission.verdict} /> : null}
        <span className="text-sm text-muted-foreground">
          {submission.autoMarks !== null
            ? `The sandbox gave ${formatNumber(submission.autoMarks)} of ${submission.maxMarks} marks.`
            : null}
        </span>
      </div>
      {submission.evaluationError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">{submission.evaluationError}</span>
          {submission.status === 'error' ? (
            <Button
              size="sm"
              variant="outline"
              disabled={again.isPending}
              onClick={() => again.mutate()}
            >
              <RotateCw aria-hidden="true" />
              Check it again
            </Button>
          ) : null}
        </div>
      ) : null}
      {submission.cases.length > 0 ? (
        <>
          <Figures
            passed={submission.passed}
            total={submission.total}
            durationMs={submission.durationMs}
            memoryKb={submission.memoryKb}
          />
          <CompileOutput text={submission.compileOutput} />
          <ul className="space-y-2">
            {submission.cases.map((outcome) => (
              <CaseRow
                key={outcome.testCaseId ?? outcome.number}
                outcome={outcome}
                sql={sql}
                actualLabel="Their output"
              />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Hidden cases are shown to reviewers only; the learner sees their verdicts, never their
            contents.
          </p>
        </>
      ) : submission.verdict ? (
        <p className="text-sm text-muted-foreground">{VERDICT_LABELS[submission.verdict]}</p>
      ) : null}
    </div>
  );
}

function DecisionPanel({ submission }: { submission: SubmissionView }) {
  const queryClient = useQueryClient();
  const waitingForPerson = submission.status === 'awaiting_review';
  const [decision, setDecision] = useState<ReviewDecision>(
    waitingForPerson ? 'graded' : 'approved',
  );
  const [marks, setMarks] = useState(waitingForPerson ? '' : String(submission.marks));
  const [comment, setComment] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: ReviewInput) =>
      api<SubmissionView>(`/submissions/${submission.id}/reviews`, { method: 'POST', body }),
    onSuccess: async (result) => {
      queryClient.setQueryData(['staff-submission', submission.id], result);
      await queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['assignment', result.assignmentId] });
      toast.success(
        result.reviews.at(-1)?.decision === 'resubmission_requested'
          ? 'Another attempt asked for. The learner has been told.'
          : 'Decision saved. The learner has been told.',
      );
    },
    onError: (error) =>
      setProblem(isApiError(error) ? error.message : 'The decision could not be saved'),
  });

  if (submission.status === 'evaluating') {
    return (
      <Section title="Your decision">
        <p className="text-sm text-muted-foreground">
          You can decide once the sandbox has a result.
        </p>
      </Section>
    );
  }

  const submit = () => {
    const value = marks.trim() === '' ? null : Number(marks);
    if (value !== null && (Number.isNaN(value) || value < 0 || value > submission.maxMarks)) {
      setProblem(`Give between 0 and ${submission.maxMarks} marks`);
      return;
    }
    if (decision === 'graded' && value === null) {
      setProblem('Give the marks');
      return;
    }
    if (decision === 'resubmission_requested' && !comment.trim()) {
      setProblem('Say what should change');
      return;
    }
    setProblem(null);
    save.mutate({
      decision,
      marks: decision === 'resubmission_requested' ? null : value,
      comment: comment.trim(),
    });
  };

  return (
    <Section title="Your decision">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <fieldset className="space-y-1.5">
          <legend className="sr-only">Decision</legend>
          {DECISIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm',
                decision === option.value
                  ? 'border-primary bg-primary-soft/50'
                  : 'border-border hover:bg-surface-2',
              )}
            >
              <input
                type="radio"
                name="decision"
                value={option.value}
                checked={decision === option.value}
                onChange={() => setDecision(option.value)}
                className="mt-1 size-4 accent-primary"
              />
              <span>
                <span className="font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {decision !== 'resubmission_requested' ? (
          <div className="space-y-1.5">
            <Label htmlFor="review-marks">
              Marks{' '}
              <span className="font-normal text-muted-foreground">
                (out of {submission.maxMarks})
              </span>
            </Label>
            <Input
              id="review-marks"
              type="number"
              inputMode="decimal"
              min={0}
              max={submission.maxMarks}
              step={0.5}
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              placeholder={
                decision === 'approved'
                  ? waitingForPerson
                    ? `${submission.maxMarks}`
                    : String(submission.marks)
                  : ''
              }
              aria-describedby={decision === 'approved' ? 'review-marks-hint' : undefined}
            />
            {decision === 'approved' ? (
              <p id="review-marks-hint" className="text-xs text-muted-foreground">
                {waitingForPerson
                  ? 'Left empty, approving gives full marks.'
                  : `Left empty, the ${formatNumber(submission.marks)} marks it has stand.`}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="review-comment">
            Comment for the learner
            {decision === 'resubmission_requested' ? null : (
              <span className="font-normal text-muted-foreground"> (optional)</span>
            )}
          </Label>
          <Textarea
            id="review-comment"
            rows={4}
            maxLength={4000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              decision === 'resubmission_requested'
                ? 'What should change in the next attempt'
                : 'What was good, and what to look at'
            }
          />
        </div>
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save decision'}
        </Button>
        <p className="text-xs text-muted-foreground">
          The decision is added to the record. The answer itself and earlier decisions are never
          changed.
        </p>
      </form>
    </Section>
  );
}
