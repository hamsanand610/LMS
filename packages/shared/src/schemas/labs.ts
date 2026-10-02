import { z } from 'zod';
import { paginationQuerySchema } from './common.js';
import type { PracticeProblemDetail, PracticeStatus } from './practice.js';
import {
  CODE_LANGUAGES,
  EXECUTION_LANGUAGES,
  LAB_TYPES,
  QUESTION_STATUSES,
  type ExecutionLanguage,
  type ExecutionVerdict,
  type LabType,
  type QuestionDifficulty,
  type QuestionStatus,
  type RunOutput,
  type TrustLevel,
} from './questions.js';
import { SANDBOX_LIMITS } from './sandbox.js';

/**
 * Labs beyond the catalogue (ADR-0018, ADR-0021): the playground, drafts kept on the server, the
 * staff's view of labs and of learners' attempts, and a lab opened from a course lesson.
 */

// ───────────────────────── playground ─────────────────────────

/** The playground offers the code languages and SQL; a web page has its own lab. */
export const PLAYGROUND_LANGUAGES = [...CODE_LANGUAGES, 'sql'] as const;
export type PlaygroundLanguage = (typeof PLAYGROUND_LANGUAGES)[number];

/**
 * Limits of a playground run (ADR-0021). The time is CPU time, judged by the sandbox. The input
 * stays under the 64 KiB pipe buffer the harness writes it into, even at four bytes a character.
 */
export const PLAYGROUND_LIMITS = {
  timeMs: 5000,
  memoryMb: 256,
  stdinChars: 16_000,
} as const;

export const playgroundRunSchema = z.object({
  language: z.enum(PLAYGROUND_LANGUAGES),
  code: z.string().min(1, 'Write some code first').max(SANDBOX_LIMITS.maxCodeChars),
  stdin: z.string().max(PLAYGROUND_LIMITS.stdinChars, 'The input is too long').default(''),
});
export type PlaygroundRunInput = z.infer<typeof playgroundRunSchema>;

export interface PlaygroundRunOutcome {
  verdict: ExecutionVerdict;
  compileOutput: string;
  output: RunOutput;
  durationMs: number | null;
  memoryKb: number | null;
  /** The limits the run had, so a limit failure can say which. */
  limits: { timeMs: number; memoryMb: number };
}

// ───────────────────────── drafts ─────────────────────────

/** A draft belongs to the playground or to one lab (a question id). */
export const labDraftScopeSchema = z.union([z.literal('playground'), z.uuid()]);
export type LabDraftScope = z.infer<typeof labDraftScopeSchema>;

export const labDraftSchema = z.object({
  scope: labDraftScopeSchema,
  language: z.enum(EXECUTION_LANGUAGES),
  code: z.string().max(SANDBOX_LIMITS.maxCodeChars, 'The draft is too long'),
  stdin: z.string().max(PLAYGROUND_LIMITS.stdinChars, 'The input is too long').default(''),
});
export type LabDraftInput = z.infer<typeof labDraftSchema>;

export const labDraftQuerySchema = z.object({
  scope: labDraftScopeSchema,
  language: z.enum(EXECUTION_LANGUAGES).optional(),
});

export interface LabDraftRecord {
  scope: string;
  language: ExecutionLanguage;
  code: string;
  stdin: string;
  updatedAt: string;
}

// ───────────────────────── the learner's hub ─────────────────────────

/** Labs a learner was working on and has not solved, most recent first. */
export interface LabInProgress {
  questionId: string;
  slug: string;
  title: string;
  type: LabType;
  status: PracticeStatus;
  /** The draft's or the last attempt's time. */
  updatedAt: string;
}

// ───────────────────────── staff ─────────────────────────

export const labListQuerySchema = paginationQuerySchema.extend({
  type: z.enum(LAB_TYPES).optional(),
  status: z.enum(QUESTION_STATUSES).optional(),
  catalogue: z.enum(['in', 'out']).optional(),
  /** `me` restricts the list to the caller's own labs. */
  author: z.literal('me').optional(),
});

export interface LabSummary {
  questionId: string;
  slug: string;
  title: string;
  type: LabType;
  difficulty: QuestionDifficulty;
  topic: string;
  status: QuestionStatus;
  version: number;
  validated: boolean;
  inCatalogue: boolean;
  points: number;
  authorId: string | null;
  authorName: string | null;
  /** Course lessons that open this lab. */
  lessonCount: number;
  /** Whether the caller may edit it and put it in the catalogue. */
  canEdit: boolean;
  /** Learners within the caller's review scope; null when the caller cannot review attempts. */
  attempts: { learners: number; solved: number; submissions: number } | null;
  updatedAt: string;
}

export const labAttemptsQuerySchema = paginationQuerySchema.extend({
  batchId: z.uuid().optional(),
  status: z.enum(['solved', 'attempted']).optional(),
});

/** One learner's attempts at one lab, as staff within scope see them. */
export interface LabAttemptRow {
  userId: string;
  name: string;
  studentCode: string | null;
  batches: string[];
  submissions: number;
  solved: boolean;
  bestVerdict: ExecutionVerdict;
  bestPassed: number;
  total: number;
  /** The learner's latest submission, to open with its code. */
  latestRunId: string;
  lastSubmittedAt: string;
}

/** One submission, as staff within scope see it: the code and every case, hidden ones included. */
export interface LabRunView {
  id: string;
  questionId: string;
  labTitle: string;
  userId: string;
  learnerName: string;
  language: ExecutionLanguage;
  verdict: ExecutionVerdict;
  trust: TrustLevel;
  passed: number;
  total: number;
  durationMs: number;
  submittedAt: string;
  code: string;
  cases: {
    number: number;
    label: string;
    hidden: boolean;
    verdict: ExecutionVerdict;
    passed: boolean;
  }[];
}

// ───────────────────────── a lab inside a course ─────────────────────────

/**
 * A lab lesson as the learner opens it (ADR-0018). `available` is false when the lab was withdrawn,
 * and `reason` says so; passing it completes the lesson.
 */
export interface LessonLabView {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  problem: PracticeProblemDetail | null;
  available: boolean;
  reason: string | null;
  completed: boolean;
  nextLessonId: string | null;
}
