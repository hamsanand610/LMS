'use client';

import { useMutation } from '@tanstack/react-query';
import {
  ChevronDown,
  Clock,
  Cpu,
  ExternalLink,
  FileDown,
  Lock,
  MessageSquareText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  REVIEW_DECISION_LABELS,
  VERDICT_LABELS,
  type CaseOutcome,
  type RunOutcome,
  type SubmissionView,
} from '@lms/shared';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ProgressBadge, VerdictBadge } from '@/modules/assignments/status';
import { ResultTable } from './result-table';
import { InlineText } from './statement';

export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

export function formatMemory(kb: number | null): string {
  if (kb === null || kb === 0) return '—';
  return kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

/** An output shown as text, or as a result table when it is one (SQL). */
function Output({ label, text, sql }: { label: string; text: string; sql: boolean }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {sql && text.trim().startsWith('{') ? (
        <ResultTable json={text} />
      ) : (
        <pre className="max-h-48 overflow-auto rounded-md border border-border bg-surface-2/70 px-3 py-2 font-mono text-[12.5px] leading-5 whitespace-pre text-foreground">
          {text === '' ? <span className="text-muted-foreground">(empty)</span> : text}
        </pre>
      )}
    </div>
  );
}

/** One case: its verdict and cost; for a visible case, what went in, what was expected and what came out. */
export function CaseRow({
  outcome,
  sql,
  actualLabel = 'Your output',
}: {
  outcome: CaseOutcome;
  sql: boolean;
  /** Reviewers read someone else's output. */
  actualLabel?: string;
}) {
  const expandable = !outcome.hidden || outcome.input !== undefined;
  return (
    <li className="rounded-lg border border-border bg-card">
      <details className="group/case" open={!outcome.passed && expandable && !outcome.hidden}>
        <summary
          className={cn(
            'flex list-none items-center gap-3 px-3.5 py-2.5 text-sm [&::-webkit-details-marker]:hidden',
            expandable ? 'cursor-pointer' : 'cursor-default',
          )}
          onClick={(event) => {
            if (!expandable) event.preventDefault();
          }}
        >
          <span className="min-w-0 flex-1 truncate font-medium">
            {outcome.hidden ? (
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {outcome.label}
                <span className="text-xs font-normal text-muted-foreground">(hidden)</span>
              </span>
            ) : (
              outcome.label
            )}
          </span>
          <VerdictBadge verdict={outcome.verdict} />
          <span className="hidden w-16 text-right text-xs text-muted-foreground tabular-nums sm:inline">
            {formatDuration(outcome.durationMs)}
          </span>
          {expandable ? (
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open/case:rotate-180"
              aria-hidden="true"
            />
          ) : (
            <span className="size-4" aria-hidden="true" />
          )}
        </summary>
        {expandable ? (
          <div className="space-y-3 border-t border-border px-3.5 py-3">
            {outcome.input !== undefined && outcome.input !== '' ? (
              <Output
                label={sql ? 'Extra rows for this case' : 'Input'}
                text={outcome.input}
                sql={false}
              />
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {outcome.expectedOutput !== undefined ? (
                <Output label="Expected" text={outcome.expectedOutput} sql={sql} />
              ) : null}
              {outcome.actualOutput !== undefined ? (
                <Output label={actualLabel} text={outcome.actualOutput} sql={sql} />
              ) : null}
            </div>
            {outcome.stderr ? <Output label="Errors" text={outcome.stderr} sql={false} /> : null}
            {outcome.explanation ? (
              <p className="text-xs text-muted-foreground">
                <InlineText text={outcome.explanation} />
              </p>
            ) : null}
          </div>
        ) : null}
      </details>
    </li>
  );
}

export function Figures({
  passed,
  total,
  durationMs,
  memoryKb,
}: {
  passed: number;
  total: number;
  durationMs: number | null;
  memoryKb: number | null;
}) {
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
      {total > 0 ? (
        <div className="flex gap-1">
          <dt>Cases passed</dt>
          <dd className="font-semibold text-foreground tabular-nums">
            {passed} / {total}
          </dd>
        </div>
      ) : null}
      <div className="flex items-center gap-1">
        <dt className="inline-flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden="true" />
          Time
        </dt>
        <dd className="text-foreground tabular-nums">{formatDuration(durationMs)}</dd>
      </div>
      <div className="flex items-center gap-1">
        <dt className="inline-flex items-center gap-1">
          <Cpu className="size-3.5" aria-hidden="true" />
          Memory
        </dt>
        <dd className="text-foreground tabular-nums">{formatMemory(memoryKb)}</dd>
      </div>
    </dl>
  );
}

export function CompileOutput({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-danger">The compiler said</p>
      <pre className="max-h-56 overflow-auto rounded-md border border-danger/30 bg-danger-soft/50 px-3 py-2 font-mono text-[12.5px] leading-5 whitespace-pre text-foreground">
        {text}
      </pre>
    </div>
  );
}

/** What a Run came back with: the visible cases, or the output for the learner's own input. */
export function RunResult({ run, sql }: { run: RunOutcome; sql: boolean }) {
  const passedAll = run.total > 0 && run.passed === run.total;
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        {run.output ? (
          <p className="text-sm font-semibold">
            {run.verdict === 'passed' ? 'Your code ran' : VERDICT_LABELS[run.verdict]}
          </p>
        ) : (
          <p className="text-sm font-semibold">
            {run.verdict === 'compile_error'
              ? 'It does not compile yet'
              : passedAll
                ? 'Every visible case passed'
                : `${run.total - run.passed} of ${run.total} visible cases did not pass`}
          </p>
        )}
        <VerdictBadge verdict={run.verdict} />
      </div>
      <Figures
        passed={run.passed}
        total={run.total}
        durationMs={run.durationMs}
        memoryKb={run.memoryKb}
      />
      <CompileOutput text={run.compileOutput} />
      {run.output ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Output label="Your output" text={run.output.stdout} sql={sql} />
          {run.output.stderr ? (
            <Output label="Errors" text={run.output.stderr} sql={false} />
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {run.cases.map((outcome) => (
            <CaseRow key={outcome.testCaseId ?? outcome.number} outcome={outcome} sql={sql} />
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        A run checks the visible cases only and is not recorded. Submit to be marked against every
        case.
      </p>
    </div>
  );
}

/** One submission's outcome: status, marks, cases and any reviewer's feedback. */
export function SubmissionResultView({
  submission,
  sql,
}: {
  submission: SubmissionView;
  sql: boolean;
}) {
  const evaluating = submission.status === 'evaluating';
  return (
    <div className="space-y-3" aria-live="polite" aria-busy={evaluating}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold">
          Attempt {submission.attempt}
          <span className="font-normal text-muted-foreground">
            {' '}
            · {formatDateTime(submission.submittedAt)}
          </span>
        </p>
        <ProgressBadge status={submission.status} />
        {submission.isLate ? (
          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
            Late
          </span>
        ) : null}
        {submission.verdict && submission.verdict !== 'pending' ? (
          <VerdictBadge verdict={submission.verdict} />
        ) : null}
        <span className="ml-auto text-sm font-semibold tabular-nums">
          {submission.marks} / {submission.maxMarks}
          <span className="text-xs font-normal text-muted-foreground"> marks</span>
        </span>
      </div>
      {evaluating ? (
        <p className="text-sm text-muted-foreground">
          Your answer is being run against every case, the hidden ones included. This usually takes
          a few seconds.
        </p>
      ) : null}
      {submission.evaluationError ? (
        <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground-secondary">
          {submission.evaluationError}
        </p>
      ) : null}
      {!evaluating && submission.cases.length > 0 ? (
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
              <CaseRow key={outcome.testCaseId ?? outcome.number} outcome={outcome} sql={sql} />
            ))}
          </ul>
        </>
      ) : null}
      {submission.status === 'awaiting_review' ? (
        <p className="text-sm text-muted-foreground">
          Your trainer will review this answer and mark it.
        </p>
      ) : null}
      <HandedIn submission={submission} />
      <Feedback submission={submission} />
      {submission.explanation ? (
        <div className="rounded-lg border border-success/30 bg-success-soft/50 px-4 py-3">
          <p className="text-xs font-semibold text-success">Worked answer</p>
          <p className="mt-1 text-sm whitespace-pre-line text-foreground">
            <InlineText text={submission.explanation} />
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** The links and files the learner handed in, so they can check exactly what was sent. */
function HandedIn({ submission }: { submission: SubmissionView }) {
  if (submission.links.length === 0 && submission.files.length === 0) return null;
  return (
    <section aria-label="What you handed in" className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">What you handed in</p>
      <ul className="space-y-1.5">
        {submission.links.map((link) => (
          <li key={link} className="min-w-0 text-sm">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 text-brand hover:underline"
            >
              <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{link}</span>
            </a>
          </li>
        ))}
        {submission.files.map((file) => (
          <HandedInFile key={file.id} submissionId={submission.id} file={file} />
        ))}
      </ul>
    </section>
  );
}

function HandedInFile({
  submissionId,
  file,
}: {
  submissionId: string;
  file: SubmissionView['files'][number];
}) {
  // A short-lived signed link, opened in this tab: the file arrives as a download.
  const download = useMutation({
    mutationFn: () => api<{ url: string }>(`/me/submissions/${submissionId}/files/${file.id}/link`),
    onSuccess: (result) => window.location.assign(result.url),
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'That file could not be downloaded'),
  });
  return (
    <li>
      <button
        type="button"
        onClick={() => download.mutate()}
        disabled={download.isPending}
        className="inline-flex max-w-full items-center gap-1.5 text-sm text-brand hover:underline disabled:opacity-60"
      >
        <FileDown className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{file.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {Math.max(1, Math.round(file.size / 1024))} KB
        </span>
      </button>
    </li>
  );
}

export function Feedback({ submission }: { submission: SubmissionView }) {
  if (submission.reviews.length === 0) return null;
  return (
    <section aria-label="Feedback" className="space-y-2">
      {[...submission.reviews].reverse().map((review) => (
        <div key={review.id} className="rounded-lg border border-info/30 bg-info-soft/40 px-4 py-3">
          <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-info">
            <MessageSquareText className="size-3.5" aria-hidden="true" />
            {REVIEW_DECISION_LABELS[review.decision]}
            {review.marks !== null ? <span>· {review.marks} marks</span> : null}
            <span className="font-normal text-muted-foreground">
              {review.reviewerName ? `by ${review.reviewerName} · ` : ''}
              {formatDateTime(review.createdAt)}
            </span>
          </p>
          {review.comment ? (
            <p className="mt-1.5 text-sm whitespace-pre-line text-foreground">{review.comment}</p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
