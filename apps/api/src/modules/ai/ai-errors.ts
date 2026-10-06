import { AI_ERROR_CODES, type AiDataClass } from '@lms/shared';
import {
  AppError,
  ConflictError,
  DomainRuleError,
  ForbiddenError,
} from '../../core/http/errors.js';
import type { AiQuotaLimit } from './usage/quota.js';

/** Another of the person's answers is still being written: one at a time (Phase 7C). */
export class AiGenerationBusyError extends ConflictError {
  constructor() {
    super(
      'Your last question is still being answered. Wait for it, or stop it, then ask again.',
      AI_ERROR_CODES.GENERATION_IN_PROGRESS,
    );
  }
}

const QUOTA_DETAIL: Record<AiQuotaLimit, string> = {
  requests: 'You have asked SI Academy AI as many questions as a day allows. Ask again tomorrow.',
  tokens: 'You have used the SI Academy AI allowance for today. Ask again tomorrow.',
  budget: 'Your institute’s SI Academy AI budget for this month is spent.',
};

/** An allowance is used up (ADR-0029): refused before any provider call. */
export class AiQuotaExceededError extends AppError {
  constructor(readonly limit: AiQuotaLimit) {
    super(429, AI_ERROR_CODES.QUOTA_EXCEEDED, 'AI allowance used', QUOTA_DETAIL[limit]);
  }
}

/** The request's data class is not approved for the provider (ADR-0024). */
export class AiDataNotApprovedError extends ForbiddenError {
  constructor(dataClass: AiDataClass) {
    super(
      dataClass === 'personal'
        ? 'SI Academy AI cannot take questions about your own work on this installation yet.'
        : 'SI Academy AI cannot take questions about course material on this installation yet.',
      AI_ERROR_CODES.DATA_NOT_APPROVED,
    );
  }
}

/** The message holds a credential; it is never sent anywhere, nor stored (ADR-0024). */
export class AiRestrictedContentError extends DomainRuleError {
  constructor() {
    super(
      'Your message looks like it contains a password, key or token. SI Academy AI never sends those anywhere: remove it and ask again.',
      AI_ERROR_CODES.RESTRICTED_CONTENT,
    );
  }
}

/**
 * A subject the surface does not take (Phase 7E): a course or a lesson is asked about from the
 * assistant beside it, and a lab from the lab's own AI Hint.
 */
export class AiSubjectNotSupportedError extends DomainRuleError {
  constructor() {
    super(
      'Ask about a course or a lesson from the assistant beside it, and about a lab from its AI Hint.',
      AI_ERROR_CODES.SUBJECT_NOT_SUPPORTED,
    );
  }
}

/**
 * A conversation of the wrong kind for the request (Phase 9B; ADR-0039): the learning agent's
 * conversations take runs, on its own route alone, and that route takes no other conversation.
 */
export class AiConversationKindError extends DomainRuleError {
  constructor(agent: boolean) {
    super(
      agent
        ? 'This is a learning agent conversation: ask the agent in it.'
        : 'The learning agent answers in its own conversations only. Start one for it.',
      AI_ERROR_CODES.SUBJECT_NOT_SUPPORTED,
    );
  }
}

/** A lab hint comes after a failed attempt at the lab (Phase 7E; ADR-0031). */
export class AiHintNeedsAttemptError extends DomainRuleError {
  constructor() {
    super(
      'Submit an attempt at the lab first. A hint helps once you have tried and something did not work.',
      AI_ERROR_CODES.HINT_NEEDS_ATTEMPT,
    );
  }
}
