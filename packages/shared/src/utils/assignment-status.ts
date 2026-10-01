import type {
  DuePolicy,
  GradingMethod,
  LearnerAssignmentStatus,
  QuestionProgress,
  ReviewDecision,
} from '../schemas/assignments.js';

type When = Date | string | number | null | undefined;

function time(value: When): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** One submission as the status rules need it. */
export interface SubmissionFacts {
  attempt: number;
  /** The stored status: correct, partial, incorrect, awaiting_grading, evaluating or error. */
  status: string;
  marks: number;
  reviewDecision: ReviewDecision | null;
}

/**
 * The submission that counts for a question: the best marked one, or the latest marked one,
 * as the assignment's grading method says. Null when nothing has been marked yet.
 */
export function countingSubmission<T extends SubmissionFacts>(
  submissions: readonly T[],
  method: GradingMethod,
): T | null {
  const marked = submissions.filter((s) => ['correct', 'partial', 'incorrect'].includes(s.status));
  if (marked.length === 0) return null;
  if (method === 'latest') {
    return marked.reduce((a, b) => (b.attempt > a.attempt ? b : a));
  }
  return marked.reduce((a, b) =>
    b.marks > a.marks || (b.marks === a.marks && b.attempt > a.attempt) ? b : a,
  );
}

/**
 * Where one question stands for one learner. The latest attempt says what is happening now (being
 * run, waiting for a person, sent back); otherwise the counting attempt says how it went.
 */
export function questionProgress(
  submissions: readonly SubmissionFacts[],
  method: GradingMethod,
): QuestionProgress {
  if (submissions.length === 0) return 'not_attempted';
  const latest = submissions.reduce((a, b) => (b.attempt > a.attempt ? b : a));
  if (latest.status === 'evaluating') return 'evaluating';
  if (latest.reviewDecision === 'resubmission_requested') return 'resubmit';
  if (latest.status === 'awaiting_grading') return 'awaiting_review';
  const counting = countingSubmission(submissions, method);
  if (!counting) return latest.status === 'error' ? 'error' : 'not_attempted';
  return counting.status as QuestionProgress;
}

/** Everything the assignment-level status is worked out from. */
export interface AssignmentFacts {
  now: When;
  opensAt: When;
  dueAt: When;
  closesAt: When;
  duePolicy: DuePolicy;
  questionCount: number;
  /** Questions with at least one submission. */
  answered: number;
  /** Questions whose latest submission is still with the sandbox. */
  evaluating: number;
  /** Questions waiting for a person, or sent back for another attempt. */
  awaitingReview: number;
  /** Questions marked with full marks. */
  fullMarks: number;
  awardedMarks: number;
  totalMarks: number;
  passPercent: number;
}

/** Whether new work is still accepted: before the close date, and before the due date if late work is refused. */
export function isClosed(
  facts: Pick<AssignmentFacts, 'now' | 'dueAt' | 'closesAt' | 'duePolicy'>,
): boolean {
  const now = time(facts.now) ?? Date.now();
  const closes = time(facts.closesAt);
  const due = time(facts.dueAt);
  if (closes !== null && now > closes) return true;
  return facts.duePolicy === 'block_late' && due !== null && now > due;
}

/**
 * Where an assignment stands for one learner:
 *
 * - `upcoming` — it has not opened yet;
 * - `locked` — it has closed with work still missing;
 * - `submitted` — everything is answered and something is still being run or reviewed;
 * - `completed` — everything is answered and marked, with full marks on every question;
 * - `passed` / `failed` — everything is answered and marked, above or below the pass mark;
 * - `overdue` — the due date has passed with work missing and late work is still accepted;
 * - `in_progress` / `not_started` — otherwise, by whether anything has been answered.
 */
export function learnerAssignmentStatus(facts: AssignmentFacts): LearnerAssignmentStatus {
  const now = time(facts.now) ?? Date.now();
  const opens = time(facts.opensAt);
  if (opens !== null && now < opens) return 'upcoming';

  const everything = facts.questionCount > 0 && facts.answered >= facts.questionCount;
  if (everything) {
    if (facts.evaluating > 0 || facts.awaitingReview > 0) return 'submitted';
    if (facts.fullMarks >= facts.questionCount) return 'completed';
    const pct = facts.totalMarks === 0 ? 0 : (facts.awardedMarks / facts.totalMarks) * 100;
    return pct >= facts.passPercent ? 'passed' : 'failed';
  }

  if (isClosed(facts)) return 'locked';
  const due = time(facts.dueAt);
  if (due !== null && now > due) return 'overdue';
  return facts.answered > 0 ? 'in_progress' : 'not_started';
}

/** Statuses that still ask something of the learner. */
export const PENDING_STATUSES: readonly LearnerAssignmentStatus[] = [
  'not_started',
  'in_progress',
  'overdue',
];

/** Statuses that are finished, whatever the outcome. */
export const FINISHED_STATUSES: readonly LearnerAssignmentStatus[] = [
  'completed',
  'passed',
  'failed',
];
