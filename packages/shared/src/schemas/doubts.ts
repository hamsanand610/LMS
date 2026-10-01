import { z } from 'zod';
import { paginationQuerySchema } from './common.js';

/**
 * Doubts (ADR-0014): a learner's question about a course or a lesson, answered in a thread by the
 * trainers of their batch, or by an administrator.
 */
export const DOUBT_STATUSES = ['open', 'answered', 'resolved'] as const;
export type DoubtStatus = (typeof DOUBT_STATUSES)[number];

export const DOUBT_STATUS_LABELS: Record<DoubtStatus, string> = {
  open: 'Waiting for an answer',
  answered: 'Answered',
  resolved: 'Resolved',
};

export const doubtCreateSchema = z.object({
  title: z.string().trim().min(4).max(160),
  body: z.string().trim().min(4).max(4000),
  courseId: z.uuid().nullable().default(null),
  lessonId: z.uuid().nullable().default(null),
});
export type DoubtCreateInput = z.infer<typeof doubtCreateSchema>;

export const doubtReplySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});
export type DoubtReplyInput = z.infer<typeof doubtReplySchema>;

/** The learner marks their own doubt resolved, or reopens it. */
export const doubtStatusSchema = z.object({ status: z.enum(['open', 'resolved']) });
export type DoubtStatusInput = z.infer<typeof doubtStatusSchema>;

export const doubtListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(DOUBT_STATUSES).optional(),
  courseId: z.uuid().optional(),
  lessonId: z.uuid().optional(),
  batchId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
});
export type DoubtListQuery = z.infer<typeof doubtListQuerySchema>;

export interface DoubtSummary {
  id: string;
  title: string;
  status: DoubtStatus;
  course: { id: string; title: string } | null;
  lesson: { id: string; title: string } | null;
  /** Staff view; for a learner it is always themselves. */
  student: { id: string; name: string; studentCode: string; batchCodes: string[] };
  replyCount: number;
  lastReplyFromStaff: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DoubtReplyView {
  id: string;
  body: string;
  author: { name: string; isStaff: boolean; isYou: boolean };
  createdAt: string;
}

export interface DoubtThread extends DoubtSummary {
  body: string;
  replies: DoubtReplyView[];
  resolvedAt: string | null;
  /** Whether the caller may reply, and change the status. */
  canReply: boolean;
  canResolve: boolean;
}
