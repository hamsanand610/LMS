import { z } from 'zod';
import { emailSchema, mobileSchema, paginationQuerySchema } from './common.js';

/**
 * Student lifecycle (architecture plan §17.3). Transitions are enforced by the API:
 * prospect → enrolled → active → completed → alumni, with `dropped` reachable from any
 * active state and reversible to `enrolled`.
 */
export const STUDENT_STATUSES = [
  'prospect',
  'enrolled',
  'active',
  'completed',
  'alumni',
  'dropped',
] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const STUDENT_STATUS_TRANSITIONS: Record<StudentStatus, readonly StudentStatus[]> = {
  prospect: ['enrolled', 'dropped'],
  enrolled: ['active', 'dropped'],
  active: ['completed', 'dropped'],
  completed: ['alumni'],
  alumni: [],
  dropped: ['enrolled'],
};

export const VERIFICATION_STATUSES = ['unverified', 'pending', 'verified'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/**
 * The personal fields, declared once. Two schemas are built from them because the two operations
 * mean different things: what is **stored** fills every field with a default, while what is
 * **patched** leaves an absent field alone. Applying the storage defaults to a patch would turn
 * "I did not send this" into "clear this", which is how a merge quietly wipes a record.
 */
const personalFields = {
  dateOfBirth: z.iso.date().nullable(),
  gender: z.enum(['female', 'male', 'other', 'undisclosed']),
  guardianName: z.string().trim().max(120),
  guardianMobile: z.union([mobileSchema, z.literal('')]),
  addressLine: z.string().trim().max(200),
  city: z.string().trim().max(80),
  state: z.string().trim().max(80),
  pincode: z
    .string()
    .trim()
    .regex(/^$|^\d{4,10}$/, 'Enter a valid postal code'),
};

/** Personal section of a student profile. Sensitive fields are hidden without `students:read_sensitive`. */
export const studentPersonalSchema = z.object({
  dateOfBirth: personalFields.dateOfBirth.default(null),
  gender: personalFields.gender.default('undisclosed'),
  guardianName: personalFields.guardianName.default(''),
  guardianMobile: personalFields.guardianMobile.default(''),
  addressLine: personalFields.addressLine.default(''),
  city: personalFields.city.default(''),
  state: personalFields.state.default(''),
  pincode: personalFields.pincode.default(''),
});
export type StudentPersonal = z.infer<typeof studentPersonalSchema>;

/** The same fields for a patch: an absent one means "leave it as it is". */
export const studentPersonalPatchSchema = z.object(personalFields).partial();
export type StudentPersonalPatch = z.infer<typeof studentPersonalPatchSchema>;

/** Fields that require `students:read_sensitive`; the API strips them otherwise. */
export const SENSITIVE_PERSONAL_FIELDS = [
  'dateOfBirth',
  'guardianName',
  'guardianMobile',
  'addressLine',
  'pincode',
] as const;

export const studentEducationSchema = z.object({
  qualification: z.string().trim().min(1).max(80),
  institution: z.string().trim().max(160).default(''),
  specialisation: z.string().trim().max(120).default(''),
  yearOfPassing: z.number().int().min(1950).max(2100).nullable().default(null),
  scorePercentage: z.number().min(0).max(100).nullable().default(null),
});
export type StudentEducation = z.infer<typeof studentEducationSchema>;

export const studentCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  mobile: z.union([mobileSchema, z.literal('')]).optional(),
  batchId: z.uuid().nullable().optional(),
  status: z.enum(STUDENT_STATUSES).default('enrolled'),
  sendInvitation: z.boolean().default(true),
  custom: z.record(z.string(), z.unknown()).default({}),
});
export type StudentCreateInput = z.infer<typeof studentCreateSchema>;

export const studentUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  mobile: z.union([mobileSchema, z.literal('')]).optional(),
  personal: studentPersonalPatchSchema.optional(),
  education: z.array(studentEducationSchema).max(10).optional(),
  summary: z.string().trim().max(1000).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
});
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;

export const studentStatusSchema = z.object({
  status: z.enum(STUDENT_STATUSES),
  reason: z.string().trim().max(240).default(''),
});

export const studentListQuerySchema = paginationQuerySchema.extend({
  batchId: z.uuid().optional(),
  programId: z.uuid().optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
  verification: z.enum(VERIFICATION_STATUSES).optional(),
  unassigned: z.coerce.boolean().optional(),
});
export type StudentListQuery = z.infer<typeof studentListQuerySchema>;

export interface StudentSummary {
  id: string;
  userId: string;
  studentCode: string;
  name: string;
  email: string;
  mobile: string | null;
  status: StudentStatus;
  accountStatus: 'invited' | 'active' | 'suspended' | 'deactivated';
  verificationStatus: VerificationStatus;
  batches: { id: string; code: string; name: string }[];
  completeness: number;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface StudentDetail extends StudentSummary {
  personal: Partial<StudentPersonal>;
  education: StudentEducation[];
  summary: string;
  skills: string[];
  custom: Record<string, unknown>;
  /** False when the caller lacks `students:read_sensitive`; personal fields are then partial. */
  sensitiveVisible: boolean;
}

export const studentNoteSchema = z.object({ text: z.string().trim().min(1).max(2000) });

/** A staff note on a student. Private to staff; the learner never sees one. */
export interface StudentNoteRecord {
  id: string;
  text: string;
  author: { id: string; name: string };
  createdAt: string;
}

export const DOCUMENT_TYPES = [
  'photo',
  'id_proof',
  'marksheet_10',
  'marksheet_12',
  'degree',
  'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const documentCreateSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  fileId: z.uuid(),
  title: z.string().trim().max(120).default(''),
});

export const documentDecisionSchema = z
  .object({
    decision: z.enum(['verified', 'rejected']),
    reason: z.string().trim().max(240).default(''),
  })
  .refine((v) => v.decision !== 'rejected' || v.reason.length > 0, {
    path: ['reason'],
    message: 'Give a reason when rejecting a document',
  });

// ───────────────────────── trainers ─────────────────────────

export const trainerCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  mobile: z.union([mobileSchema, z.literal('')]).optional(),
  subjects: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  headline: z.string().trim().max(120).default(''),
  bio: z.string().trim().max(1000).default(''),
  sendInvitation: z.boolean().default(true),
});
export type TrainerCreateInput = z.infer<typeof trainerCreateSchema>;

export const trainerUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  mobile: z.union([mobileSchema, z.literal('')]).optional(),
  subjects: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(1000).optional(),
});
export type TrainerUpdateInput = z.infer<typeof trainerUpdateSchema>;

export const trainerListQuerySchema = paginationQuerySchema.extend({
  subject: z.string().max(60).optional(),
  status: z.enum(['invited', 'active', 'suspended', 'deactivated']).optional(),
});

export interface TrainerSummary {
  id: string;
  userId: string;
  name: string;
  email: string;
  mobile: string | null;
  subjects: string[];
  headline: string;
  accountStatus: 'invited' | 'active' | 'suspended' | 'deactivated';
  batchCount: number;
  createdAt: string;
}

export interface TrainerDetail extends TrainerSummary {
  bio: string;
  assignments: {
    batchId: string;
    batchCode: string;
    batchName: string;
    subject: string;
    role: string;
    batchStatus: string;
  }[];
}
