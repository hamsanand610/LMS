'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, Download, ExternalLink, Info, Lock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ASSIGNMENT_KIND_LABELS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  type AssignmentResourceView,
  type LearnerAssignmentDetail,
  type LearnerModuleView,
  type LearnerQuestionRow,
} from '@lms/shared';
import { LoadingRows, ErrorState } from '@/components/page-states';
import { StatStrip } from '@/components/stat-strip';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import {
  daysFrom,
  formatDate,
  formatDateTime,
  formatRelativeDay,
  humanise,
  plural,
} from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { RichText } from '@/modules/workspace/statement';
import { PageHeader } from '@/shell/page-header';
import { AssignmentStatusBadge, ProgressBadge } from './status';

const EXPLANATION_TEXT = {
  after_solve: 'The worked answer appears once you solve a question, or use every attempt.',
  after_due: 'Worked answers appear after the due date.',
  never: 'Worked answers are not shown for this assignment.',
} as const;

/** One assignment for the learner: what it asks, the rules, and every question with where it stands. */
export function AssignmentOutline({ assignmentId }: { assignmentId: string }) {
  const now = useNow();
  const query = useQuery({
    queryKey: ['my-assignment', assignmentId],
    queryFn: () => api<LearnerAssignmentDetail>(`/me/assignments/${assignmentId}`),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const a = query.data;
  const days = a.dueAt && now !== null ? daysFrom(now, a.dueAt) : null;
  const canOpen = !['upcoming'].includes(a.status);

  return (
    <>
      <PageHeader
        back={{ href: '/assignments', label: 'All assignments' }}
        eyebrow={[humanise(a.technology || ''), ASSIGNMENT_KIND_LABELS[a.kind]]
          .filter(Boolean)
          .join(' · ')}
        title={a.title}
        description={a.description || undefined}
        meta={<AssignmentStatusBadge status={a.status} />}
        actions={
          a.next ? (
            <Button asChild size="lg">
              <Link href={`/assignments/${assignmentId}/q/${a.next.placementId}`}>
                {a.answered === 0 ? 'Start' : 'Continue'}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null
        }
      />

      <StatStrip
        className="mb-6"
        items={[
          { label: 'Answered', value: `${a.answered} / ${a.questionCount}` },
          {
            label: 'Marks',
            value: `${a.awardedMarks} / ${a.totalMarks}`,
            hint: `Pass mark ${a.passPercent}%`,
          },
          {
            label: a.status === 'upcoming' ? 'Opens' : 'Due',
            value:
              a.status === 'upcoming' && a.opensAt
                ? formatDate(a.opensAt)
                : a.dueAt
                  ? formatDate(a.dueAt)
                  : 'No date',
            hint:
              a.status === 'upcoming' && a.opensAt && now !== null
                ? formatRelativeDay(a.opensAt, now)
                : a.dueAt && now !== null
                  ? formatRelativeDay(a.dueAt, now)
                  : undefined,
            tone:
              a.status === 'overdue' || a.status === 'locked'
                ? 'danger'
                : days !== null && days <= 2 && days >= 0
                  ? 'warning'
                  : 'default',
          },
          {
            label: 'Time needed',
            value: a.estimatedMinutes > 0 ? `${a.estimatedMinutes} min` : '—',
            hint: 'An estimate',
          },
        ]}
      />

      {a.closedReason || a.status === 'overdue' ? (
        <p
          role="status"
          className={cn(
            'mb-6 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm',
            a.status === 'overdue'
              ? 'border-warning/30 bg-warning-soft text-warning'
              : 'border-border bg-surface-2 text-foreground-secondary',
          )}
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {a.status === 'overdue'
            ? 'The due date has passed. You can still answer; your trainer sees when each answer arrived.'
            : a.closedReason}
          {a.status === 'upcoming' && a.opensAt
            ? ` It opens on ${formatDateTime(a.opensAt)}.`
            : null}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ol className="flex min-w-0 flex-col gap-3" aria-label="Modules">
          {a.modules.map((module, index) => (
            <ModuleSection
              key={module.id}
              module={module}
              index={index}
              assignmentId={assignmentId}
              canOpen={canOpen}
              now={now}
            />
          ))}
        </ol>

        <aside className="space-y-4" aria-label="About this assignment">
          <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <h2 className="text-[15px] font-semibold">How it works</h2>
            {a.instructions ? (
              <RichText
                text={a.instructions}
                className="mt-3 space-y-2 text-sm leading-relaxed text-foreground-secondary"
              />
            ) : null}
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Attempts</dt>
                <dd>
                  {a.settings.attemptsPerQuestion === 0
                    ? 'As many as you like on each question'
                    : `${plural(a.settings.attemptsPerQuestion, 'attempt')} on each question`}
                  {a.settings.gradingMethod === 'latest'
                    ? '; your latest one counts'
                    : '; your best one counts'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">After the due date</dt>
                <dd>
                  {a.settings.duePolicy === 'block_late'
                    ? 'Answers are no longer accepted.'
                    : 'You can still answer; late answers are marked as late.'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Worked answers</dt>
                <dd>{EXPLANATION_TEXT[a.settings.explanationPolicy]}</dd>
              </div>
              {a.closesAt ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Closes</dt>
                  <dd>{formatDateTime(a.closesAt)}</dd>
                </div>
              ) : null}
            </dl>
          </section>
          {a.resources.length > 0 ? (
            <Resources assignmentId={assignmentId} resources={a.resources} />
          ) : null}
        </aside>
      </div>
    </>
  );
}

function ModuleSection({
  module,
  index,
  assignmentId,
  canOpen,
  now,
}: {
  module: LearnerModuleView;
  index: number;
  assignmentId: string;
  canOpen: boolean;
  now: number | null;
}) {
  const locked = !module.unlocked;
  const total = module.questions.length;
  const done = total > 0 && module.solved === total;
  return (
    <li>
      <details
        open={!locked}
        className={cn(
          'group/module overflow-hidden rounded-xl border bg-card shadow-xs',
          locked ? 'border-dashed border-border-strong/80' : 'border-border',
        )}
      >
        <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/50 [&::-webkit-details-marker]:hidden">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums',
              done
                ? 'bg-success-soft text-success'
                : locked
                  ? 'bg-surface-2 text-muted-foreground'
                  : 'bg-primary-soft text-brand',
            )}
          >
            {locked ? <Lock className="size-4" aria-label="Locked" /> : index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-foreground">{module.title}</span>
            <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span>
                {locked ? (module.lockReason ?? 'Locked') : `${module.solved} of ${total} solved`}
              </span>
              {module.topic ? <span>· {humanise(module.topic)}</span> : null}
              {module.dueAt ? (
                <span className={cn(module.overdue && 'text-danger')}>
                  · {module.overdue ? 'Was due' : 'Due'}{' '}
                  {now === null ? formatDate(module.dueAt) : formatRelativeDay(module.dueAt, now)}
                </span>
              ) : null}
            </span>
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/module:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-border">
          {module.description ? (
            <p className="border-b border-border/70 px-5 py-3 text-sm text-foreground-secondary">
              {module.description}
            </p>
          ) : null}
          {total === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              No questions in this module yet.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {module.questions.map((question) => (
                <QuestionRow
                  key={question.placementId}
                  question={question}
                  href={
                    locked || !canOpen
                      ? null
                      : `/assignments/${assignmentId}/q/${question.placementId}`
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

function QuestionRow({ question, href }: { question: LearnerQuestionRow; href: string | null }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{question.title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {QUESTION_TYPE_LABELS[question.type]} ·{' '}
          {DIFFICULTY_LABELS[question.difficulty] ?? question.difficulty}
          {question.attemptsLeft !== null && question.status !== 'correct'
            ? ` · ${plural(question.attemptsLeft, 'attempt')} left`
            : ''}
        </span>
      </span>
      <ProgressBadge status={question.status} className="hidden sm:inline-flex" />
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {question.awardedMarks} / {question.marks}
      </span>
    </>
  );
  if (!href) {
    return (
      <li className="flex items-center gap-3.5 px-5 py-3 text-sm text-muted-foreground">{body}</li>
    );
  }
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3.5 px-5 py-3 text-sm transition-colors hover:bg-surface-2/60"
      >
        {body}
      </Link>
    </li>
  );
}

function Resources({
  assignmentId,
  resources,
}: {
  assignmentId: string;
  resources: AssignmentResourceView[];
}) {
  const open = useMutation({
    mutationFn: (resourceId: string) =>
      api<{ url: string }>(`/me/assignments/${assignmentId}/resources/${resourceId}/link`),
    onSuccess: ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The file could not be opened'),
  });
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <h2 className="text-[15px] font-semibold">Resources</h2>
      <ul className="mt-3 space-y-2">
        {resources.map((resource) => (
          <li key={resource.id}>
            {resource.fileId ? (
              <button
                type="button"
                onClick={() => open.mutate(resource.id)}
                className="inline-flex items-center gap-2 text-left text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                <Download className="size-4 shrink-0" aria-hidden="true" />
                {resource.title}
                <span className="sr-only">(download {resource.fileName})</span>
              </button>
            ) : (
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                {resource.title}
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
