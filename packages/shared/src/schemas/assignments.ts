import { z } from 'zod';
import { optionalWebUrlSchema, paginationQuerySchema, webUrlSchema } from './common.js';
import { unlockRuleSchema } from './courses.js';
import {
  EXECUTION_LANGUAGES,
  QUESTION_TYPES,
  type CaseOutcome,
  type CompareMode,
  type ExecutionLanguage,
  type ExecutionVerdict,
  type QuestionDifficulty,
  type QuestionSpec,
  type QuestionType,
  type TrustLevel,
} from './questions.js';

// ───────────────────────── vocabulary ─────────────────────────

/** Where an assignment is in its authoring life. */
export const ASSIGNMENT_STATUSES = ['draft', 'published', 'archived'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/** What an assignment asks for, as the list shows it and the filters narrow by. */
export const ASSIGNMENT_KINDS = [
  'coding',
  'sql',
  'quiz',
  'written',
  'file_upload',
  'practical',
  'project',
  'mixed',
] as const;
export type AssignmentKind = (typeof ASSIGNMENT_KINDS)[number];

export const ASSIGNMENT_KIND_LABELS: Record<AssignmentKind, string> = {
  coding: 'Coding',
  sql: 'SQL',
  quiz: 'Quiz',
  written: 'Written',
  file_upload: 'File upload',
  practical: 'Practical',
  project: 'Project',
  mixed: 'Mixed',
};

/**
 * Where an assignment stands for one learner. Worked out on the server from the dates, the
 * submissions and the reviews; never stored and never taken from the client.
 */
export const LEARNER_ASSIGNMENT_STATUSES = [
  'upcoming',
  'not_started',
  'in_progress',
  'submitted',
  'passed',
  'failed',
  'completed',
  'overdue',
  'locked',
] as const;
export type LearnerAssignmentStatus = (typeof LEARNER_ASSIGNMENT_STATUSES)[number];

export const LEARNER_STATUS_LABELS: Record<LearnerAssignmentStatus, string> = {
  upcoming: 'Upcoming',
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  passed: 'Passed',
  failed: 'Failed',
  completed: 'Completed',
  overdue: 'Overdue',
  locked: 'Locked',
};

/** How a stored answer stands; assignment submissions and test answers share it. */
export const SUBMISSION_STATUSES = [
  'correct',
  'incorrect',
  'partial',
  'awaiting_grading',
  'evaluating',
  'error',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Where one question stands for one learner. */
export const QUESTION_PROGRESS = [
  'not_attempted',
  'evaluating',
  'awaiting_review',
  'correct',
  'partial',
  'incorrect',
  'resubmit',
  'error',
] as const;
export type QuestionProgress = (typeof QUESTION_PROGRESS)[number];

/** When the learner is shown the worked answer. */
export const EXPLANATION_POLICIES = ['after_solve', 'after_due', 'never'] as const;
export type ExplanationPolicy = (typeof EXPLANATION_POLICIES)[number];

/** What happens to a submission made after the due date. */
export const DUE_POLICIES = ['allow_late', 'block_late'] as const;
export type DuePolicy = (typeof DUE_POLICIES)[number];

/** Which attempt at a question counts: the best one, or the most recent. */
export const GRADING_METHODS = ['best', 'latest'] as const;
export type GradingMethod = (typeof GRADING_METHODS)[number];

export const REVIEW_DECISIONS = ['graded', 'approved', 'resubmission_requested'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const REVIEW_DECISION_LABELS: Record<ReviewDecision, string> = {
  graded: 'Marked',
  approved: 'Approved',
  resubmission_requested: 'Resubmission requested',
};

// ───────────────────────── authoring ─────────────────────────

export const assignmentSettingsSchema = z.object({
  /** 0 means as many attempts as the learner wants. */
  attemptsPerQuestion: z.number().int().min(0).max(100).default(3),
  explanationPolicy: z.enum(EXPLANATION_POLICIES).default('after_solve'),
  duePolicy: z.enum(DUE_POLICIES).default('allow_late'),
  gradingMethod: z.enum(GRADING_METHODS).default('best'),
});
export type AssignmentSettings = z.infer<typeof assignmentSettingsSchema>;

export const DEFAULT_ASSIGNMENT_SETTINGS: AssignmentSettings = {
  attemptsPerQuestion: 3,
  explanationPolicy: 'after_solve',
  duePolicy: 'allow_late',
  gradingMethod: 'best',
};

export const assignmentCreateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).default(''),
  /** What the learner reads before starting: rules, what "done" means, how it is marked. */
  instructions: z.string().trim().max(20_000).default(''),
  /** The technology: a key of the `subject` taxonomy. */
  subject: z.string().trim().max(60).default(''),
  /** The level: a key of the `course-level` taxonomy. */
  difficulty: z.string().trim().max(40).default(''),
  kind: z.enum(ASSIGNMENT_KINDS).default('mixed'),
  courseId: z.uuid().nullable().default(null),
  programId: z.uuid().nullable().default(null),
  estimatedMinutes: z.number().int().min(0).max(10_000).default(0),
  passPercent: z.number().int().min(0).max(100).default(40),
  settings: assignmentSettingsSchema.default(DEFAULT_ASSIGNMENT_SETTINGS),
});
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;

