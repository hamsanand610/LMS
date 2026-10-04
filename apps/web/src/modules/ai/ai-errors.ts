import { AI_ERROR_CODES } from '@lms/shared';
import { isApiError } from '@/lib/api/errors';

/**
 * What to tell the person when SI Academy AI refuses or fails (Phase 7E), in the product's own
 * words. Every message is chosen here by the error's code, so nothing the server or a provider
 * wrote is shown as it came: an unknown code gets the general sentence.
 */
const BY_CODE: Record<string, string> = {
  [AI_ERROR_CODES.QUOTA_EXCEEDED]:
    'SI Academy AI has reached its limit for now — your allowance for today, or your institute’s budget for the month. Try again later.',
  [AI_ERROR_CODES.GENERATION_IN_PROGRESS]:
    'Another answer is still being written. Wait for it, or stop it, then ask again.',
  [AI_ERROR_CODES.NOT_ALLOWED]: 'No AI help is given during a timed test. Finish the test first.',
  [AI_ERROR_CODES.FEATURE_DISABLED]: 'This part of SI Academy AI is switched off.',
  module_disabled: 'SI Academy AI is switched off for your institute.',
  [AI_ERROR_CODES.DATA_NOT_APPROVED]:
    'Your institute has not approved SI Academy AI for this kind of material yet.',
  [AI_ERROR_CODES.RESTRICTED_CONTENT]:
    'Your message looks like it holds a password, key or token, so it was not sent. Remove it and ask again.',
  [AI_ERROR_CODES.UNAVAILABLE]: 'SI Academy AI is not available right now. Try again later.',
  [AI_ERROR_CODES.BUSY]: 'SI Academy AI is busy. Try again in a moment.',
  [AI_ERROR_CODES.TIMEOUT]: 'SI Academy AI took too long to answer. Try again.',
  [AI_ERROR_CODES.ANSWER_WITHHELD]: 'SI Academy AI could not answer this.',
  [AI_ERROR_CODES.HINT_NEEDS_ATTEMPT]:
    'Submit an attempt first. A hint helps once you have tried and something did not work.',
  [AI_ERROR_CODES.SUBJECT_NOT_SUPPORTED]: 'SI Academy AI cannot be asked about that from here.',
  module_locked: 'This lesson is still locked. Finish the module before it first.',
  forbidden: 'SI Academy AI cannot use that here: it is not open to you.',
  not_found: 'That is no longer available. It may have been deleted or withdrawn.',
  csrf_failed: 'Your session needs refreshing. Reload the page and try again.',
  rate_limited: 'Too many requests. Wait a moment and try again.',
};

const GENERAL = 'Something went wrong with SI Academy AI. Try again.';
const UNREACHABLE = 'SI Academy AI could not be reached. Check your connection and try again.';

/** The sentence for a refusal or failure, from an error thrown by the API client or the stream. */
export function aiErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 401) return 'Your session has ended. Sign in again to continue.';
    // A question the form itself refused (too long, empty): the field's own sentence.
    if (error.code === 'validation_failed') {
      return error.problem?.errors?.[0]?.message ?? 'Check your question and try again.';
    }
    return BY_CODE[error.code] ?? GENERAL;
  }
  return error instanceof TypeError ? UNREACHABLE : GENERAL;
}

/** The sentence for an `error` event inside an answer stream: by its code, never its text. */
export function aiStreamErrorMessage(code: unknown): string {
  return (typeof code === 'string' && BY_CODE[code]) || GENERAL;
}
