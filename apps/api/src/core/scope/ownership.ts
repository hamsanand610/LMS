import { type AuthUser, scopeFor } from '../auth/auth-user.js';
import { ForbiddenError } from '../http/errors.js';

/**
 * Changes to authored staff content (an assignment, a test) belong to its author, or to someone
 * whose `permission` reaches the whole institute. Reaching the content through a batch, because it
 * is scheduled there, is enough to use it but not to change it for every other batch.
 */
export function requireAuthorOrInstituteWide(
  record: { createdById: string | null },
  user: AuthUser,
  permission: string,
  what: string,
): void {
  if (scopeFor(user, permission) === 'all') return;
  if (record.createdById !== user.id) {
    throw new ForbiddenError(
      `This ${what} was written by someone else; ask an administrator to change it`,
    );
  }
}