/** Every field optional, and none defaulted: a field left out of an edit is left alone. */
export const assignmentUpdateSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  instructions: z.string().trim().max(20_000).optional(),
  subject: z.string().trim().max(60).optional(),
  difficulty: z.string().trim().max(40).optional(),
  kind: z.enum(ASSIGNMENT_KINDS).optional(),
  courseId: z.uuid().nullable().optional(),
  programId: z.uuid().nullable().optional(),
  estimatedMinutes: z.number().int().min(0).max(10_000).optional(),
  passPercent: z.number().int().min(0).max(100).optional(),
  settings: assignmentSettingsSchema.optional(),
});
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;

/** One question placed in a module, with the marks this assignment gives it. */
export const assignmentQuestionSchema = z.object({
  questionId: z.uuid(),
  marks: z.number().int().min(1).max(100).optional(),
});

export const assignmentModuleSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).default(''),
  /** A key of the `topic` taxonomy. */
  topic: z.string().trim().max(60).default(''),
  courseModuleId: z.uuid().nullable().default(null),
  /** Due this many days after the assignment opens for the learner. */
  dueAfterDays: z.number().int().min(0).max(365).nullable().default(null),
  unlockRule: unlockRuleSchema.default({ type: 'always' }),
  questions: z.array(assignmentQuestionSchema).max(200),
});

/** The whole structure in one save, like the course outline. */
export const assignmentStructureSchema = z.object({
  modules: z.array(assignmentModuleSchema).max(50),
});
export type AssignmentStructureInput = z.infer<typeof assignmentStructureSchema>;

export const assignmentResourceSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    url: optionalWebUrlSchema(500),
    fileId: z.uuid().nullable().default(null),
  })
  .refine((value) => (value.url === '') !== (value.fileId === null), {
    path: ['url'],
    message: 'Give a link or attach a file',
  });

export const assignmentResourcesSchema = z.object({
  resources: z.array(assignmentResourceSchema).max(20),
});
export type AssignmentResourcesInput = z.infer<typeof assignmentResourcesSchema>;

/**
 * Giving an assignment to a batch, or to named learners. The dates are optional: without
 * `opensAt` it opens at once, without `dueAt` it has no deadline, without `closesAt` late work is
 * accepted for as long as the due policy allows.
 */
export const assignmentPublishSchema = z
  .object({
    batchId: z.uuid().nullable().default(null),
    studentIds: z.array(z.uuid()).max(200).default([]),
    opensAt: z.iso.datetime().nullable().default(null),
    dueAt: z.iso.datetime().nullable().default(null),
    closesAt: z.iso.datetime().nullable().default(null),
    note: z.string().trim().max(240).default(''),
  })
  .superRefine((value, ctx) => {
    const add = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if ((value.batchId === null) === (value.studentIds.length === 0)) {
      add('batchId', 'Choose a batch or the learners, not both');
    }
    const time = (iso: string | null) => (iso ? Date.parse(iso) : null);
    const opens = time(value.opensAt);
    const due = time(value.dueAt);
    const closes = time(value.closesAt);
    if (opens !== null && due !== null && due <= opens) {
      add('dueAt', 'The due date has to come after the opening date');
    }
    if (due !== null && closes !== null && closes < due) {
      add('closesAt', 'It cannot close before it is due');
    }
    if (opens !== null && closes !== null && closes <= opens) {
      add('closesAt', 'It has to close after it opens');
    }
  });
export type AssignmentPublishInput = z.infer<typeof assignmentPublishSchema>;

