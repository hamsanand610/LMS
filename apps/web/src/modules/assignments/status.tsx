import {
  Code2,
  Database,
  FileUp,
  FolderKanban,
  Layers,
  ListChecks,
  PenLine,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import {
  ASSIGNMENT_KIND_LABELS,
  LEARNER_STATUS_LABELS,
  VERDICT_LABELS,
  type AssignmentKind,
  type ExecutionVerdict,
  type LearnerAssignmentStatus,
  type QuestionProgress,
} from '@lms/shared';
import { StatusBadge, type StatusTone } from '@/components/status-badge';

/**
 * How the assignment vocabulary looks. The brief's colour rules: done is green, under way is the
 * brand's burgundy, still to come is gold, overdue is red; every chip also carries its word.
 */
export const STATUS_TONE: Record<LearnerAssignmentStatus, StatusTone> = {
  upcoming: 'upcoming',
  not_started: 'neutral',
  in_progress: 'brand',
  submitted: 'info',
  passed: 'success',
  completed: 'success',
  failed: 'warning',
  overdue: 'danger',
  locked: 'neutral',
};

export function AssignmentStatusBadge({
  status,
  className,
}: {
  status: LearnerAssignmentStatus;
  className?: string;
}) {
  return (
    <StatusBadge
      status={status}
      label={LEARNER_STATUS_LABELS[status]}
      tone={STATUS_TONE[status]}
      className={className}
    />
  );
}

export const PROGRESS_LABELS: Record<QuestionProgress, string> = {
  not_attempted: 'Not attempted',
  evaluating: 'Checking',
  awaiting_review: 'Waiting for review',
  correct: 'Solved',
  partial: 'Partly right',
  incorrect: 'Not right yet',
  resubmit: 'Try again',
  error: 'Not checked',
};

const PROGRESS_TONE: Record<QuestionProgress, StatusTone> = {
  not_attempted: 'neutral',
  evaluating: 'info',
  awaiting_review: 'info',
  correct: 'success',
  partial: 'warning',
  incorrect: 'danger',
  resubmit: 'warning',
  error: 'neutral',
};

export function ProgressBadge({
  status,
  className,
}: {
  status: QuestionProgress;
  className?: string;
}) {
  return (
    <StatusBadge
      status={status}
      label={PROGRESS_LABELS[status]}
      tone={PROGRESS_TONE[status]}
      className={className}
    />
  );
}

const VERDICT_TONE: Record<ExecutionVerdict, StatusTone> = {
  passed: 'success',
  failed: 'danger',
  wrong_answer: 'danger',
  compile_error: 'danger',
  runtime_error: 'danger',
  timeout: 'warning',
  memory_limit: 'warning',
  output_limit: 'warning',
  error: 'neutral',
  pending: 'info',
};

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: ExecutionVerdict;
  className?: string;
}) {
  return (
    <StatusBadge
      status={verdict}
      label={VERDICT_LABELS[verdict]}
      tone={VERDICT_TONE[verdict]}
      className={className}
    />
  );
}

export const KIND_ICONS: Record<AssignmentKind, LucideIcon> = {
  coding: Code2,
  sql: Database,
  quiz: ListChecks,
  written: PenLine,
  file_upload: FileUp,
  practical: Wrench,
  project: FolderKanban,
  mixed: Layers,
};

export function KindLabel({ kind }: { kind: AssignmentKind }) {
  const Icon = KIND_ICONS[kind];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      {ASSIGNMENT_KIND_LABELS[kind]}
    </span>
  );
}
