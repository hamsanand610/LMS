import { z } from 'zod';
import { paginationQuerySchema } from './common.js';
import { unlockRuleSchema } from './courses.js';
import type { QuestionDifficulty, QuestionType, TrustLevel } from './questions.js';

export const ASSIGNMENT_STATUSES = ['draft', 'published', 'archived'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/** When the learner is shown the worked answer. */
export const EXPLANATION_POLICIES = ['after_solve', 'after_due', 'never'] as const;
export type ExplanationPolicy = (typeof EXPLANATION_POLICIES)[number];

/** What happens to a submission made after the due date. */
export const DUE_POLICIES = ['allow_late', 'block_late'] as const;
export type DuePolicy = (typeof DUE_POLICIES)[number];

// ───────────────────────── authoring ─────────────────────────

export const assignmentSettingsSchema = z.object({
  /** 0 means as many attempts as the learner wants. */
  attemptsPerQuestion: z.number().int().min(0).max(100).default(3),
  explanationPolicy: z.enum(EXPLANATION_POLICIES).default('after_solve'),
  duePolicy: z.enum(DUE_POLICIES).default('allow_late'),
});
export type AssignmentSettings = z.infer<typeof assignmentSettingsSchema>;

export const assignmentCreateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).default(''),
  subject: z.string().trim().max(60).default(''),
  difficulty: z.string().trim().max(40).default(''),
  settings: assignmentSettingsSchema.default({
    attemptsPerQuestion: 3,
    explanationPolicy: 'after_solve',
    duePolicy: 'allow_late',
  }),
});
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;

export const assignmentUpdateSchema = assignmentCreateSchema.partial();

/** One question placed in a module, with the marks this assignment gives it. */
export const assignmentQuestionSchema = z.object({
  questionId: z.uuid(),
  marks: z.number().int().min(1).max(100).optional(),
});

export const assignmentModuleSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2).max(160),
  unlockRule: unlockRuleSchema.default({ type: 'always' }),
  questions: z.array(assignmentQuestionSchema).max(200),
});

/** The whole structure in one save, like the course outline. */
export const assignmentStructureSchema = z.object({
  modules: z.array(assignmentModuleSchema).max(50),
});
export type AssignmentStructureInput = z.infer<typeof assignmentStructureSchema>;

export const assignmentPublishSchema = z.object({
  batchId: z.uuid(),
  dueAt: z.iso.datetime().nullable().default(null),
  note: z.string().trim().max(240).default(''),
});
export type AssignmentPublishInput = z.infer<typeof assignmentPublishSchema>;

export const assignmentListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  subject: z.string().max(60).optional(),
  batchId: z.uuid().optional(),
});

// ───────────────────────── answering ─────────────────────────

/**
 * One answer. Which field carries it depends on the question type, so the shape is checked
 * against the question when it is submitted rather than guessed at here.
 */
export const submissionSchema = z.object({
  /** MCQ and true/false: the chosen option ids. */
  optionIds: z.array(z.uuid()).max(10).default([]),
  /** Descriptive: what the learner wrote. */
  text: z.string().max(50_000).default(''),
  /** Coding: the submitted source and the language it is in. */
  code: z.string().max(100_000).default(''),
  language: z.string().max(40).default(''),
  /** Coding: what the driver reported. Recorded with its trust level, never taken as proof. */
  execution: z
    .object({
      driver: z.string().min(1).max(40),
      verdict: z.string().min(1).max(20),
      durationMs: z.number().int().min(0).max(600_000).default(0),
      results: z
        .array(
          z.object({
            testCaseId: z.uuid(),
            passed: z.boolean(),
            actualOutput: z.string().max(20_000).default(''),
            stderr: z.string().max(20_000).default(''),
            durationMs: z.number().int().min(0).max(600_000).default(0),
          }),
        )
        .max(50)
        .default([]),
    })
    .nullable()
    .default(null),
});
export type SubmissionInput = z.infer<typeof submissionSchema>;

export const gradeSchema = z.object({
  marks: z.number().min(0).max(100),
  comment: z.string().trim().max(2000).default(''),
});
export type GradeInput = z.infer<typeof gradeSchema>;

export const SUBMISSION_STATUSES = ['correct', 'incorrect', 'partial', 'awaiting_grading'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

// ───────────────────────── responses ─────────────────────────

export interface AssignmentSummary {
  id: string;
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  status: AssignmentStatus;
  moduleCount: number;
  questionCount: number;
  totalMarks: number;
  publicationCount: number;
  settings: AssignmentSettings;
  createdAt: string;
}

export interface AssignmentQuestionView {
  id: string;
  questionId: string;
  title: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  marks: number;
  position: number;
  /** Learner view. */
  status?: SubmissionStatus | 'not_attempted';
  attempts?: number;
  awardedMarks?: number;
  timeSpentSeconds?: number;
}

export interface AssignmentModuleView {
  id: string;
  title: string;
  position: number;
  unlockRule: { type: 'always' } | { type: 'after_previous'; minPercent: number };
  questions: AssignmentQuestionView[];
  /** Learner view. */
  unlocked?: boolean;
  lockReason?: string;
  solved?: number;
}

export interface AssignmentDetail extends AssignmentSummary {
  modules: AssignmentModuleView[];
  /** Learner view. */
  dueAt?: string | null;
  overdue?: boolean;
  solved?: number;
  awardedMarks?: number;
  progressPct?: number;
}

export interface AssignmentPublicationRecord {
  id: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  dueAt: string | null;
  note: string;
  publishedAt: string;
  learners: number;
}

/** A learner's card on their own assignment list. */
export interface AssignmentProgressCard {
  assignmentId: string;
  title: string;
  subject: string;
  difficulty: string;
  moduleCount: number;
  questionCount: number;
  totalMarks: number;
  solved: number;
  awardedMarks: number;
  progressPct: number;
  dueAt: string | null;
  overdue: boolean;
}

/** One row of the staff progress table. */
export interface AssignmentProgressRow {
  studentId: string;
  studentCode: string;
  name: string;
  batchCode: string;
  solved: number;
  questionCount: number;
  awardedMarks: number;
  totalMarks: number;
  lastActivityAt: string | null;
}

/** What the learner gets back the moment they answer. */
export interface SubmissionResult {
  id: string;
  questionId: string;
  status: SubmissionStatus;
  marks: number;
  maxMarks: number;
  attempts: number;
  attemptsLeft: number | null;
  /** Shown only when the explanation policy allows it. */
  explanation?: string;
  correctOptionIds?: string[];
  /** Coding only. */
  trust?: TrustLevel;
  passedTests?: number;
  totalTests?: number;
  sampleResults?: {
    testCaseId: string;
    passed: boolean;
    input?: string;
    expectedOutput?: string;
    actualOutput?: string;
    stderr?: string;
  }[];
  submittedAt: string;
}

/** One entry of the grading queue. */
export interface GradingQueueItem {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  questionId: string;
  questionTitle: string;
  rubric: string;
  maxMarks: number;
  studentName: string;
  studentCode: string;
  batchCode: string;
  answer: string;
  submittedAt: string;
}