export const assignmentListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  kind: z.enum(ASSIGNMENT_KINDS).optional(),
  subject: z.string().max(60).optional(),
  courseId: z.uuid().optional(),
  batchId: z.uuid().optional(),
});

// ───────────────────────── learner list ─────────────────────────

export const LEARNER_ASSIGNMENT_SORTS = ['due', 'recent', 'title', 'progress'] as const;
export type LearnerAssignmentSort = (typeof LEARNER_ASSIGNMENT_SORTS)[number];

export const learnerAssignmentQuerySchema = paginationQuerySchema.extend({
  technology: z.string().max(60).optional(),
  kind: z.enum(ASSIGNMENT_KINDS).optional(),
  level: z.string().max(40).optional(),
  status: z.enum(LEARNER_ASSIGNMENT_STATUSES).optional(),
  courseId: z.uuid().optional(),
  topic: z.string().max(60).optional(),
  /** Only assignments holding a question of this type: the Projects view asks for `project`. */
  questionType: z.enum(QUESTION_TYPES).optional(),
  sort: z.enum(LEARNER_ASSIGNMENT_SORTS).default('due'),
});
export type LearnerAssignmentQuery = z.infer<typeof learnerAssignmentQuerySchema>;

// ───────────────────────── answering ─────────────────────────

/**
 * One answer. Which fields carry it depends on the question type, so the shape is checked
 * against the question when it is submitted rather than guessed at here.
 */
export const submissionInputSchema = z.object({
  /** Coding and SQL: the language and the source. */
  language: z.enum(EXECUTION_LANGUAGES).nullable().default(null),
  code: z.string().max(64_000).default(''),
  /** Objective types: the chosen option ids. */
  optionIds: z.array(z.uuid()).max(10).default([]),
  /** Written answers, and notes with a practical or project. */
  text: z.string().max(50_000).default(''),
  /** File upload, practical and project: links and uploaded files. */
  links: z.array(webUrlSchema(500)).max(5).default([]),
  fileIds: z.array(z.uuid()).max(5).default([]),
  /** Which checklist points (by position) the learner confirms. */
  checklist: z.array(z.number().int().min(0).max(19)).max(20).default([]),
  timeSpentSeconds: z.number().int().min(0).max(86_400).default(0),
  /**
   * Chosen by the client once per submit; sending the same key again (a retry after a dropped
   * connection) returns the first submission instead of making a second one.
   */
  idempotencyKey: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});
export type SubmissionInput = z.infer<typeof submissionInputSchema>;

export const reviewInputSchema = z
  .object({
    decision: z.enum(REVIEW_DECISIONS),
    /** Required when marking; optional otherwise (the evaluated marks stand). */
    marks: z.number().min(0).max(1000).nullable().default(null),
    comment: z.string().trim().max(4000).default(''),
  })
  .refine((value) => value.decision !== 'graded' || value.marks !== null, {
    path: ['marks'],
    message: 'Give the marks',
  })
  .refine((value) => value.decision !== 'resubmission_requested' || value.comment.length > 0, {
    path: ['comment'],
    message: 'Say what should change',
  });
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const reviewListQuerySchema = paginationQuerySchema.extend({
  assignmentId: z.uuid().optional(),
  batchId: z.uuid().optional(),
  /** `pending` is everything waiting for a person; `reviewed`, what has a decision. */
  state: z.enum(['pending', 'reviewed', 'all']).default('pending'),
  type: z.enum(['descriptive', 'coding', 'sql', 'file_upload', 'practical', 'project']).optional(),
});

export const analyticsQuerySchema = z.object({
  courseId: z.uuid().optional(),
  batchId: z.uuid().optional(),
  subject: z.string().max(60).optional(),
});

// ───────────────────────── staff responses ─────────────────────────

