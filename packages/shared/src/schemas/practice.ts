import { z } from 'zod';
import { paginationQuerySchema } from './common.js';
import {
  EXECUTION_LANGUAGES,
  QUESTION_DIFFICULTIES,
  runInputSchema,
  type CaseOutcome,
  type CompareMode,
  type ExecutionLanguage,
  type ExecutionVerdict,
  type QuestionDifficulty,
  type TrustLevel,
} from './questions.js';

/**
 * Practice is a view over the coding questions in the bank: a problem is a published coding
 * question its author put in the catalogue. Nothing is authored twice.
 */
export const PRACTICE_STATUSES = ['solved', 'attempted', 'not_attempted'] as const;
export type PracticeStatus = (typeof PRACTICE_STATUSES)[number];

export const practiceListQuerySchema = paginationQuerySchema.extend({
  topic: z.string().max(60).optional(),
  difficulty: z.enum(QUESTION_DIFFICULTIES).optional(),
  language: z.enum(EXECUTION_LANGUAGES).optional(),
  status: z.enum(PRACTICE_STATUSES).optional(),
});

/**
 * A run against the visible cases, or once on the learner's own input, in the sandbox. Nothing is
 * recorded and nothing is solved by it.
 */
export const practiceRunSchema = runInputSchema;
export type PracticeRunInput = z.infer<typeof practiceRunSchema>;

/** A submission runs every case in the sandbox, the hidden ones included, and is recorded. */
export const practiceSubmitSchema = z.object({
  language: z.enum(EXECUTION_LANGUAGES),
  code: z.string().min(1, 'Write some code first').max(64_000),
});
export type PracticeSubmitInput = z.infer<typeof practiceSubmitSchema>;

export const practiceCatalogueSchema = z.object({
  inCatalogue: z.boolean(),
  points: z.number().int().min(0).max(1000).default(10),
});

export interface PracticeProblemCard {
  questionId: string;
  slug: string;
  title: string;
  topic: string;
  difficulty: QuestionDifficulty;
  languages: ExecutionLanguage[];
  points: number;
  status: PracticeStatus;
  attempts: number;
  acceptedCount: number;
}

export interface PracticeProblemDetail extends PracticeProblemCard {
  type: 'coding' | 'sql';
  body: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  compareMode: CompareMode;
  /** SQL: the tables and rows the query runs against. */
  schemaSql: string;
  hints: string[];
  starterCode: Record<string, string>;
  timeLimitMs: number;
  memoryLimitMb: number;
  /** Only the sample cases; hidden ones are counted, never shown. */
  samples: {
    id: string;
    label: string;
    input: string;
    expectedOutput: string;
    explanation: string;
  }[];
  hiddenTestCount: number;
}

export interface PracticeSubmissionRecord {
  id: string;
  language: ExecutionLanguage;
  verdict: ExecutionVerdict;
  trust: TrustLevel;
  driver: string;
  passed: number;
  total: number;
  durationMs: number;
  submittedAt: string;
}

/** What a practice submission returns: the verdict and every case, hidden ones without detail. */
export interface PracticeSubmitOutcome {
  submission: PracticeSubmissionRecord;
  compileOutput: string;
  cases: CaseOutcome[];
  /** True the first time every case passes; points are awarded once. */
  newlySolved: boolean;
}

export interface PracticeSummary {
  solved: number;
  attempted: number;
  total: number;
  points: number;
  /** The topics the catalogue covers, for the topic filter. */
  topics: string[];
}
