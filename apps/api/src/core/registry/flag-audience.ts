import { SYSTEM_ROLES, type FlagAudience } from '@lms/shared';

/** Who a flag is being evaluated for. */
export interface AudienceMember {
  roleKeys: readonly string[];
  /** Batches the person learns in or teaches; empty for staff who work across the institute. */
  batchIds: readonly string[];
}

/**
 * Whether a person is inside a flag's audience, for a rollout to some roles or batches first. Each
 * listed condition must hold: one of the roles, when roles are listed; one of the batches, when
 * batches are listed. A batch audience limits the people who belong to batches (learners by
 * membership, trainers by assignment); staff who work across the institute have no batch of their
 * own and are not limited by it, so they can prepare what the pilot batches will see. The Super
 * Admin is never shut out of a module.
 */
export function inAudience(audience: FlagAudience, member: AudienceMember): boolean {
  if (member.roleKeys.includes(SYSTEM_ROLES.SUPER_ADMIN)) return true;
  const roleOk =
    audience.roleKeys.length === 0 || audience.roleKeys.some((r) => member.roleKeys.includes(r));
  const batchOk =
    audience.batchIds.length === 0 ||
    member.batchIds.length === 0 ||
    audience.batchIds.some((b) => member.batchIds.includes(b));
  return roleOk && batchOk;
}