export interface AssignmentSummary {
  id: string;
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  kind: AssignmentKind;
  status: AssignmentStatus;
  courseId: string | null;
  courseTitle: string | null;
  programId: string | null;
  programName: string | null;
  moduleCount: number;
  questionCount: number;
  totalMarks: number;
  publicationCount: number;
  estimatedMinutes: number;
  passPercent: number;
  settings: AssignmentSettings;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentQuestionView {
  id: string;
  questionId: string;
  title: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  marks: number;
  position: number;
  /** How many answers it has; a placement with answers cannot be removed. */
  submissionCount: number;
}

export interface AssignmentModuleView {
  id: string;
  title: string;
  description: string;
  topic: string;
  courseModuleId: string | null;
  dueAfterDays: number | null;
  position: number;
  unlockRule: { type: 'always' } | { type: 'after_previous'; minPercent: number };
  questions: AssignmentQuestionView[];
}

export interface AssignmentResourceView {
  id: string;
  title: string;
  url: string;
  fileId: string | null;
  fileName: string | null;
  position: number;
}

export interface AssignmentDetail extends AssignmentSummary {
  instructions: string;
  modules: AssignmentModuleView[];
  resources: AssignmentResourceView[];
}

export interface AssignmentPublicationRecord {
  id: string;
  audience: 'batch' | 'learner';
  batchId: string | null;
  batchCode: string | null;
  batchName: string | null;
  studentId: string | null;
  studentName: string | null;
  studentCode: string | null;
  opensAt: string | null;
  dueAt: string | null;
  closesAt: string | null;
  note: string;
  publishedAt: string;
  learners: number;
}

/** One row of the staff progress table. */
export interface AssignmentProgressRow {
  studentId: string;
  studentCode: string;
  name: string;
  batchCode: string;
  status: LearnerAssignmentStatus;
  answered: number;
  solved: number;
  questionCount: number;
  awardedMarks: number;
  totalMarks: number;
  percentage: number;
  attempts: number;
  failedAttempts: number;
  awaitingReview: number;
  lastActivityAt: string | null;
  /** Many failed attempts, or overdue with little done: someone worth talking to. */
  struggling: boolean;
}

/** One answer waiting for, or given, a person's decision. */
export interface ReviewQueueItem {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  placementId: string;
  questionTitle: string;
  questionType: QuestionType;
  studentId: string;
  studentName: string;
  studentCode: string;
  batchCode: string;
  attempt: number;
  status: QuestionProgress;
  marks: number;
  maxMarks: number;
  reviewDecision: ReviewDecision | null;
  submittedAt: string;
  /** Handed in after the learner's due date, where the publication still accepted it. */
  isLate: boolean;
}

export interface AssignmentAnalytics {
  asOf: string;
  totals: { assignments: number; published: number; draft: number; archived: number };
  learners: {
    reached: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    overdue: number;
  };
  submissions: { total: number; last7Days: number; evaluating: number; awaitingReview: number };
  /** Null until something has been marked. */
  averageScorePct: number | null;
  passRatePct: number | null;
  weekly: { weekStart: string; submissions: number }[];
  byCourse: {
    courseId: string | null;
    title: string;
    assignments: number;
    completionPct: number | null;
    averageScorePct: number | null;
  }[];
  byTopic: { topic: string; questions: number; attempts: number; passRatePct: number | null }[];
  byTrainer: { name: string; assignments: number; awaitingReview: number }[];
  hardestQuestions: {
    questionId: string;
    title: string;
    type: QuestionType;
    attempts: number;
    passRatePct: number;
  }[];
}

// ───────────────────────── learner responses ─────────────────────────

/** One row of the learner's list. */
export interface LearnerAssignmentRow {
  id: string;
  title: string;
  description: string;
  technology: string;
  level: string;
  kind: AssignmentKind;
  courseId: string | null;
  courseTitle: string | null;
  topics: string[];
  moduleCount: number;
  questionCount: number;
  totalMarks: number;
  awardedMarks: number;
  answered: number;
  solved: number;
  progressPct: number;
  status: LearnerAssignmentStatus;
  opensAt: string | null;
  dueAt: string | null;
  closesAt: string | null;
  estimatedMinutes: number;
  passPercent: number;
  lastActivityAt: string | null;
  /** The question to open next, when there is one the learner can open. */
  next: { placementId: string; title: string } | null;
}

export interface FacetCount {
  key: string;
  label: string;
  count: number;
}

export interface LearnerAssignmentList {
  summary: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    overdue: number;
    upcoming: number;
  };
  facets: {
    technologies: FacetCount[];
    kinds: FacetCount[];
    levels: FacetCount[];
    courses: FacetCount[];
    topics: FacetCount[];
    statuses: FacetCount[];
  };
  data: LearnerAssignmentRow[];
  meta: { page: number; pageSize: number; total: number };
}

export interface LearnerQuestionRow {
  placementId: string;
  questionId: string;
  title: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  marks: number;
  position: number;
  status: QuestionProgress;
  attempts: number;
  attemptsLeft: number | null;
  awardedMarks: number;
  lastSubmittedAt: string | null;
}

