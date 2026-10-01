import { z } from 'zod';
import { optionalWebUrlSchema, paginationQuerySchema } from './common.js';

/**
 * Placement (ADR-0014): companies, their interview-prep kits, drives and applications. Deliberately
 * small — no offers workflow and no company accounts.
 */

// ───────────────────────── companies and kits ─────────────────────────

export const companyUpsertSchema = z.object({
  name: z.string().trim().min(2).max(120),
  industry: z.string().trim().max(80).default(''),
  website: optionalWebUrlSchema(300),
  description: z.string().trim().max(2000).default(''),
  technologies: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  logoFileId: z.uuid().nullable().default(null),
});
export type CompanyUpsertInput = z.infer<typeof companyUpsertSchema>;

export const companyKitSchema = z.object({
  /** The whole kit, in order. Items not in the list are removed. */
  items: z
    .array(
      z.object({
        questionId: z.uuid(),
        topic: z.string().trim().max(80).default(''),
      }),
    )
    .max(100),
});
export type CompanyKitInput = z.infer<typeof companyKitSchema>;

export const companyListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  technology: z.string().trim().max(40).optional(),
  /** Learner filters. */
  view: z.enum(['all', 'in_progress', 'completed', 'favourites']).default('all'),
});
export type CompanyListQuery = z.infer<typeof companyListQuerySchema>;

/** Staff searching the practice catalogue for problems to put in a kit. */
export const kitCandidateQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
});
export type KitCandidateQuery = z.infer<typeof kitCandidateQuerySchema>;

export interface KitCandidate {
  questionId: string;
  slug: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  points: number;
}

export type KitItemStatus = 'solved' | 'attempted' | 'not_started';

export interface KitItemView {
  questionId: string;
  /** The practice problem's address; the kit opens it in the practice workspace. */
  slug: string;
  title: string;
  topic: string;
  difficulty: string;
  points: number;
  /** Learner view. */
  status: KitItemStatus;
  attempts: number;
}

export interface CompanyCard {
  id: string;
  slug: string;
  name: string;
  industry: string;
  logoUrl: string | null;
  technologies: string[];
  kitSize: number;
  /** Learner view: kit questions solved. */
  solved: number;
  isFavourite: boolean;
  openDrives: number;
}

export interface CompanyDetail extends CompanyCard {
  website: string;
  description: string;
  logoFileId: string | null;
  kit: KitItemView[];
}

// ───────────────────────── drives ─────────────────────────

export const DRIVE_STATUSES = ['draft', 'open', 'closed'] as const;
export type DriveStatus = (typeof DRIVE_STATUSES)[number];

export const EMPLOYMENT_TYPES = ['full_time', 'internship'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full time',
  internship: 'Internship',
};

export const driveEligibilitySchema = z.object({
  batchIds: z.array(z.uuid()).max(50).default([]),
  programIds: z.array(z.uuid()).max(50).default([]),
  /** Attendance the learner must have reached, or null for no floor. */
  minAttendancePct: z.number().int().min(0).max(100).nullable().default(null),
});
export type DriveEligibility = z.infer<typeof driveEligibilitySchema>;

export const driveUpsertSchema = z.object({
  companyId: z.uuid(),
  role: z.string().trim().min(2).max(120),
  employmentType: z.enum(EMPLOYMENT_TYPES).default('full_time'),
  location: z.string().trim().max(120).default(''),
  packageText: z.string().trim().max(80).default(''),
  description: z.string().trim().max(4000).default(''),
  eligibility: driveEligibilitySchema.default({
    batchIds: [],
    programIds: [],
    minAttendancePct: null,
  }),
  applyBy: z.iso.datetime({ offset: true }),
});
export type DriveUpsertInput = z.infer<typeof driveUpsertSchema>;

export const driveStatusSchema = z.object({ status: z.enum(DRIVE_STATUSES) });
export type DriveStatusInput = z.infer<typeof driveStatusSchema>;

export const driveListQuerySchema = paginationQuerySchema.extend({
  /** Learner views: open to apply, already applied, everything past. */
  view: z.enum(['open', 'applied', 'closed', 'all']).default('all'),
  status: z.enum(DRIVE_STATUSES).optional(),
  companyId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
});
export type DriveListQuery = z.infer<typeof driveListQuerySchema>;

export const APPLICATION_STATUSES = [
  'applied',
  'shortlisted',
  'selected',
  'rejected',
  'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  selected: 'Selected',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
};

/** The stages staff move an application through. Withdrawing is the learner's own action. */
export const applicationStatusSchema = z.object({
  status: z.enum(['applied', 'shortlisted', 'selected', 'rejected']),
  note: z.string().trim().max(1000).default(''),
});
export type ApplicationStatusInput = z.infer<typeof applicationStatusSchema>;

export interface DriveApplicationSummary {
  id: string;
  status: ApplicationStatus;
  note: string;
  appliedAt: string;
  updatedAt: string;
}

export interface DriveCard {
  id: string;
  code: string;
  company: { id: string; slug: string; name: string; logoUrl: string | null };
  role: string;
  employmentType: EmploymentType;
  location: string;
  packageText: string;
  applyBy: string;
  status: DriveStatus;
  /** Learner view: whether they may apply, and if not, why. */
  eligible: boolean;
  ineligibleReasons: string[];
  application: DriveApplicationSummary | null;
  /** Staff view. */
  applicantCount: number;
  selectedCount: number;
}

export interface DriveDetail extends DriveCard {
  description: string;
  eligibility: DriveEligibility & {
    batches: { id: string; code: string }[];
    programs: { id: string; name: string }[];
  };
  publishedAt: string | null;
}

export interface ApplicationRow {
  id: string;
  student: { id: string; name: string; studentCode: string; email: string };
  batchCodes: string[];
  attendancePct: number | null;
  status: ApplicationStatus;
  note: string;
  appliedAt: string;
  resume: { id: string; title: string } | null;
}

export interface PlacementSummary {
  /** Open drives this learner may apply to and has not. */
  eligibleOpen: number;
  applied: number;
  shortlisted: number;
  selected: number;
  nextDeadline: { driveId: string; role: string; company: string; applyBy: string } | null;
}
