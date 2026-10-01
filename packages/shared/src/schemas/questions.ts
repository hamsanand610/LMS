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
  'sql',
  'file_upload',
  'practical',
  'project',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq_single: 'Single choice',
  mcq_multi: 'Multiple choice',
  true_false: 'True or false',
  descriptive: 'Written answer',
  coding: 'Coding',
  sql: 'SQL',
  file_upload: 'File upload',
  practical: 'Practical',
  project: 'Project',
};

/** The objective types: marked the moment they are answered. */
export const OBJECTIVE_TYPES: readonly QuestionType[] = ['mcq_single', 'mcq_multi', 'true_false'];
/** Answered with code and marked by running it in the sandbox. */
export const EXECUTED_TYPES: readonly QuestionType[] = ['coding', 'sql'];
/** Marked by a person against a rubric. */
export const REVIEWED_TYPES: readonly QuestionType[] = [
  'descriptive',
  'file_upload',
  'practical',
  'project',
];

/** Types the platform can mark without a person reading the answer. */
export const AUTO_GRADED_TYPES: readonly QuestionType[] = [...OBJECTIVE_TYPES, ...EXECUTED_TYPES];

/** From first steps to company-style rounds, in the order a learner meets them. */
export const QUESTION_DIFFICULTIES = [
  'beginner',
  'foundation',
  'easy',
  'medium',
  'hard',
  'interview',
  'company',
] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  beginner: 'Beginner',
  foundation: 'Foundation',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  interview: 'Interview',
  company: 'Company round',
};

export const QUESTION_STATUSES = ['draft', 'published', 'retired'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/** Languages a coding question may be answered in; each runs in the sandbox (ADR-0016). */
export const CODE_LANGUAGES = ['java', 'python', 'javascript', 'php'] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

/** Everything the sandbox runs: the code languages and SQL. */
export const EXECUTION_LANGUAGES = [...CODE_LANGUAGES, 'sql'] as const;
export type ExecutionLanguage = (typeof EXECUTION_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<ExecutionLanguage, string> = {
  java: 'Java',
  python: 'Python',
  javascript: 'JavaScript',
  php: 'PHP',
  sql: 'SQL',
};

/** The file a learner's code is written to, as the editor tab shows it. */
export const LANGUAGE_FILE_NAMES: Record<ExecutionLanguage, string> = {
  java: 'Main.java',
  python: 'main.py',
  javascript: 'main.js',
  php: 'main.php',
  sql: 'query.sql',
};

/**
 * How a program's output is compared with the expected output. `trim` (the default) ignores
 * trailing spaces on each line and trailing blank lines; `tokens` ignores all spacing; `float`
 * compares numbers to within 1e-6. SQL answers compare result tables, in order or not.
 */
export const COMPARE_MODES = ['exact', 'trim', 'tokens', 'unordered_lines', 'float'] as const;
export const SQL_COMPARE_MODES = ['rows', 'rows_unordered'] as const;
export type CompareMode = (typeof COMPARE_MODES)[number] | (typeof SQL_COMPARE_MODES)[number];

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
  /** For SQL: statements that add this case's own rows to the shared setup (may be empty). */
  input: z.string().max(20_000).default(''),
  /** For SQL: the expected result table as JSON; filled in by validation when left empty. */
  expectedOutput: z.string().max(100_000).default(''),
  /** Sample cases are shown to the learner; hidden ones are only counted. */
  isSample: z.boolean().default(false),
  weight: z.number().int().min(1).max(100).default(1),
  label: z.string().trim().max(120).default(''),
  explanation: z.string().trim().max(2000).default(''),
  /** A disabled case is kept but not run or counted. */
  enabled: z.boolean().default(true),
  /** Limits for this case alone; null uses the problem's. */
  timeLimitMs: z.number().int().min(100).max(30_000).nullable().default(null),
  memoryLimitMb: z.number().int().min(16).max(512).nullable().default(null),
});
export type TestCaseInput = z.infer<typeof testCaseSchema>;

