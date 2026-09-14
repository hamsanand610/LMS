import { z } from 'zod';
import { paginationQuerySchema } from './common.js';
import {
  EXECUTION_LANGUAGES,
  QUESTION_DIFFICULTIES,
  type ExecutionLanguage,
  type QuestionDifficulty,
  type TrustLevel,
  executionResultSchema,
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

/** A run against the sample cases only, so the learner can try something before submitting. */
export const practiceRunSchema = z.object({
  language: z.enum(EXECUTION_LANGUAGES),
  code: z.string().min(1).max(100_000),
  result: executionResultSchema,
});
export type PracticeRunInput = z.infer<typeof practiceRunSchema>;

/** A submission runs every case, including the hidden ones, and is recorded. */
export const practiceSubmitSchema = z.object({
  language: z.enum(EXECUTION_LANGUAGES),
  code: z.string().min(1).max(100_000),
  result: executionResultSchema,
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
  body: string;
  starterCode: Record<string, string>;
  timeLimitMs: number;
  memoryLimitMb: number;
  /** Only the sample cases; hidden ones are counted, never shown. */
  samples: { id: string; input: string; expectedOutput: string }[];
  hiddenTestCount: number;
}

export interface PracticeSubmissionRecord {
  id: string;
  language: ExecutionLanguage;
  verdict: string;
  trust: TrustLevel;
  driver: string;
  passed: number;
  total: number;
  durationMs: number;
  submittedAt: string;
}

export interface PracticeSummary {
  solved: number;
  attempted: number;
  total: number;
  points: number;
}
