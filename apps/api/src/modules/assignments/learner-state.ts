import {
  countingSubmission,
  learnerAssignmentStatus,
  questionProgress,
  type AssignmentKind,
  type AssignmentSettings,
  type LearnerAssignmentRow,
  type LearnerModuleView,
  type LearnerQuestionRow,
  type QuestionDifficulty,
  type QuestionProgress,
  type QuestionType,
  type ReviewDecision,
  type UnlockRule,
} from '@lms/shared';

/**
 * Where one assignment stands for one learner, worked out from what is stored and nothing else.
 * The learner's list, the set page, the workspace and the staff progress table all call this, so
 * they cannot disagree about a status, a lock or a mark (plan AC-06.4).
 */

const DAY_MS = 86_400_000;

export interface StatePlacement {
  id: string;
  questionId: string;
  marks: number;
  position: number;
  question: { title: string; type: string; difficulty: string };
}

export interface StateModule {
  id: string;
  title: string;
  description: string;
  topic: string;
  position: number;
  unlockRule: unknown;
  dueAfterDays: number | null;
  questions: StatePlacement[];
}

export interface StateAssignment {
  id: string;
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  kind: string;
  courseId: string | null;
  course: { title: string } | null;
  estimatedMinutes: number;
  passPercent: number;
  settings: AssignmentSettings;
  modules: StateModule[];
}

export interface StatePublication {
  id: string;
  batchId: string | null;
  studentId: string | null;
  opensAt: Date | null;
  dueAt: Date | null;
  closesAt: Date | null;
  publishedAt: Date;
}

export interface StateSubmission {
  id: string;
  assignmentQuestionId: string;
  attempt: number;
  status: string;
  marks: unknown;
  reviewDecision: ReviewDecision | null;
  submittedAt: Date;
}

export interface PlacementState {
  progress: QuestionProgress;
  attempts: number;
  attemptsLeft: number | null;
  awardedMarks: number;
  lastSubmittedAt: Date | null;
  unlocked: boolean;
  moduleId: string;
}

export interface LearnerState {
  row: LearnerAssignmentRow;
  modules: LearnerModuleView[];
  placements: Map<string, PlacementState>;
  /** The due date that applies: the publication's, or the last module's when only those have one. */
  dueAt: Date | null;
  /** Set when nothing more can be submitted; the reason, in words. */
  closedReason: string | null;
}

/** Statuses a question can still be improved from. */
const IMPROVABLE: readonly QuestionProgress[] = [
  'not_attempted',
  'incorrect',
  'partial',
  'resubmit',
  'error',
];

/**
 * When several publications reach one learner, one of them decides the dates: their own
 * publication if they have one (an extension, say), otherwise the batch one due first.
 */
export function effectivePublication<T extends StatePublication>(publications: T[]): T | null {
  if (publications.length === 0) return null;
  const personal = publications.filter((p) => p.studentId !== null);
  if (personal.length > 0) {
    return personal.reduce((a, b) => (b.publishedAt > a.publishedAt ? b : a));
  }
  const due = (p: T) => p.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return [...publications].sort(
    (a, b) => due(a) - due(b) || a.publishedAt.getTime() - b.publishedAt.getTime(),
  )[0]!;
}

export function lockReason(minPercent: number): string {
  return minPercent >= 100
    ? 'Finish the previous module to open this one'
    : `Reach ${minPercent}% of the previous module to open this one`;
}

