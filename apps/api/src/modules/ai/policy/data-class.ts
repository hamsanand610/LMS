import type { AiDataClass, AiPurpose } from '@lms/shared';

/**
 * Credentials in formats that cannot be mistaken for anything else. A learner's practice code that
 * says `password = "admin123"` is not refused — it is what beginners write; these are.
 */
const CREDENTIALS: readonly { code: string; pattern: RegExp }[] = [
  { code: 'private_key', pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/ },
  { code: 'aws_access_key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { code: 'google_api_key', pattern: /\bAIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/ },
  {
    code: 'github_token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/,
  },
  { code: 'slack_token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { code: 'stripe_live_key', pattern: /\b[rs]k_live_[0-9A-Za-z]{16,}/ },
  { code: 'openai_key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/ },
];

/**
 * The credentials a text holds, as codes (`credential:github_token`, …): the same patterns that make
 * a message `restricted`. Phase 8E checks every passage with it before any is sent (ADR-0037).
 */
export function credentialsIn(text: string): string[] {
  return CREDENTIALS.filter(({ pattern }) => pattern.test(text)).map(
    ({ code }) => `credential:${code}`,
  );
}

export interface AiRequestSubject {
  courseId: string | null;
  lessonId: string | null;
  questionId: string | null;
}

export interface AiClassification {
  dataClass: AiDataClass;
  /** Why, as codes: kept with the answer, and in a refusal's audit entry. */
  reasons: string[];
}

/**
 * The data class of an AI request (ADR-0024; Phase 7C), decided on the server from what the request
 * is and what the platform adds to it — not by guessing at personal details in free text:
 *
 * 1. **restricted** — the person's new message holds a credential (above). Never sent anywhere;
 *    the message is refused and not stored.
 * 2. **personal** — a lab hint: it concerns the learner's own work on a lab.
 * 3. **course** — a conversation about a course or lesson (from Phase 7E, which adds that context).
 * 4. **public** — a general learning question. What a person types is treated as their question;
 *    the platform adds nothing about them to it.
 *
 * The router then sends a request only to a model approved for its class (AI_DATA_CLASSES).
 */
export function classifyAiRequest(input: {
  purpose: AiPurpose;
  subject: AiRequestSubject;
  message: string;
}): AiClassification {
  const credentials = credentialsIn(input.message);
  if (credentials.length > 0) return { dataClass: 'restricted', reasons: credentials };
  if (input.purpose === 'lab_hint') return { dataClass: 'personal', reasons: ['own_work'] };
  if (input.subject.courseId || input.subject.lessonId) {
    return { dataClass: 'course', reasons: ['course_subject'] };
  }
  return { dataClass: 'public', reasons: ['general_question'] };
}
