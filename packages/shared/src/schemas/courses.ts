import { z } from 'zod';
import { paginationQuerySchema, slugSchema } from './common.js';

export const COURSE_STATUSES = ['draft', 'published', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

/** What a lesson delivers. `practice` embeds a question and arrives with the question bank. */
export const LESSON_TYPES = ['video', 'article', 'resources', 'practice'] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

/**
 * How a lesson is marked complete:
 * `watch` — automatically once the configured share of the video has been watched;
 * `view` — as soon as the learner opens it;
 * `manual` — only when the learner presses "Mark complete".
 */
export const COMPLETION_RULES = ['watch', 'view', 'manual'] as const;
export type CompletionRule = (typeof COMPLETION_RULES)[number];

/** Default rule per lesson type, used when the author does not choose one. */
export const DEFAULT_COMPLETION_RULE: Record<LessonType, CompletionRule> = {
  video: 'watch',
  article: 'manual',
  resources: 'manual',
  practice: 'manual',
};

/** A module opens either straight away or once the previous one reaches a percentage. */
export const unlockRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('always') }),
  z.object({
    type: z.literal('after_previous'),
    minPercent: z.number().int().min(1).max(100).default(100),
  }),
]);
export type UnlockRule = z.infer<typeof unlockRuleSchema>;

// ───────────────────────── course settings ─────────────────────────

export const courseCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).default(''),
  level: z.string().trim().max(40).default(''),
  subject: z.string().trim().max(60).default(''),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  thumbnailFileId: z.uuid().nullable().default(null),
  estimatedMinutes: z.number().int().min(0).max(100_000).default(0),
});
export type CourseCreateInput = z.infer<typeof courseCreateSchema>;

export const courseUpdateSchema = courseCreateSchema.partial();

export const courseListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(COURSE_STATUSES).optional(),
  level: z.string().max(40).optional(),
  subject: z.string().max(60).optional(),
  /** Only courses a live publication reaches for this batch, directly or through its programme. */
  batchId: z.uuid().optional(),
});

// ───────────────────────── outline ─────────────────────────

/** Content of a lesson; the shape depends on the type and is checked on save. */
export const lessonContentSchema = z.object({
  /** article: rich text as HTML produced by the editor. */
  html: z.string().max(200_000).default(''),
  /** video: the registered video reference (driver + key). */
  video: z
    .object({
      driver: z.literal('storage-file'),
      key: z.string().min(1).max(200),
      durationSeconds: z.number().int().min(0).max(86_400).default(0),
    })
    .nullable()
    .default(null),
  /** practice: the question this lesson embeds (question bank arrives in Phase 4). */
  questionId: z.uuid().nullable().default(null),
});
export type LessonContent = z.infer<typeof lessonContentSchema>;

export const lessonResourceSchema = z.object({
  title: z.string().trim().min(1).max(120),
  fileId: z.uuid().nullable().default(null),
  url: z.string().trim().max(500).default(''),
});
export type LessonResourceInput = z.infer<typeof lessonResourceSchema>;

export const lessonInputSchema = z.object({
  /** Present when an existing lesson is being kept; absent for a new one. */
  id: z.uuid().optional(),
  title: z.string().trim().min(2).max(160),
  type: z.enum(LESSON_TYPES),
  durationSeconds: z.number().int().min(0).max(86_400).default(0),
  /** Omit to leave a saved lesson's content exactly as it is; a new lesson starts empty. */
  content: lessonContentSchema.optional(),
  resources: z.array(lessonResourceSchema).max(20).default([]),
  completionRule: z.enum(COMPLETION_RULES).optional(),
  isMandatory: z.boolean().default(true),
});
export type LessonInput = z.infer<typeof lessonInputSchema>;

export const moduleInputSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2).max(160),
  unlockRule: unlockRuleSchema.default({ type: 'always' }),
  lessons: z.array(lessonInputSchema).max(100),
});
export type ModuleInput = z.infer<typeof moduleInputSchema>;

export const outlineSchema = z.object({
  modules: z.array(moduleInputSchema).max(50),
});
export type OutlineInput = z.infer<typeof outlineSchema>;

// ───────────────────────── publication ─────────────────────────

export const PUBLICATION_SCOPES = ['all', 'program', 'batch'] as const;
export type PublicationScope = (typeof PUBLICATION_SCOPES)[number];

export const publishSchema = z
  .object({
    scopeType: z.enum(PUBLICATION_SCOPES),
    scopeId: z.uuid().nullable().default(null),
    note: z.string().trim().max(240).default(''),
  })
  .refine((v) => v.scopeType === 'all' || v.scopeId !== null, {
    path: ['scopeId'],
    message: 'Choose the programme or batch to publish to',
  });
export type PublishInput = z.infer<typeof publishSchema>;

export interface PublicationRecord {
  id: string;
  scopeType: PublicationScope;
  scopeId: string | null;
  scopeLabel: string;
  note: string;
  publishedAt: string;
  publishedBy: string | null;
  enrolled: number;
}

// ───────────────────────── responses ─────────────────────────

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  subject: string;
  tags: string[];
  status: CourseStatus;
  thumbnailUrl: string | null;
  moduleCount: number;
  lessonCount: number;
  estimatedMinutes: number;
  publicationCount: number;
  createdAt: string;
}

export interface LessonSummary {
  id: string;
  title: string;
  type: LessonType;
  durationSeconds: number;
  completionRule: CompletionRule;
  isMandatory: boolean;
  resourceCount: number;
  /** Learner view only. */
  status?: 'not_started' | 'in_progress' | 'completed';
  positionSeconds?: number;
}

export interface ModuleSummary {
  id: string;
  title: string;
  position: number;
  unlockRule: UnlockRule;
  lessons: LessonSummary[];
  /** Learner view only: false when the unlock rule has not been met. */
  unlocked?: boolean;
  lockReason?: string;
}

export interface CourseDetail extends CourseSummary {
  modules: ModuleSummary[];
  /** Learner view only. */
  progressPct?: number;
  nextLessonId?: string | null;
  enrolled?: boolean;
}

export interface LessonDetail {
  id: string;
  courseId: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  title: string;
  type: LessonType;
  durationSeconds: number;
  completionRule: CompletionRule;
  isMandatory: boolean;
  content: LessonContent;
  resources: {
    id: string;
    title: string;
    fileId: string | null;
    url: string;
    mime: string;
    size: number;
  }[];
  status: 'not_started' | 'in_progress' | 'completed';
  positionSeconds: number;
  watchedPct: number;
  previousLessonId: string | null;
  nextLessonId: string | null;
}

export const lessonProgressSchema = z.object({
  positionSeconds: z.number().int().min(0).max(86_400),
  watchedPct: z.number().int().min(0).max(100),
});
export type LessonProgressInput = z.infer<typeof lessonProgressSchema>;

export const courseSlugSchema = slugSchema;
