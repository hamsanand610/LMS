import { z } from 'zod';

/** Institute-level settings. Sections are validated independently and stored as JSON per key. */
export const generalSettingsSchema = z.object({
  instituteName: z.string().trim().min(1).max(120),
  contactEmail: z.email().nullable().default(null),
  contactPhone: z.string().trim().max(20).nullable().default(null),
  timezone: z.string().min(1).max(64).default('Asia/Kolkata'),
  locale: z.string().min(2).max(10).default('en-IN'),
});
export type GeneralSettings = z.infer<typeof generalSettingsSchema>;

export const academicSettingsSchema = z.object({
  /** Percentage below which a student is flagged. */
  attendanceThresholdPct: z.number().int().min(0).max(100).default(75),
  /** Statuses counted as attended when computing percentages. */
  attendanceCountedStatuses: z
    .array(z.enum(['present', 'late', 'excused']))
    .default(['present', 'late', 'excused']),
  /** Hours during which trainers may correct their own attendance marks. */
  attendanceCorrectionWindowHours: z.number().int().min(0).max(720).default(48),
  /** Watched percentage at which a video lesson auto-completes. */
  lessonAutoCompletePct: z.number().int().min(50).max(100).default(90),
  /** Default attempt limit for assignment questions (0 = unlimited). */
  defaultAssignmentAttempts: z.number().int().min(0).max(100).default(3),
  /** Default negative marking as a fraction of marks (0 = none). */
  defaultNegativeMarkingFraction: z.number().min(0).max(1).default(0),
  /** Whether test results are released automatically after grading. */
  autoReleaseResults: z.boolean().default(false),
});
export type AcademicSettings = z.infer<typeof academicSettingsSchema>;

export const legalSettingsSchema = z.object({
  termsPageSlug: z.string().max(64).default('terms'),
  privacyPageSlug: z.string().max(64).default('privacy'),
  consentText: z
    .string()
    .max(500)
    .default('I agree to the terms of use and the privacy notice of this institute.'),
});
export type LegalSettings = z.infer<typeof legalSettingsSchema>;

/** What the institute keeps on record (Phases 3–4): who signs certificates, how long the log lasts. */
export const recordsSettingsSchema = z.object({
  /** Printed under the signature line of certificates issued from now on; empty, no line. */
  certificateSignatoryName: z.string().trim().max(80).default(''),
  certificateSignatoryTitle: z.string().trim().max(80).default(''),
  /**
   * Days an audit entry is kept before it is removed; null keeps it for ever (the default). At
   * least three years, as the requirements' retention schedule sets it.
   */
  auditRetentionDays: z.number().int().min(1095).max(3650).nullable().default(null),
});
export type RecordsSettings = z.infer<typeof recordsSettingsSchema>;

export const settingsSchema = z.object({
  general: generalSettingsSchema,
  academic: academicSettingsSchema,
  legal: legalSettingsSchema,
  records: recordsSettingsSchema,
});
export type Settings = z.infer<typeof settingsSchema>;

export const settingsUpdateSchema = z.object({
  general: generalSettingsSchema.partial().optional(),
  academic: academicSettingsSchema.partial().optional(),
  legal: legalSettingsSchema.partial().optional(),
  records: recordsSettingsSchema.partial().optional(),
});
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

export const SETTINGS_SECTIONS = ['general', 'academic', 'legal', 'records'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
