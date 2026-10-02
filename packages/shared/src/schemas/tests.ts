import { z } from 'zod';
import { paginationQuerySchema, patchSchemaOf } from './common.js';
import type { QuestionType } from './questions.js';
import type { SubmissionStatus } from './assignments.js';

export const TEST_STATUSES = ['draft', 'published', 'archived'] as const;
export type TestStatus = (typeof TEST_STATUSES)[number];

export const TEST_KINDS = ['practice', 'weekly', 'mock', 'final'] as const;
export type TestKind = (typeof TEST_KINDS)[number];

/** When a learner may see what they scored. */
export const RESULT_POLICIES = ['on_release', 'immediately'] as const;
export type ResultPolicy = (typeof RESULT_POLICIES)[number];

/** How much of the paper a learner may look back at once results are out. */
export const REVIEW_POLICIES = ['full', 'score_only', 'none'] as const;
export type ReviewPolicy = (typeof REVIEW_POLICIES)[number];

// ───────────────────────── authoring ─────────────────────────

export const testSettingsSchema = z.object({
  durationMinutes: z.number().int().min(1).max(600).default(60),
  /** How many times one learner may sit it within a window. */
  maxAttempts: z.number().int().min(1).max(10).default(1),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  resultPolicy: z.enum(RESULT_POLICIES).default('on_release'),
  reviewPolicy: z.enum(REVIEW_POLICIES).default('full'),
  /** Counts tab switches and warns; it never blocks, because a browser cannot be trusted to. */
  trackTabSwitches: z.boolean().default(true),
  requireFullScreen: z.boolean().default(false),
  showRank: z.boolean().default(false),
});
export type TestSettings = z.infer<typeof testSettingsSchema>;

export const testCreateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).default(''),
  kind: z.enum(TEST_KINDS).default('weekly'),
  subject: z.string().trim().max(60).default(''),
  instructions: z.string().trim().max(20_000).default(''),
  settings: testSettingsSchema.default({
    durationMinutes: 60,
    maxAttempts: 1,
    shuffleQuestions: false,
    shuffleOptions: false,
    resultPolicy: 'on_release',
    reviewPolicy: 'full',
    trackTabSwitches: true,
    requireFullScreen: false,
    showRank: false,
  }),
});
export type TestCreateInput = z.infer<typeof testCreateSchema>;

export const testUpdateSchema = patchSchemaOf(testCreateSchema);

export const testQuestionSchema = z.object({
  questionId: z.uuid(),
  marks: z.number().int().min(1).max(100).optional(),
  negativeMarks: z.number().min(0).max(100).optional(),
});

export const testSectionSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2).max(160),
  instructions: z.string().trim().max(5000).default(''),
  questions: z.array(testQuestionSchema).max(200),
});

export const testPaperSchema = z.object({
  sections: z.array(testSectionSchema).max(20),
});
export type TestPaperInput = z.infer<typeof testPaperSchema>;

export const testScheduleSchema = z
  .object({
    batchId: z.uuid(),
    opensAt: z.iso.datetime(),
    closesAt: z.iso.datetime(),
    /** Overrides the test's own attempt limit for this batch when set. */
    maxAttempts: z.number().int().min(1).max(10).nullable().default(null),
  })
  .refine((v) => v.closesAt > v.opensAt, {
    path: ['closesAt'],
    message: 'The window must close after it opens',
  });
export type TestScheduleInput = z.infer<typeof testScheduleSchema>;

/**
 * Moving a window. Before anyone has started it may change freely; afterwards it may only stay open
 * longer and allow more attempts (Phases 3–4, TRN-05).
 */
export const testScheduleUpdateSchema = z.object({
  opensAt: z.iso.datetime().optional(),
  closesAt: z.iso.datetime().optional(),
  maxAttempts: z.number().int().min(1).max(10).nullable().optional(),
});
export type TestScheduleUpdateInput = z.infer<typeof testScheduleUpdateSchema>;

/** The grading queue: answers waiting for a mark, or those already marked, to re-mark. */
export const testGradingQuerySchema = z.object({
  state: z.enum(['pending', 'marked']).default('pending'),
});

export const testListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(TEST_STATUSES).optional(),
  kind: z.enum(TEST_KINDS).optional(),
  batchId: z.uuid().optional(),
});

// ───────────────────────── sitting a test ─────────────────────────

export const ATTEMPT_STATUSES = ['in_progress', 'submitted', 'graded', 'abandoned'] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/** One autosave. Answers arrive in batches, so a dropped connection costs at most one interval. */
export const attemptAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        testQuestionId: z.uuid(),
        optionIds: z.array(z.uuid()).max(10).default([]),
        text: z.string().max(50_000).default(''),
        code: z.string().max(100_000).default(''),
        language: z.string().max(40).default(''),
        flagged: z.boolean().default(false),
        timeSpentSeconds: z.number().int().min(0).max(86_400).default(0),
      }),
    )
    .max(200),
});
export type AttemptAnswersInput = z.infer<typeof attemptAnswersSchema>;

/** Integrity signals the client reports. They are recorded and shown, never used to block. */
export const integrityEventSchema = z.object({
  type: z.enum(['tab_switch', 'blur', 'fullscreen_exit', 'paste']),
  occurredAt: z.iso.datetime(),
});

export const attemptSubmitSchema = z.object({
  /** True when the client's timer ran out rather than the learner pressing submit. */
  auto: z.boolean().default(false),
});

export const attemptGradeSchema = z.object({
  marks: z.number().min(0).max(100),
  comment: z.string().trim().max(2000).default(''),
});

// ───────────────────────── responses ─────────────────────────

