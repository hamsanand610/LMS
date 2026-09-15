import { z } from 'zod';
import { mobileSchema } from './common.js';
import {
  type DocumentStatus,
  type DocumentType,
  studentEducationSchema,
  studentPersonalSchema,
} from './people.js';

/**
 * The learner's own record (plan DP-S17–S20, module M-04 student side). It is the same data staff
 * see on a student, edited one section at a time by the person it belongs to.
 */
export const PROFILE_SECTIONS = ['personal', 'education', 'experience', 'skills', 'links'] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export const PROFILE_SECTION_LABELS: Record<ProfileSection, string> = {
  personal: 'Personal',
  education: 'Education',
  experience: 'Experience',
  skills: 'Skills',
  links: 'Links',
};

export const studentExperienceSchema = z.object({
  role: z.string().trim().min(1).max(120),
  organisation: z.string().trim().max(160).default(''),
  from: z.iso.date().nullable().default(null),
  to: z.iso.date().nullable().default(null),
  /** When true the `to` date is ignored and the entry reads as ongoing. */
  current: z.boolean().default(false),
  summary: z.string().trim().max(1000).default(''),
});
export type StudentExperience = z.infer<typeof studentExperienceSchema>;

export const profileLinksSchema = z.object({
  github: z.union([z.url().max(200), z.literal('')]).default(''),
  linkedin: z.union([z.url().max(200), z.literal('')]).default(''),
  portfolio: z.union([z.url().max(200), z.literal('')]).default(''),
});
export type ProfileLinks = z.infer<typeof profileLinksSchema>;

/**
 * One body for every section, because the section itself is in the path. The API refuses a body
 * that carries anything but the named section, so a mistake is an error rather than a silent edit
 * of something the page was not showing.
 */
export const profileUpdateSchema = z.object({
  mobile: z.union([mobileSchema, z.literal('')]).optional(),
  summary: z.string().trim().max(1000).optional(),
  personal: studentPersonalSchema.partial().optional(),
  education: z.array(studentEducationSchema).max(10).optional(),
  experience: z.array(studentExperienceSchema).max(10).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
  links: profileLinksSchema.partial().optional(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/** Which fields each section owns, so the API can refuse a body that strays outside it. */
export const PROFILE_SECTION_FIELDS: Record<ProfileSection, readonly (keyof ProfileUpdateInput)[]> =
  {
    personal: ['personal', 'mobile', 'summary'],
    education: ['education'],
    experience: ['experience'],
    skills: ['skills'],
    links: ['links'],
  };

export interface ProfileView {
  studentId: string;
  studentCode: string;
  name: string;
  email: string;
  mobile: string | null;
  avatarUrl: string | null;
  status: string;
  verificationStatus: string;
  /** 0–100; what it is made of is in `completenessParts`, so the page can say what is missing. */
  completeness: number;
  completenessParts: { key: string; label: string; done: boolean; weight: number }[];
  summary: string;
  personal: Partial<Record<string, unknown>>;
  education: unknown[];
  experience: unknown[];
  skills: string[];
  links: Partial<ProfileLinks>;
  batches: { id: string; code: string; name: string }[];
  /** Named rather than shown, for the sections whose module is not in this build. */
  pending: { key: string; label: string; reason: string }[];
}

// ───────────────────────── resumes ─────────────────────────

export const resumeCreateSchema = z.object({
  fileId: z.uuid(),
  title: z.string().trim().max(120).default(''),
});
export type ResumeCreateInput = z.infer<typeof resumeCreateSchema>;

export interface ResumeRecord {
  id: string;
  title: string;
  filename: string;
  sizeBytes: number;
  isDefault: boolean;
  uploadedAt: string;
}

/** How many resumes one learner may keep (plan AC-12.1). The size limit is the upload context's. */
export const MAX_RESUMES = 3;

// ───────────────────────── documents (the learner's own) ─────────────────────────

export interface OwnDocumentRecord {
  id: string;
  type: DocumentType;
  title: string;
  fileName: string;
  fileSize: number;
  mime: string;
  status: DocumentStatus;
  /** Filled in when a document was rejected, so the learner knows what to do about it. */
  reason: string;
  createdAt: string;
  reviewedAt: string | null;
}
