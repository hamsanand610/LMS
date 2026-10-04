import { KNOWLEDGE_ERROR_CODES } from '@lms/shared';
import { AppError, ForbiddenError } from '../../../../core/http/errors.js';

/**
 * A retrieval's failures in SI Academy's words (Phase 8D; ADR-0036): what the person may act on,
 * never the provider's or the database's own — no SQL, no stack, no key.
 */

/** Nothing can embed a question on this installation now, or the provider cannot answer. */
export class KnowledgeRetrievalUnavailableError extends AppError {
  constructor() {
    super(
      503,
      KNOWLEDGE_ERROR_CODES.RETRIEVAL_UNAVAILABLE,
      'Knowledge search unavailable',
      'SI Academy AI cannot search the knowledge base just now. Try again later.',
    );
  }
}

/** The retrieval did not finish within its deadline. */
export class KnowledgeRetrievalTimeoutError extends AppError {
  constructor() {
    super(
      504,
      KNOWLEDGE_ERROR_CODES.RETRIEVAL_TIMEOUT,
      'Knowledge search timeout',
      'Searching the knowledge base took too long. Try again.',
    );
  }
}

/**
 * The retrieval failed: the provider's answer was not a vector it could use (502), or the search
 * itself failed (500).
 */
export class KnowledgeRetrievalFailedError extends AppError {
  constructor(status: 500 | 502) {
    super(
      status,
      KNOWLEDGE_ERROR_CODES.RETRIEVAL_FAILED,
      'Knowledge search failed',
      'SI Academy AI could not search the knowledge base. Try again later.',
    );
  }
}

/** A course or lesson the person cannot open, given as the retrieval's context. */
export class KnowledgeRetrievalForbiddenError extends ForbiddenError {
  constructor() {
    super(
      'That course or lesson is not one you can open, so the knowledge base cannot be searched from it.',
      KNOWLEDGE_ERROR_CODES.RETRIEVAL_FORBIDDEN,
    );
  }
}