export interface LearnerModuleView {
  id: string;
  title: string;
  description: string;
  topic: string;
  position: number;
  unlocked: boolean;
  lockReason: string | null;
  dueAt: string | null;
  overdue: boolean;
  solved: number;
  questions: LearnerQuestionRow[];
}

export interface LearnerAssignmentDetail extends LearnerAssignmentRow {
  instructions: string;
  settings: AssignmentSettings;
  resources: AssignmentResourceView[];
  modules: LearnerModuleView[];
  /** Why nothing can be submitted right now, when that is the case. */
  closedReason: string | null;
}

/** Everything the workspace needs for one question. Hidden cases are counted, never included. */
export interface LearnerQuestionWorkspace {
  assignment: {
    id: string;
    title: string;
    status: LearnerAssignmentStatus;
    dueAt: string | null;
    closesAt: string | null;
  };
  placement: {
    id: string;
    marks: number;
    moduleId: string;
    moduleTitle: string;
    index: number;
    count: number;
    previousId: string | null;
    nextId: string | null;
  };
  question: {
    id: string;
    title: string;
    type: QuestionType;
    difficulty: QuestionDifficulty;
    body: string;
    hints: string[];
    spec: QuestionSpec;
    options: { id: string; body: string; position: number }[];
    coding: {
      languages: ExecutionLanguage[];
      starterCode: Record<string, string>;
      timeLimitMs: number;
      memoryLimitMb: number;
      inputFormat: string;
      outputFormat: string;
      constraints: string;
      compareMode: CompareMode;
      /** SQL: the tables and rows the query runs against. */
      schemaSql: string;
      samples: {
        id: string;
        label: string;
        input: string;
        expectedOutput: string;
        explanation: string;
      }[];
      hiddenCount: number;
    } | null;
  };
  progress: {
    status: QuestionProgress;
    attempts: number;
    attemptsLeft: number | null;
    awardedMarks: number;
    canSubmit: boolean;
    /** Why a submit would be refused, in words the learner can act on. */
    blockedReason: string | null;
  };
  lastSubmission: SubmissionView | null;
}

/** A submission as the learner (their own) or staff (their scope) see it. */
export interface SubmissionView {
  id: string;
  assignmentId: string;
  placementId: string;
  questionId: string;
  questionTitle: string;
  questionType: QuestionType;
  attempt: number;
  status: QuestionProgress;
  marks: number;
  maxMarks: number;
  autoMarks: number | null;
  language: ExecutionLanguage | null;
  code: string;
  text: string;
  optionIds: string[];
  links: string[];
  files: { id: string; name: string; size: number }[];
  checklist: number[];
  submittedAt: string;
  /** Handed in after the learner's due date, where the publication still accepted it. */
  isLate: boolean;
  evaluatedAt: string | null;
  verdict: ExecutionVerdict | null;
  trust: TrustLevel | null;
  passed: number;
  total: number;
  durationMs: number | null;
  memoryKb: number | null;
  compileOutput: string;
  evaluationError: string;
  cases: CaseOutcome[];
  reviews: {
    id: string;
    decision: ReviewDecision;
    marks: number | null;
    comment: string;
    reviewerName: string | null;
    createdAt: string;
  }[];
  /** Shown when the explanation policy allows it. */
  explanation: string | null;
  correctOptionIds: string[] | null;
  /** Staff view only. */
  student: { id: string; name: string; code: string } | null;
  /** Staff view only: what the reviewer marks against, and the learner's other attempts. */
  reviewContext: SubmissionReviewContext | null;
}

export interface SubmissionReviewContext {
  assignmentTitle: string;
  body: string;
  /** The mark scheme; never sent to a learner. */
  rubric: string;
  spec: QuestionSpec;
  options: { id: string; body: string; isCorrect: boolean }[];
  /** Every attempt the learner made at this question, newest first, this one included. */
  attempts: SubmissionHistoryItem[];
}

export interface SubmissionHistoryItem {
  id: string;
  attempt: number;
  status: QuestionProgress;
  language: ExecutionLanguage | null;
  verdict: ExecutionVerdict | null;
  marks: number;
  maxMarks: number;
  passed: number;
  total: number;
  durationMs: number | null;
  memoryKb: number | null;
  reviewDecision: ReviewDecision | null;
  submittedAt: string;
}