export function learnerState(
  assignment: StateAssignment,
  publication: StatePublication,
  submissions: readonly StateSubmission[],
  now: Date = new Date(),
): LearnerState {
  const settings = assignment.settings;
  const byPlacement = new Map<string, StateSubmission[]>();
  for (const submission of submissions) {
    const list = byPlacement.get(submission.assignmentQuestionId) ?? [];
    list.push(submission);
    byPlacement.set(submission.assignmentQuestionId, list);
  }

  const start = publication.opensAt ?? publication.publishedAt;
  const placements = new Map<string, PlacementState>();
  const modules: LearnerModuleView[] = [];
  const ordered = [...assignment.modules].sort((a, b) => a.position - b.position);
  let previousPercent = 100;
  let lastModuleDue: Date | null = null;

  for (const [index, module] of ordered.entries()) {
    const rule = (module.unlockRule ?? { type: 'always' }) as UnlockRule;
    const required = rule.type === 'after_previous' ? rule.minPercent : 0;
    const unlocked = index === 0 || rule.type !== 'after_previous' || previousPercent >= required;
    const moduleDue =
      module.dueAfterDays === null
        ? null
        : new Date(start.getTime() + module.dueAfterDays * DAY_MS);
    if (moduleDue && (!lastModuleDue || moduleDue > lastModuleDue)) lastModuleDue = moduleDue;

    const questions: LearnerQuestionRow[] = [...module.questions]
      .sort((a, b) => a.position - b.position)
      .map((placement) => {
        const history = (byPlacement.get(placement.id) ?? []).map((s) => ({
          ...s,
          marks: Number(s.marks ?? 0),
        }));
        const progress = questionProgress(history, settings.gradingMethod);
        const counting = countingSubmission(history, settings.gradingMethod);
        const used = history.filter((s) => s.status !== 'error').length;
        const returned = history.filter(
          (s) => s.reviewDecision === 'resubmission_requested',
        ).length;
        const attemptsLeft =
          settings.attemptsPerQuestion === 0
            ? null
            : Math.max(0, settings.attemptsPerQuestion + returned - used);
        const lastSubmittedAt = history.reduce<Date | null>(
          (latest, s) => (!latest || s.submittedAt > latest ? s.submittedAt : latest),
          null,
        );
        placements.set(placement.id, {
          progress,
          attempts: used,
          attemptsLeft,
          awardedMarks: counting ? Number(counting.marks) : 0,
          lastSubmittedAt,
          unlocked,
          moduleId: module.id,
        });
        return {
          placementId: placement.id,
          questionId: placement.questionId,
          title: placement.question.title,
          type: placement.question.type as QuestionType,
          difficulty: placement.question.difficulty as QuestionDifficulty,
          marks: placement.marks,
          position: placement.position,
          status: progress,
          attempts: used,
          attemptsLeft,
          awardedMarks: counting ? Number(counting.marks) : 0,
          lastSubmittedAt: lastSubmittedAt?.toISOString() ?? null,
        };
      });

    const solved = questions.filter((q) => q.status === 'correct' || q.status === 'partial').length;
    const outstanding = questions.some((q) => IMPROVABLE.includes(q.status));
    modules.push({
      id: module.id,
      title: module.title,
      description: module.description,
      topic: module.topic,
      position: module.position,
      unlocked,
      lockReason: unlocked ? null : lockReason(required),
      dueAt: moduleDue?.toISOString() ?? null,
      overdue: Boolean(moduleDue && moduleDue < now && outstanding),
      solved,
      questions,
    });
    previousPercent = questions.length === 0 ? 100 : Math.round((solved / questions.length) * 100);
  }

  const all = modules.flatMap((m) => m.questions);
  const answered = all.filter(
    (q) => q.status !== 'not_attempted' && q.status !== 'resubmit',
  ).length;
  const solved = all.filter((q) => q.status === 'correct' || q.status === 'partial').length;
  const totalMarks = all.reduce((n, q) => n + q.marks, 0);
  const awardedMarks = round2(all.reduce((n, q) => n + q.awardedMarks, 0));
  const dueAt = publication.dueAt ?? lastModuleDue;

  const status = learnerAssignmentStatus({
    now,
    opensAt: publication.opensAt,
    dueAt,
    closesAt: publication.closesAt,
    duePolicy: settings.duePolicy,
    questionCount: all.length,
    answered,
    evaluating: all.filter((q) => q.status === 'evaluating').length,
    awaitingReview: all.filter((q) => q.status === 'awaiting_review').length,
    fullMarks: all.filter((q) => q.status === 'correct').length,
    awardedMarks,
    totalMarks,
    passPercent: assignment.passPercent,
  });

  const closedReason =
    publication.opensAt && now < publication.opensAt
      ? 'This assignment has not opened yet'
      : publication.closesAt && now > publication.closesAt
        ? 'This assignment has closed'
        : settings.duePolicy === 'block_late' && dueAt && now > dueAt
          ? 'This assignment closed on its due date'
          : null;

  const nextRow = closedReason
    ? null
    : (modules
        .filter((m) => m.unlocked)
        .flatMap((m) => m.questions)
        .find(
          (q) => IMPROVABLE.includes(q.status) && (q.attemptsLeft === null || q.attemptsLeft > 0),
        ) ?? null);

  const lastActivity = all.reduce<string | null>(
    (latest, q) =>
      q.lastSubmittedAt && (!latest || q.lastSubmittedAt > latest) ? q.lastSubmittedAt : latest,
    null,
  );

  return {
    row: {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      technology: assignment.subject,
      level: assignment.difficulty,
      kind: assignment.kind as AssignmentKind,
      courseId: assignment.courseId,
      courseTitle: assignment.course?.title ?? null,
      topics: [...new Set(ordered.map((m) => m.topic).filter(Boolean))],
      moduleCount: ordered.length,
      questionCount: all.length,
      totalMarks,
      awardedMarks,
      answered,
      solved,
      progressPct: all.length === 0 ? 0 : Math.round((answered / all.length) * 100),
      status,
      opensAt: publication.opensAt?.toISOString() ?? null,
      dueAt: dueAt?.toISOString() ?? null,
      closesAt: publication.closesAt?.toISOString() ?? null,
      estimatedMinutes: assignment.estimatedMinutes,
      passPercent: assignment.passPercent,
      lastActivityAt: lastActivity,
      next:
        status === 'upcoming' || !nextRow
          ? null
          : { placementId: nextRow.placementId, title: nextRow.title },
    },
    modules,
    placements,
    dueAt,
    closedReason,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
