import { AI_ERROR_CODES } from '@lms/shared';
import { AppError } from '../../../core/http/errors.js';

/** Too many learning agent runs at once in this process (Phase 9B): try again shortly. */
export class AgentBusyError extends AppError {
  constructor() {
    super(503, AI_ERROR_CODES.BUSY, 'AI busy', 'SI Academy AI is busy. Try again in a minute.');
  }
}
