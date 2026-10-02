'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CircleCheck,
  CircleMinus,
  CircleX,
  FileClock,
  Lightbulb,
  MessageSquareText,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { AttemptResult, AttemptResultQuestion, TestCard } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { ProgressRing } from '@/components/progress-ring';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { InlineText } from '@/modules/workspace/statement';
import { PageHeader } from '@/shell/page-header';

const BACK = { href: '/tests', label: 'Your tests' };

const STATUS: Record<
  AttemptResultQuestion['status'],
  { label: string; icon: LucideIcon; className: string }
> = {
  correct: { label: 'Correct', icon: CircleCheck, className: 'bg-success-soft text-success' },
  partial: { label: 'Partly right', icon: CircleMinus, className: 'bg-warning-soft text-warning' },
  incorrect: { label: 'Incorrect', icon: CircleX, className: 'bg-danger-soft text-danger' },
  awaiting_grading: {
    label: 'Awaiting marking',
    icon: FileClock,
    className: 'bg-info-soft text-info',
  },
  evaluating: { label: 'Being checked', icon: FileClock, className: 'bg-info-soft text-info' },
  error: {
    label: 'Not checked yet',
    icon: FileClock,
    className: 'bg-surface-2 text-foreground-secondary',
  },
};

/** What a learner sees after a test: their score, and the review their trainer allowed. */
export function TestResult({ testId, attemptId }: { testId: string; attemptId?: string }) {
  const cards = useQuery({
    queryKey: ['my-tests'],
    queryFn: () => api<TestCard[]>('/me/tests'),
  });
  const card = cards.data?.find((t) => t.testId === testId);
  // The attempt in the address, else the newest one that has been handed in.
  const attempts = card?.attempts ?? [];
  const selected =
    attempts.find((a) => a.attemptId === attemptId) ??
    attempts.find((a) => a.status !== 'in_progress') ??
    attempts[0] ??
    null;

  const result = useQuery({
    queryKey: ['attempt-result', selected?.attemptId],
    queryFn: () => api<AttemptResult>(`/attempts/${selected?.attemptId}/result`),
    enabled: Boolean(selected) && selected?.status !== 'in_progress',
  });

  if (cards.isPending) return <LoadingRows rows={5} />;
  if (cards.isError) return <ErrorState error={cards.error} onRetry={() => cards.refetch()} />;
  if (!card?.attemptId || !selected) {
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
  if (selected.status === 'in_progress') {
    return (
      <EmptyState
        title="Your paper is still open"
        description="Finish and submit it; its result appears here afterwards."
        action={
          <Button asChild>
            <Link href={`/tests/${testId}/attempt?attempt=${selected.attemptId}`}>
              Carry on with the paper
            </Link>
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
        <PageHeader
          back={BACK}
          eyebrow="Result"
          title={attempt.title}
          description="Your paper is in."
        />
        <section className="max-w-xl rounded-xl border border-border bg-card p-6">
          <div className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-info-soft text-info">
              <FileClock className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-2">
              <h2 className="text-base font-semibold text-foreground">Results are not out yet</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                You submitted on{' '}
                {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : 'this test'}. Your
                trainer releases the results once every written answer has been marked.
              </p>
              {attempt.pendingGrading > 0 ? (
                <p className="text-sm text-foreground-secondary">
                  <span className="font-semibold tabular-nums">{attempt.pendingGrading}</span> of
                  your answers still need a person to read them.
                </p>
              ) : null}
              <Button asChild variant="outline" className="mt-2">
                <Link href="/tests">Back to your tests</Link>
              </Button>
            </div>
          </div>
        </section>
      </>
    );
  }

  const breakdown = attempt.sections.length > 0 || attempt.questions.length > 0;
  const tally = attempt.questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.status] = (acc[q.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        back={BACK}
        eyebrow="Result"
        title={attempt.title}
        description={
          attempt.submittedAt ? `Submitted on ${formatDateTime(attempt.submittedAt)}` : undefined
        }
      />

      {attempts.length > 1 ? (
        <nav aria-label="Your attempts" className="-mt-2 mb-6 flex flex-wrap gap-2">
          {attempts.map((entry) => (
            <Link
              key={entry.attemptId}
              href={`/tests/${testId}/result?attempt=${entry.attemptId}`}
              aria-current={entry.attemptId === selected.attemptId ? 'page' : undefined}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors',
                entry.attemptId === selected.attemptId
                  ? 'border-primary bg-primary-soft text-brand'
                  : 'border-border text-foreground-secondary hover:bg-surface-2',
              )}
            >
              Attempt {entry.attempt}
              {entry.status === 'in_progress' ? ' · open' : ''}
            </Link>
          ))}
        </nav>
      ) : null}

      <section
        aria-label="Your score"
        className={cn(
          'grid gap-px overflow-hidden rounded-xl border border-border bg-border',
          breakdown ? 'lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]' : 'max-w-md',
        )}
      >
        <div className="flex items-center gap-5 bg-card px-6 py-6">
          <ProgressRing
            value={attempt.percentage}
            size={104}
            stroke={9}
            label={`You scored ${attempt.percentage}%`}
          />
          <div className="min-w-0">
            <p className="eyebrow">Your score</p>
            <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums">
              {attempt.score}
              <span className="text-lg font-medium text-muted-foreground">
                {' '}
                / {attempt.totalMarks}
              </span>
            </p>
            {attempt.rank ? (
              <p className="mt-1 text-sm text-foreground-secondary tabular-nums">
                Rank <span className="font-semibold text-foreground">{attempt.rank}</span> of{' '}
                {attempt.cohortSize}
              </p>
            ) : null}
          </div>
        </div>

        <div className={cn('bg-card px-6 py-5', !breakdown && 'hidden')}>
          {attempt.sections.length > 0 ? (
            <>
              <p className="eyebrow">By section</p>
              <ul className="mt-3 space-y-3.5">
                {attempt.sections.map((section) => {
                  const pct =
                    section.totalMarks > 0
                      ? Math.round((section.score / section.totalMarks) * 100)
                      : 0;
                  return (
                    <li key={section.id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate text-foreground-secondary">{section.title}</span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {section.score} / {section.totalMarks}
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        tone="achievement"
                        aria-label={`${section.title}: ${section.score} of ${section.totalMarks}`}
                        className="mt-1.5 h-1.5"
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          ) : attempt.questions.length > 0 ? (
            <>
              <p className="eyebrow">Question by question</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(STATUS) as AttemptResultQuestion['status'][])
                  .filter((key) => tally[key])
                  .map((key) => {
                    const { label, icon: Icon, className } = STATUS[key];
                    return (
                      <li
                        key={key}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                          className,
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden="true" />
                        <span className="tabular-nums">{tally[key]}</span> {label.toLowerCase()}
                      </li>
                    );
                  })}
              </ul>
            </>
          ) : null}
        </div>
      </section>

      {attempt.reviewPolicy === 'full' && attempt.questions.length > 0 ? (
        <section aria-labelledby="answers-heading" className="mt-10">
          <h2 id="answers-heading" className="text-lg font-semibold tracking-tight">
            Your answers
          </h2>
          <ol className="mt-4 space-y-4">
            {attempt.questions.map((question, index) => (
              <ReviewItem key={question.testQuestionId} question={question} number={index + 1} />
            ))}
          </ol>
        </section>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">
          {attempt.reviewOpensAt
            ? `The answers are shown once the test closes for everyone, on ${formatDateTime(attempt.reviewOpensAt)}, so nobody still sitting it can see them.`
            : attempt.reviewPolicy === 'score_only'
              ? 'Your trainer has released the score but not the paper.'
              : 'Your trainer has not released the paper for review.'}
        </p>
      )}
    </>
  );
}

function ReviewItem({ question, number }: { question: AttemptResultQuestion; number: number }) {
  const status = STATUS[question.status];
  const Icon = status.icon;
  return (
    <li className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-5 py-3 sm:px-6">
        <p className="eyebrow">Question {number}</p>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium',
            status.className,
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {status.label}
        </span>
        <p className="ml-auto text-sm font-semibold tabular-nums">
          {question.awardedMarks}
          <span className="font-normal text-muted-foreground"> / {question.marks}</span>
          <span className="sr-only"> marks</span>
        </p>
      </div>
      <div className="space-y-3 px-5 py-4 sm:px-6">
        <h3 className="text-[15px] leading-snug font-semibold text-foreground">{question.title}</h3>
        {question.body ? (
          <p className="max-w-(--reading-max) text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {question.body}
          </p>
        ) : null}
        {question.options && question.options.length > 0 ? (
          <ul className="space-y-1.5" aria-label="Options">
            {question.options.map((option) => {
              const chosen = question.yourOptionIds?.includes(option.id) ?? false;
              const right = question.correctOptionIds?.includes(option.id) ?? false;
              return (
                <li
                  key={option.id}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                    right
                      ? 'border-success/40 bg-success-soft/50'
                      : chosen
                        ? 'border-danger/40 bg-danger-soft/50'
                        : 'border-border',
                  )}
                >
                  {right ? (
                    <CircleCheck
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden="true"
                    />
                  ) : chosen ? (
                    <CircleX className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <InlineText text={option.body} />
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {[chosen ? 'your choice' : '', right ? 'correct' : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {question.yourText ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Your answer</p>
            <div className="rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
              {question.yourText}
            </div>
          </div>
        ) : null}
        {question.graderComment ? (
          <Note icon={MessageSquareText} title="Your trainer said">
            {question.graderComment}
          </Note>
        ) : null}
        {question.explanation ? (
          <Note icon={Lightbulb} title="Why">
            <InlineText text={question.explanation} />
          </Note>
        ) : null}
      </div>
    </li>
  );
}

function Note({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm leading-relaxed">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="min-w-0 whitespace-pre-wrap text-foreground-secondary">
        <span className="font-medium text-foreground">{title}: </span>
        {children}
      </p>
    </div>
  );
}