export interface TestSummary {
  id: string;
  title: string;
  description: string;
  kind: TestKind;
  subject: string;
  status: TestStatus;
  settings: TestSettings;
  sectionCount: number;
  questionCount: number;
  totalMarks: number;
  scheduleCount: number;
  createdAt: string;
}

export interface TestQuestionView {
  id: string;
  questionId: string;
  title: string;
  type: QuestionType;
  marks: number;
  negativeMarks: number;
  position: number;
}

export interface TestSectionView {
  id: string;
  title: string;
  instructions: string;
  position: number;
  questions: TestQuestionView[];
}

export interface TestDetail extends TestSummary {
  instructions: string;
  sections: TestSectionView[];
}

export interface TestScheduleRecord {
  id: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  opensAt: string;
  closesAt: string;
  maxAttempts: number | null;
  learners: number;
  started: number;
  submitted: number;
  releasedAt: string | null;
}

/**
 * The question types a timed paper can take: the paper answers choices, written text and code. A
 * SQL, file, practical or project question needs a workspace the paper does not have, and would
 * score nothing (Phase 2, LRN-07).
 */
export const TEST_QUESTION_TYPES: readonly QuestionType[] = [
  'mcq_single',
  'mcq_multi',
  'true_false',
  'descriptive',
  'coding',
];

/** One of the learner's own attempts at a test window, newest first on the card. */
export interface TestAttemptSummary {
  attemptId: string;
  attempt: number;
  status: AttemptStatus;
  submittedAt: string | null;
}

/** A card on the learner's test list. */
export interface TestCard {
  testId: string;
  scheduleId: string;
  title: string;
  /** What the author wrote for learners: shown before the paper starts. */
  description: string;
  instructions: string;
  kind: TestKind;
  subject: string;
  durationMinutes: number;
  opensAt: string;
  closesAt: string;
  /** upcoming while the window is ahead, live inside it, closed after. */
  window: 'upcoming' | 'live' | 'closed';
  attemptsUsed: number;
  maxAttempts: number;
  canStart: boolean;
  attemptId: string | null;
  attemptStatus: AttemptStatus | null;
  /** Every attempt the learner has made in this window, newest first. */
  attempts: TestAttemptSummary[];
  resultAvailable: boolean;
  score: number | null;
  totalMarks: number;
}

/** The paper as the learner sees it while sitting: no answers, no marks scheme give-aways. */
export interface AttemptQuestionView {
  testQuestionId: string;
  sectionId: string;
  title: string;
  body: string;
  type: QuestionType;
  marks: number;
  negativeMarks: number;
  options: { id: string; body: string }[];
  coding: {
    languages: string[];
    starterCode: Record<string, string>;
    timeLimitMs: number;
    testCases: { id: string; input: string; expectedOutput: string }[];
  } | null;
  /** The learner's saved answer. */
  optionIds: string[];
  text: string;
  code: string;
  language: string;
  flagged: boolean;
}

export interface AttemptState {
  attemptId: string;
  testId: string;
  title: string;
  status: AttemptStatus;
  startedAt: string;
  /** The server's deadline. The client counts down to it; the server decides when it passed. */
  expiresAt: string;
  serverTime: string;
  secondsRemaining: number;
  settings: Pick<
    TestSettings,
    'durationMinutes' | 'trackTabSwitches' | 'requireFullScreen' | 'shuffleOptions'
  >;
  sections: { id: string; title: string; instructions: string; position: number }[];
  questions: AttemptQuestionView[];
  tabSwitches: number;
  savedAt: string | null;
}

export interface AttemptResultQuestion {
  testQuestionId: string;
  title: string;
  type: QuestionType;
  marks: number;
  awardedMarks: number;
  status: SubmissionStatus;
  timeSpentSeconds: number;
  /** Present only when the review policy allows it, once the window has closed. */
  body?: string;
  options?: { id: string; body: string }[];
  explanation?: string;
  yourOptionIds?: string[];
  correctOptionIds?: string[];
  yourText?: string;
  graderComment?: string;
}

export interface AttemptResult {
  attemptId: string;
  testId: string;
  title: string;
  status: AttemptStatus;
  submittedAt: string | null;
  released: boolean;
  score: number;
  totalMarks: number;
  percentage: number;
  rank: number | null;
  cohortSize: number | null;
  sections: { id: string; title: string; score: number; totalMarks: number }[];
  questions: AttemptResultQuestion[];
  reviewPolicy: ReviewPolicy;
  /** Set while the answers are held back until the window closes; null otherwise. */
  reviewOpensAt: string | null;
  pendingGrading: number;
}

/** One row of the staff results table. */
export interface TestResultRow {
  attemptId: string;
  studentId: string;
  studentCode: string;
  name: string;
  batchCode: string;
  status: AttemptStatus;
  score: number;
  totalMarks: number;
  percentage: number;
  submittedAt: string | null;
  tabSwitches: number;
  pendingGrading: number;
}

/** What the monitor shows while a test is running. */
export interface TestMonitor {
  scheduleId: string;
  batchCode: string;
  opensAt: string;
  closesAt: string;
  learners: number;
  notStarted: number;
  inProgress: number;
  submitted: number;
  flagged: { attemptId: string; name: string; tabSwitches: number }[];
  asOf: string;
}

/** One entry of the written-answer grading queue for a test. */
export interface TestGradingItem {
  answerId: string;
  attemptId: string;
  testQuestionId: string;
  questionTitle: string;
  rubric: string;
  maxMarks: number;
  studentName: string;
  studentCode: string;
  answer: string;
  language: string;
  submittedAt: string | null;
  /** Set once marked by a person. */
  marks: number | null;
  graderComment: string;
  gradedAt: string | null;
}
