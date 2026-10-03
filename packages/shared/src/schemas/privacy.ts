import { z } from 'zod';

/**
 * Privacy operations (Phases 3–4, ADM-11; IR-24, P-I08): a learner's data handed over on request,
 * and erasure by anonymisation, both by the Super Admin (`privacy:manage`) and both audited.
 */

/** The name an erased learner's account keeps, so the records that remain belong to nobody. */
export const ERASED_LEARNER_NAME = 'Erased learner';

/** Erasure is confirmed by typing the learner's e-mail address, and always gives a reason. */
export const privacyEraseSchema = z.object({
  confirmEmail: z.string().trim().toLowerCase().min(3).max(254),
  reason: z.string().trim().min(5).max(240),
});
export type PrivacyEraseInput = z.infer<typeof privacyEraseSchema>;

/** What an erasure removed or anonymised, as counts; returned and kept in the audit log. */
export interface PrivacyErasureResult {
  userId: string;
  /** Uploaded files deleted from storage: documents, résumés, the photo, handed-in attachments. */
  files: number;
  documents: number;
  resumes: number;
  /** Certificates withdrawn and their PDFs deleted; the record stays, under the erased name. */
  certificates: number;
  /** Batch places ended, so rosters and roll calls no longer list the learner. */
  memberships: number;
  /** Notifications, activity, drafts, sessions and other personal records deleted. */
  deleted: number;
  /** Answers, doubts and comments whose text was removed; their marks and counts stay. */
  redacted: number;
}

/** A learner's data as handed to them (ADM-11). Staff notes and staff-only fields are not theirs. */
export interface LearnerDataExport {
  exportedAt: string;
  institute: string;
  account: {
    name: string;
    email: string;
    mobile: string | null;
    status: string;
    roles: string[];
    createdAt: string;
    emailVerifiedAt: string | null;
    lastLoginAt: string | null;
  };
  profile: {
    studentCode: string;
    status: string;
    verificationStatus: string;
    personal: unknown;
    education: unknown;
    experience: unknown;
    links: unknown;
    summary: string;
    skills: string[];
    projects: unknown;
    certifications: unknown;
    /** The institute's own fields, those the learner may see. */
    custom: Record<string, unknown>;
  };
  batches: { code: string; name: string; joinedAt: string; leftAt: string | null }[];
  enrolments: {
    course: string;
    status: string;
    progressPct: number;
    enrolledAt: string;
    completedAt: string | null;
  }[];
  lessons: { lesson: string; status: string; completedAt: string | null }[];
  attendance: { batch: string; session: string; startsAt: string; status: string }[];
  submissions: {
    assignment: string;
    attempt: number;
    status: string;
    marks: number;
    maxMarks: number;
    submittedAt: string;
    isLate: boolean;
    language: string;
    text: string;
    code: string;
  }[];
  /** Scores only once the test's results are released, as the learner would see them. */
  tests: {
    test: string;
    attempt: number;
    status: string;
    score: number | null;
    totalMarks: number;
    startedAt: string;
    submittedAt: string | null;
  }[];
  documents: {
    type: string;
    title: string;
    status: string;
    fileName: string;
    uploadedAt: string;
  }[];
  resumes: { title: string; fileName: string; uploadedAt: string }[];
  applications: {
    company: string;
    role: string;
    status: string;
    note: string;
    appliedAt: string;
  }[];
  doubts: {
    title: string;
    body: string;
    status: string;
    askedAt: string;
    replies: { from: 'you' | 'staff'; body: string; at: string }[];
  }[];
  certificates: {
    code: string;
    course: string;
    status: string;
    completedAt: string;
    issuedAt: string;
  }[];
  /** Answers given on named forms; anonymous answers are not traceable to anyone, by design. */
  feedback: { form: string; period: string; answers: unknown; submittedOn: string }[];
  notifications: { title: string; body: string; createdAt: string; readAt: string | null }[];
  sessions: {
    device: string | null;
    ip: string | null;
    createdAt: string;
    lastUsedAt: string | null;
  }[];
  /**
   * SI Academy AI (Phase 7C): their conversations, deleted ones included until they are purged, the
   * calls made for them and their daily usage. No provider or model is named. Phase 7D adds each
   * conversation's summary, and the answers kept for them alone in the answer cache.
   */
  ai: {
    conversations: {
      purpose: string;
      title: string;
      summary: string;
      createdAt: string;
      deletedAt: string | null;
      messages: { role: string; content: string; status: string; createdAt: string }[];
    }[];
    cachedAnswers: { question: string; answer: string; createdAt: string; expiresAt: string }[];
    requests: {
      at: string;
      task: string;
      outcome: string;
      inputTokens: number;
      outputTokens: number;
    }[];
    usage: { day: string; requests: number; inputTokens: number; outputTokens: number }[];
  };
}
