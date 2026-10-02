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
