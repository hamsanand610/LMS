import { AI_ERROR_CODES, KNOWLEDGE_ERROR_CODES } from '@lms/shared';
import { AppError } from '../../../../core/http/errors.js';

/**
 * Grounded answers' failures in their own words (Phase 8E; ADR-0037): never a provider's message,
 * a prompt or a stack.
 */
export class KnowledgeAnswerUnavailableError extends AppError {
  constructor(
    detail = 'SI Academy AI cannot answer from the knowledge base just now. Try again later.',
  ) {
    super(503, KNOWLEDGE_ERROR_CODES.ANSWER_UNAVAILABLE, 'Knowledge answers unavailable', detail);
  }
}

/** No evidence floor is known for the embedding model in use, so no answer is attempted. */
export const NOT_CALIBRATED_DETAIL =
  'Answers from the knowledge base are not set up on this installation yet.';

export class KnowledgeAnswerTimeoutError extends AppError {
  constructor() {
    super(
      504,
      KNOWLEDGE_ERROR_CODES.ANSWER_TIMEOUT,
      'Knowledge answer timeout',
      'The answer took too long. Try again.',
    );
  }
}

export class KnowledgeAnswerFailedError extends AppError {
  constructor() {
    super(
      502,
      KNOWLEDGE_ERROR_CODES.ANSWER_FAILED,
      'Knowledge answer failed',
      'SI Academy AI could not answer this question. Try again later.',
    );
  }
}

/** Too many answers are being written at once on this server. */
export class KnowledgeAnswerBusyError extends AppError {
  constructor() {
    super(503, AI_ERROR_CODES.BUSY, 'AI busy', 'SI Academy AI is busy. Try again in a minute.');
  }
}