export const codingProblemSchema = z.object({
  languages: z.array(z.enum(EXECUTION_LANGUAGES)).min(1).max(5),
  /** Code the learner starts from, per language. */
  starterCode: z.record(z.string(), z.string().max(20_000)).default({}),
  /** A solution that must pass every test case before the question may be published. */
  referenceSolution: z.record(z.string(), z.string().max(20_000)).default({}),
  timeLimitMs: z.number().int().min(100).max(30_000).default(5000),
  memoryLimitMb: z.number().int().min(16).max(512).default(128),
  inputFormat: z.string().trim().max(4000).default(''),
  outputFormat: z.string().trim().max(4000).default(''),
  constraints: z.string().trim().max(4000).default(''),
  compareMode: z.enum([...COMPARE_MODES, ...SQL_COMPARE_MODES]).default('trim'),
  /** SQL: the schema and rows every case starts from. */
  setupSql: z.string().max(50_000).default(''),
  /** SQL that changes data: the query whose result is compared after the learner's statements. */
  sqlCheck: z.string().max(10_000).default(''),
  testCases: z.array(testCaseSchema).min(1).max(50),
});
export type CodingProblemInput = z.infer<typeof codingProblemSchema>;

/** Kinds of file a file-upload, practical or project answer may carry. */
export const ANSWER_FILE_KINDS = ['pdf', 'zip', 'image', 'document', 'text'] as const;
export type AnswerFileKind = (typeof ANSWER_FILE_KINDS)[number];

/** The upload types each kind stands for. */
export const ANSWER_FILE_KIND_MIMES: Record<AnswerFileKind, readonly string[]> = {
  pdf: ['application/pdf'],
  zip: ['application/zip'],
  image: ['image/png', 'image/jpeg', 'image/webp'],
  document: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  text: ['text/plain', 'text/csv'],
};

