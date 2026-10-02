import { z } from 'zod';
import { addDaysToDateKey, toLocalDateKey, zonedDateTimeToUtc } from '../utils/time.js';

/**
 * Feedback (F-18, decision D10 of Phases 3–4). An administrator gives a form to a batch, once or
 * every week from Friday to Sunday (AC-13.1); its learners answer, anonymously unless the form says
 * otherwise, and nothing then ties an answer to them (AC-13.2); figures are shown only once five
 * learners have answered.
 */

export const FEEDBACK_QUESTION_KINDS = ['rating', 'choice', 'text'] as const;
export type FeedbackQuestionKind = (typeof FEEDBACK_QUESTION_KINDS)[number];

export const FEEDBACK_CADENCES = ['once', 'weekly'] as const;
export type FeedbackCadence = (typeof FEEDBACK_CADENCES)[number];

/** Below this many answers no figure, chart or comment is shown, so nobody can be singled out. */
export const FEEDBACK_MIN_RESPONSES = 5;

/** Ratings run from 1 to this. */
export const FEEDBACK_RATING_MAX = 5;

export const feedbackQuestionSchema = z
  .object({
    /** Stable within the form: answers are keyed by it. */
    id: z.string().regex(/^[a-z0-9-]{1,40}$/, 'Lowercase letters, digits and hyphens'),
    kind: z.enum(FEEDBACK_QUESTION_KINDS),
    prompt: z.string().trim().min(3).max(200),
    required: z.boolean().default(true),
    options: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'choice' && value.options.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Give at least two choices' });
    }
    if (value.kind !== 'choice' && value.options.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Only a choice has options' });
    }
  });
export type FeedbackQuestion = z.infer<typeof feedbackQuestionSchema>;

export const feedbackFormCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(1000).default(''),
    batchId: z.uuid(),
    /** The trainer it is about, who then sees its figures. */
    trainerId: z.uuid().nullable().default(null),
    courseId: z.uuid().nullable().default(null),
    anonymous: z.boolean().default(true),
    cadence: z.enum(FEEDBACK_CADENCES).default('once'),
    /** Once: when it opens. Weekly: the first week it runs. */
    opensAt: z.iso.datetime(),
    /** Once: when it closes (required). Weekly: when the weekly rounds stop (optional). */
    closesAt: z.iso.datetime().nullable().default(null),
    questions: z.array(feedbackQuestionSchema).min(1).max(20),
  })
  .superRefine((value, ctx) => {
    if (value.cadence === 'once' && !value.closesAt) {
      ctx.addIssue({ code: 'custom', path: ['closesAt'], message: 'Say when it closes' });
    }
    if (value.closesAt && value.closesAt <= value.opensAt) {
      ctx.addIssue({ code: 'custom', path: ['closesAt'], message: 'Close it after it opens' });
    }
    const ids = value.questions.map((q) => q.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['questions'],
        message: 'Each question needs its own id',
      });
    }
  });
export type FeedbackFormCreateInput = z.infer<typeof feedbackFormCreateSchema>;

/** Answers keyed by question id: a rating 1–5, a chosen option, or text. */
export const feedbackResponseSchema = z.object({
  answers: z.record(
    z.string().max(40),
    z.union([z.number().int().min(1).max(FEEDBACK_RATING_MAX), z.string().trim().max(2000)]),
  ),
});
export type FeedbackResponseInput = z.infer<typeof feedbackResponseSchema>;

export const feedbackListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  batchId: z.uuid().optional(),
  trainerId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
});
export type FeedbackListQuery = z.infer<typeof feedbackListQuerySchema>;

export type FeedbackFormStatus = 'scheduled' | 'open' | 'between_rounds' | 'closed';

export interface FeedbackFormSummary {
  id: string;
  title: string;
  batch: { id: string; code: string; name: string };
  trainer: { id: string; name: string } | null;
  course: { id: string; title: string } | null;
  anonymous: boolean;
  cadence: FeedbackCadence;
  opensAt: string;
  closesAt: string | null;
  status: FeedbackFormStatus;
  /** The round open now ("once" or the Friday it opened), or null. */
  currentPeriod: string | null;
  /** Answers over every round. */
  responses: number;
  createdAt: string;
}

export interface FeedbackFormDetail extends FeedbackFormSummary {
  description: string;
  questions: FeedbackQuestion[];
}

export interface FeedbackQuestionResult {
  id: string;
  kind: FeedbackQuestionKind;
  prompt: string;
  /** Answers to this question. */
  answered: number;
  /** Rating: the mean, and how many gave each value from 1 up. */
  average: number | null;
  distribution: number[];
  /** Choice: how many picked each option. */
  choices: { option: string; count: number }[];
  /** Text: what was written; with the learner's name only when the form is not anonymous. */
  comments: { text: string; name: string | null }[];
}

export interface FeedbackResults {
  formId: string;
  period: string;
  /** Every round that has answers, newest first, with its count. */
  periods: { period: string; responses: number }[];
  responses: number;
  /** Active learners of the batch. */
  audience: number;
  /** Fewer than FEEDBACK_MIN_RESPONSES answers: only the counts are shown. */
  suppressed: boolean;
  questions: FeedbackQuestionResult[];
}

/** A form as a learner meets it. */
export interface LearnerFeedbackItem {
  formId: string;
  title: string;
  description: string;
  anonymous: boolean;
  period: string;
  closesAt: string;
  answered: boolean;
  questions: FeedbackQuestion[];
}

/**
 * The weekly round open at a moment: Friday 00:00 to Monday 00:00 in the institute's time
 * (AC-13.1), named by the Friday's date. Null from Monday to Thursday.
 */
export function weeklyFeedbackRound(
  now: Date,
  timeZone: string,
): { period: string; opensAt: Date; closesAt: Date } | null {
  const today = toLocalDateKey(now, timeZone);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const sinceFriday = weekday === 5 ? 0 : weekday === 6 ? 1 : weekday === 0 ? 2 : -1;
  if (sinceFriday < 0) return null;
  const friday = addDaysToDateKey(today, -sinceFriday);
  return {
    period: friday,
    opensAt: zonedDateTimeToUtc(friday, '00:00', timeZone),
    closesAt: zonedDateTimeToUtc(addDaysToDateKey(friday, 3), '00:00', timeZone),
  };
}
