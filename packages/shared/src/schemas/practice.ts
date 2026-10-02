import { z } from 'zod';
import { paginationQuerySchema } from './common.js';
import {
  EXECUTION_LANGUAGES,
  LAB_TYPES,
  QUESTION_DIFFICULTIES,
  runInputSchema,
  type CaseOutcome,
  type CompareMode,
  type ExecutionLanguage,
  type ExecutionVerdict,
  type LabType,
  type QuestionDifficulty,
  type TrustLevel,
} from './questions.js';
import type { WebCheckView, WebFiles } from './web-lab.js';

/**
 * Practice is the Labs area (ADR-0018): a view over the executed questions in the bank — coding,
 * SQL, debugging and web — that their authors put in the catalogue. Nothing is authored twice.
 */
export const PRACTICE_STATUSES = ['solved', 'attempted', 'not_attempted'] as const;
export type PracticeStatus = (typeof PRACTICE_STATUSES)[number];

export const practiceListQuerySchema = paginationQuerySchema.extend({
  type: z.enum(LAB_TYPES).optional(),
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
  type: LabType;
  topic: string;
  difficulty: QuestionDifficulty;
  languages: ExecutionLanguage[];
  points: number;
  status: PracticeStatus;
  attempts: number;
  acceptedCount: number;
}

/** One table of an SQL lab's dataset, read in the sandbox (ADR-0020). */
export interface SqlSchemaTable {
  name: string;
  columns: { name: string; type: string; primaryKey: boolean; notNull: boolean }[];
}

/** A visible Web Lab check, in words; hidden checks are only counted. */

export interface PracticeProblemDetail extends PracticeProblemCard {
  body: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  /** Debugging: what the program should do once it is fixed. */
  expectedBehaviour: string;
  compareMode: CompareMode;
  /** SQL: the tables and rows the query runs against. */
  schemaSql: string;
  /** SQL: the dataset's tables and columns; null until the sandbox has read them. */
  sqlSchema: SqlSchemaTable[] | null;
  hints: string[];
  starterCode: Record<string, string>;
  /** Web: the starting files, decoded from the starter code. */
  starterFiles: WebFiles | null;
  timeLimitMs: number;
  memoryLimitMb: number;
  /** Only the sample cases; hidden ones are counted, never shown. Empty for a web lab. */
  samples: {
    id: string;
    label: string;
    input: string;
    expectedOutput: string;
    explanation: string;
  }[];
  /** Web: the visible checks, in words. */
  checks: WebCheckView[];
  hiddenTestCount: number;
  /** Staff previewing a lab that learners cannot see yet. */
  preview?: { status: 'draft' | 'published' | 'retired'; inCatalogue: boolean };
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

/** One earlier submission, as its author sees it: the code, and how each case went. */
export interface PracticeSubmissionDetail extends PracticeSubmissionRecord {
  code: string;
  cases: {
    number: number;
    label: string;
    hidden: boolean;
    verdict: ExecutionVerdict;
    passed: boolean;
  }[];
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
  /** How many labs of each type the catalogue offers. */
  byType: Record<LabType, number>;
}