/** What a file-upload, practical or project answer must contain. */
export const questionSpecSchema = z.object({
  fileKinds: z.array(z.enum(ANSWER_FILE_KINDS)).max(5).default([]),
  maxFiles: z.number().int().min(0).max(5).default(0),
  /** A link the learner must give (a repository, a deployed page). */
  linkRequired: z.boolean().default(false),
  linkLabel: z.string().trim().max(80).default(''),
  /** Points the learner confirms before submitting, which the reviewer checks. */
  checklist: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
});
export type QuestionSpec = z.infer<typeof questionSpecSchema>;

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
    /** Nudges a learner opens one at a time, in order. */
    hints: z.array(z.string().trim().min(1).max(2000)).max(5).default([]),
    spec: questionSpecSchema.default({
      fileKinds: [],
      maxFiles: 0,
      linkRequired: false,
      linkLabel: '',
      checklist: [],
    }),
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
    const executed = value.type === 'coding' || value.type === 'sql';
    if (executed && !value.coding) {
      add('coding', 'This question needs its languages and test cases');
    }
    if (!executed && value.coding) {
      add('coding', 'Only a coding or SQL question carries test cases');
    }
    if (value.type === 'coding' && value.coding) {
      if (value.coding.languages.includes('sql')) {
        add('coding', 'Write SQL problems as SQL questions');
      }
      if ((SQL_COMPARE_MODES as readonly string[]).includes(value.coding.compareMode)) {
        add('coding', 'Compare program output as text, not as a result table');
      }
    }
    if (value.type === 'sql' && value.coding) {
      if (value.coding.languages.length !== 1 || value.coding.languages[0] !== 'sql') {
        add('coding', 'An SQL question is answered in SQL only');
      }
      if (!value.coding.setupSql.trim()) {
        add('coding', 'Give the tables and rows the query runs against');
      }
      if (!(SQL_COMPARE_MODES as readonly string[]).includes(value.coding.compareMode)) {
        add('coding', 'Compare an SQL answer as a result table');
      }
    }
    const handedIn = ['file_upload', 'practical', 'project'].includes(value.type);
    if (handedIn && value.spec.maxFiles === 0 && !value.spec.linkRequired) {
      add('spec', 'Ask for at least one file or a link');
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

/**
 * Where a result came from. The sandbox and Judge0 run code away from the learner, so their
 * verdicts are trusted; `untrusted` remains only on runs recorded before ADR-0016.
 */
export const TRUST_LEVELS = ['untrusted', 'trusted'] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

/**
 * The outcome of one run, and of each case inside it. `failed` and `error` are the overall
 * words; the rest say what went wrong with a case.
 */
export const EXECUTION_VERDICTS = [
  'passed',
  'failed',
  'wrong_answer',
  'compile_error',
  'runtime_error',
  'timeout',
  'memory_limit',
  'output_limit',
  'error',
  'pending',
] as const;
export type ExecutionVerdict = (typeof EXECUTION_VERDICTS)[number];

export const VERDICT_LABELS: Record<ExecutionVerdict, string> = {
  passed: 'Passed',
  failed: 'Failed',
  wrong_answer: 'Wrong answer',
  compile_error: 'Compilation error',
  runtime_error: 'Runtime error',
  timeout: 'Time limit exceeded',
  memory_limit: 'Memory limit exceeded',
  output_limit: 'Output too long',
  error: 'Could not be run',
  pending: 'Running',
};

/** One case as a learner may see it. Hidden cases carry only the verdict and the timing. */
export interface CaseOutcome {
  testCaseId: string | null;
  /** Position among the cases that ran, from 1; "Test 3" in the results. */
  number: number;
  label: string;
  hidden: boolean;
  verdict: ExecutionVerdict;
  passed: boolean;
  durationMs: number | null;
  memoryKb: number | null;
  /** Visible cases (and custom input) only. */
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  stderr?: string;
  explanation?: string;
}

/** What a Run returns: visible cases or the learner's own input, nothing recorded. */
export interface RunOutcome {
  verdict: ExecutionVerdict;
  compileOutput: string;
  cases: CaseOutcome[];
  passed: number;
  total: number;
  durationMs: number | null;
  memoryKb: number | null;
  /** When the run used custom input: what the program printed. */
  output?: { stdout: string; stderr: string; exitCode: number | null };
}

export const runInputSchema = z.object({
  language: z.enum(EXECUTION_LANGUAGES),
  code: z.string().min(1, 'Write some code first').max(64_000),
  /** When given, the program runs once on this input instead of the visible cases. */
  customInput: z.string().max(20_000).nullable().default(null),
  /** Only these visible cases; all of them when left out. Hidden cases can never be chosen. */
  caseIds: z.array(z.uuid()).max(50).optional(),
});
export type RunInput = z.infer<typeof runInputSchema>;

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
  /** Staff see every hint; a learner, the ones they have opened (the workspace asks for more). */
  hints: string[];
  spec: QuestionSpec;
  options: QuestionOptionView[];
  coding: {
    languages: ExecutionLanguage[];
    starterCode: Record<string, string>;
    referenceSolution?: Record<string, string>;
    timeLimitMs: number;
    memoryLimitMb: number;
    inputFormat: string;
    outputFormat: string;
    constraints: string;
    compareMode: CompareMode;
    /** Staff only: the tables every case starts from. Learners see the schema in the statement. */
    setupSql?: string;
    sqlCheck?: string;
    testCases: {
      id: string;
      isSample: boolean;
      weight: number;
      label: string;
      enabled: boolean;
      timeLimitMs: number | null;
      memoryLimitMb: number | null;
      /** Visible cases for everyone; hidden cases for staff only. */
      input?: string;
      expectedOutput?: string;
      explanation?: string;
    }[];
  } | null;
  validation: QuestionValidation | null;
  /** Staff only: whether it is in the practice catalogue, and for how many points. */
  practice: { inCatalogue: boolean; points: number } | null;
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
