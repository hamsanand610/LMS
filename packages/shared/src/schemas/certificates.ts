import { z } from 'zod';

/**
 * Certificates of course completion (ADR-0022). A certificate is issued automatically once a course
 * is completed, carries a public verification code, and is never recomputed from progress.
 */

/** Crockford base32: no I, L, O or U, so a code read aloud or retyped is not mistaken. */
export const CERTIFICATE_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CERTIFICATE_CODE_LENGTH = 12;

/** A verification code as typed or pasted: case and the dashes of the printed form do not matter. */
export const certificateCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        new RegExp(`^[${CERTIFICATE_CODE_ALPHABET}]{${CERTIFICATE_CODE_LENGTH}}$`),
        'That is not a certificate code',
      ),
  );

/** The printed form of a code: three groups of four. */
export function formatCertificateCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

export const CERTIFICATE_STATUSES = ['issued', 'revoked'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

/** A certificate as the learner who holds it sees it. */
export interface CertificateRecord {
  id: string;
  code: string;
  courseId: string;
  courseTitle: string;
  learnerName: string;
  institute: string;
  completedAt: string;
  issuedAt: string;
  status: CertificateStatus;
  revokedAt: string | null;
  /** False for a moment after issue, until its PDF has been drawn. */
  downloadable: boolean;
}

/** What the public verification page shows: enough to confirm it, nothing more (AC-10.2). */
export interface CertificateVerification {
  code: string;
  learnerName: string;
  courseTitle: string;
  institute: string;
  completedAt: string;
  issuedAt: string;
  status: CertificateStatus;
  revokedAt: string | null;
}

export interface CertificateDownload {
  url: string;
  filename: string;
  expiresAt: string;
}

/** The staff list of certificates (Phases 3–4, ADM-05). */
export const certificateListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
  status: z.enum(['issued', 'revoked']).optional(),
  courseId: z.uuid().optional(),
  batchId: z.uuid().optional(),
});
export type CertificateListQuery = z.infer<typeof certificateListQuerySchema>;

/** Why a certificate is revoked or reinstated; kept with the record and in the audit log. */
export const certificateReasonSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export interface StaffCertificateRecord extends CertificateRecord {
  studentId: string;
  studentCode: string;
  revokedReason: string;
}
