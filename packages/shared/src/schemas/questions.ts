import { z } from 'zod';
import { paginationQuerySchema, SHEET_ENCODINGS } from './common.js';

/**
 * What a question asks of the learner. `mcq_single` and `mcq_multi` differ only in how many
 * options may be chosen; keeping them apart lets the workspace render radios or checkboxes
 * without guessing from the data.
 */
export const QUESTION_TYPES = [
  'mcq_single',
  'mcq_multi',
  'true_false',
  'descriptive',
  'coding',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Types the platform can mark without a person reading the answer. */
export const AUTO_GRADED_TYPES: readonly QuestionType[] = ['mcq_single', 'mcq_multi', 'true_false'];

export const QUESTION_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export const QUESTION_STATUSES = ['draft', 'published', 'retired'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/** Languages the demo's browser driver can run. A Judge0 host adds more without a code change. */
export const EXECUTION_LANGUAGES = ['javascript', 'python'] as const;
export type ExecutionLanguage = (typeof EXECUTION_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<ExecutionLanguage, string> = {
  javascript: 'JavaScript',
  python: 'Python',
};

// ───────────────────────── authoring ─────────────────────────

export const questionOptionSchema = z.object({
  id: z.uuid().optional(),
  body: z.string().trim().min(1).max(2000),
  isCorrect: z.boolean().default(false),
  explanation: z.string().trim().max(2000).default(''),
});
export type QuestionOptionInput = z.infer<typeof questionOptionSchema>;

export const testCaseSchema = z.object({
  id: z.uuid().optional(),
  input: z.string().max(20_000).default(''),
  expectedOutput: z.string().max(20_000).default(''),
  /** Sample cases are shown to the learner; hidden ones are only counted. */
  isSample: z.boolean().default(false),
  weight: z.number().int().min(1).max(100).default(1),
});
export type TestCaseInput = z.infer<typeof testCaseSchema>;

export const codingProblemSchema = z.object({
  languages: z.array(z.enum(EXECUTION_LANGUAGES)).min(1).max(10),
  /** Code the learner starts from, per language. */
  starterCode: z.record(z.string(), z.string().max(20_000)).default({}),
  /** A solution that must pass every test case before the question may be published. */
  referenceSolution: z.record(z.string(), z.string().max(20_000)).default({}),
  timeLimitMs: z.number().int().min(100).max(30_000).default(5000),
  memoryLimitMb: z.number().int().min(16).max(512).default(128),
  testCases: z.array(testCaseSchema).min(1).max(50),
});
export type CodingProblemInput = z.infer<typeof codingProblemSchema>;

export const questionCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    body: z.string().trim().min(1).max(20_000),
    type: z.enum(QUESTION_TYPES),
    subject: z.string().trim().max(60).default(''),
    topic: z.string().trim().max(60).default(''),
    difficulty: z.enum(QUESTION_DIFFICULTIES).default('easy'),
    marks: z.number().int().min(1).max(100).default(1),
    negativeMarks: z.number().min(0).max(100).default(0),
    explanation: z.string().trim().max(20_000).default(''),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    /** Present for the two MCQ types and for true/false. */
    options: z.array(questionOptionSchema).max(10).default([]),
    /** The mark scheme a person grades a written answer against. */
    rubric: z.string().trim().max(20_000).default(''),
    coding: codingProblemSchema.nullable().default(null),
  })
  .superRefine((value, ctx) => {
    const add = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    if (value.type === 'mcq_single' || value.type === 'mcq_multi') {
      if (value.options.length < 2)
        add('options', 'A multiple-choice question needs at least two options');
      const correct = value.options.filter((o) => o.isCorrect).length;
      if (correct === 0) add('options', 'Mark which option is correct');
      if (value.type === 'mcq_single' && correct > 1) {
        add('options', 'Only one option can be correct in a single-answer question');
      }
    }
    if (value.type === 'true_false' && value.options.length !== 2) {
      add('options', 'A true/false question has exactly two options');
    }
    if (value.type === 'coding' && !value.coding) {
      add('coding', 'A coding question needs its languages and test cases');
    }
    if (value.type !== 'coding' && value.coding) {
      add('coding', 'Only a coding question carries a coding problem');
    }
  });
export type QuestionCreateInput = z.infer<typeof questionCreateSchema>;

/** The same shape for an edit; the type of a saved question cannot change. */
export const questionUpdateSchema = questionCreateSchema;

export const questionListQuerySchema = paginationQuerySchema.extend({
  type: z.enum(QUESTION_TYPES).optional(),
  subject: z.string().max(60).optional(),
  topic: z.string().max(60).optional(),
  difficulty: z.enum(QUESTION_DIFFICULTIES).optional(),
  status: z.enum(QUESTION_STATUSES).optional(),
  /** `me` restricts the list to the caller's own questions. */
  author: z.string().max(64).optional(),
  tag: z.string().max(40).optional(),
});

export const questionStatusSchema = z.object({
  status: z.enum(QUESTION_STATUSES),
});

// ───────────────────────── validation ─────────────────────────

/** One test case run against a submitted or reference solution. */
export interface TestCaseResult {
  testCaseId: string;
  isSample: boolean;
  passed: boolean;
  /** Only ever filled in for sample cases, so hidden cases stay hidden. */
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  stderr?: string;
  durationMs: number;
}

/**
 * Where a result came from. The browser driver runs code on the learner's own machine, so its
 * verdicts are recorded but never trusted; a Judge0 host runs it away from both of them.
 */
export const TRUST_LEVELS = ['untrusted', 'trusted'] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

export const EXECUTION_VERDICTS = ['passed', 'failed', 'error', 'timeout', 'pending'] as const;
export type ExecutionVerdict = (typeof EXECUTION_VERDICTS)[number];

/** What a driver reports back after running code against a question's test cases. */
export const executionResultSchema = z.object({
  language: z.enum(EXECUTION_LANGUAGES),
  verdict: z.enum(EXECUTION_VERDICTS),
  driver: z.string().min(1).max(40),
  durationMs: z.number().int().min(0).max(600_000).default(0),
  compileError: z.string().max(10_000).default(''),
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
});
export type ExecutionResultInput = z.infer<typeof executionResultSchema>;

/** A validation run of a question's own reference solution. */
export interface QuestionValidation {
  ok: boolean;
  driver: string;
  trust: TrustLevel;
  /** One entry per language the question offers. */
  languages: {
    language: ExecutionLanguage;
    ok: boolean;
    passed: number;
    total: number;
    message: string;
  }[];
  validatedAt: string;
}

// ───────────────────────── responses ─────────────────────────

export interface QuestionSummary {
  id: string;
  title: string;
  type: QuestionType;
  subject: string;
  topic: string;
  difficulty: QuestionDifficulty;
  marks: number;
  status: QuestionStatus;
  version: number;
  tags: string[];
  authorId: string | null;
  authorName: string | null;
  /** How many assignments and tests currently use it. */
  usageCount: number;
  createdAt: string;
}

export interface QuestionOptionView {
  id: string;
  body: string;
  /** Withheld from a learner until the answer may be revealed. */
  isCorrect?: boolean;
  explanation?: string;
  position: number;
}

export interface QuestionDetail extends QuestionSummary {
  body: string;
  negativeMarks: number;
  explanation: string;
  rubric: string;
  options: QuestionOptionView[];
  coding: {
    languages: ExecutionLanguage[];
    starterCode: Record<string, string>;
    referenceSolution?: Record<string, string>;
    timeLimitMs: number;
    memoryLimitMb: number;
    testCases: {
      id: string;
      isSample: boolean;
      weight: number;
      input?: string;
      expectedOutput?: string;
    }[];
  } | null;
  validation: QuestionValidation | null;
}

export interface QuestionVersionRecord {
  version: number;
  changedBy: string | null;
  changedAt: string;
  summary: string;
}

// ───────────────────────── import ─────────────────────────

/** Columns the objective-question import sheet expects, in order. */
export const QUESTION_IMPORT_COLUMNS = [
  'title',
  'body',
  'type',
  'subject',
  'topic',
  'difficulty',
  'marks',
  'negative_marks',
  'explanation',
  'option_1',
  'option_2',
  'option_3',
  'option_4',
  'correct',
] as const;

export interface QuestionImportRowError {
  row: number;
  column: string;
  message: string;
}

export interface QuestionImportResult {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: QuestionImportRowError[];
}

export const questionImportSchema = z.object({
  /** The sheet itself: CSV or TSV text, or a base64 `.xlsx` workbook when `encoding` says so. */
  content: z.string().min(1).max(5_000_000),
  encoding: z.enum(SHEET_ENCODINGS).default('text'),
  /** When true nothing is written and the errors are reported as they would be. */
  dryRun: z.boolean().default(false),
  /** Imported questions start as drafts unless the importer asks otherwise. */
  publish: z.boolean().default(false),
});
export type QuestionImportInput = z.infer<typeof questionImportSchema>;
