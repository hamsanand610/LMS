import { z } from 'zod';
import { paginationQuerySchema, slugSchema } from './common.js';

export const PROGRAM_STATUSES = ['active', 'archived'] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const programCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Use capital letters, digits and hyphens, e.g. JFS'),
  name: z.string().trim().min(2).max(120),
  durationWeeks: z.number().int().min(1).max(260),
  description: z.string().trim().max(1000).default(''),
});
export type ProgramCreateInput = z.infer<typeof programCreateSchema>;

export const programUpdateSchema = programCreateSchema
  .omit({ code: true })
  .partial()
  .extend({ status: z.enum(PROGRAM_STATUSES).optional() });
export type ProgramUpdateInput = z.infer<typeof programUpdateSchema>;

export interface ProgramSummary {
  id: string;
  code: string;
  name: string;
  durationWeeks: number;
  description: string;
  status: ProgramStatus;
  batchCount: number;
  createdAt: string;
}

// ───────────────────────── batches ─────────────────────────

export const BATCH_STATUSES = ['planned', 'running', 'completed', 'archived'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

/** Allowed status moves. `running` is the only state students are notified about. */
export const BATCH_STATUS_TRANSITIONS: Record<BatchStatus, readonly BatchStatus[]> = {
  planned: ['running', 'archived'],
  running: ['completed', 'archived'],
  completed: ['archived'],
  archived: [],
};

export const BATCH_MODES = ['online', 'offline', 'hybrid'] as const;
export type BatchMode = (typeof BATCH_MODES)[number];

export const BATCH_TRAINER_ROLES = ['lead', 'assistant', 'guest'] as const;

export const batchCreateSchema = z
  .object({
    programId: z.uuid(),
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[A-Z0-9-]+$/, 'Use capital letters, digits and hyphens, e.g. JFS-2026-B1'),
    name: z.string().trim().min(2).max(120),
    mode: z.enum(BATCH_MODES).default('offline'),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    capacity: z.number().int().min(1).max(1000).default(60),
    custom: z.record(z.string(), z.unknown()).default({}),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'The end date must not be before the start date',
  });
export type BatchCreateInput = z.infer<typeof batchCreateSchema>;

export const batchUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  mode: z.enum(BATCH_MODES).optional(),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  capacity: z.number().int().min(1).max(1000).optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
});
export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;

export const batchStatusSchema = z.object({
  status: z.enum(BATCH_STATUSES),
  reason: z.string().trim().max(240).default(''),
});

export const batchListQuerySchema = paginationQuerySchema.extend({
  programId: z.uuid().optional(),
  status: z.enum(BATCH_STATUSES).optional(),
  trainerId: z.uuid().optional(),
  mode: z.enum(BATCH_MODES).optional(),
});

export const batchMembersAddSchema = z.object({
  studentIds: z.array(z.uuid()).min(1).max(500),
});

export const batchMemberRemoveSchema = z.object({
  reason: z.string().trim().max(240).default(''),
});

export const batchTransferSchema = z.object({
  studentId: z.uuid(),
  toBatchId: z.uuid(),
  reason: z.string().trim().max(240).default(''),
});

export const batchTrainersSchema = z.object({
  assignments: z
    .array(
      z.object({
        trainerId: z.uuid(),
        subject: z.string().trim().min(1).max(60),
        role: z.enum(BATCH_TRAINER_ROLES).default('lead'),
      }),
    )
    .max(30),
});

export interface BatchSummary {
  id: string;
  code: string;
  name: string;
  mode: BatchMode;
  status: BatchStatus;
  startDate: string;
  endDate: string;
  capacity: number;
  program: { id: string; code: string; name: string };
  studentCount: number;
  trainerCount: number;
  createdAt: string;
}

export interface BatchDetail extends BatchSummary {
  custom: Record<string, unknown>;
  trainers: {
    trainerId: string;
    userId: string;
    name: string;
    subject: string;
    role: string;
  }[];
  /** Status moves the caller may perform right now. */
  allowedTransitions: BatchStatus[];
}

export interface BatchMemberRow {
  studentId: string;
  studentCode: string;
  name: string;
  email: string;
  status: string;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
}

export const slugLikeSchema = slugSchema;
