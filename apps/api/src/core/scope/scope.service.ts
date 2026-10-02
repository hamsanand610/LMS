import { Injectable } from '@nestjs/common';
import type { PermissionScope } from '@lms/shared';
import { type AuthUser, scopeFor } from '../auth/auth-user.js';
import { MemoryCache } from '../cache/memory-cache.js';
import { PrismaService } from '../prisma/prisma.service.js';

const CACHE_TTL_MS = 60_000;

/**
 * A caller's reach (null = unrestricted) narrowed to the one batch a filter asked for. Asking for a
 * batch outside the reach yields no batches: a filter narrows what a caller sees, never widens it.
 */
export function narrowToBatch(
  visible: string[] | null,
  requested: string | null | undefined,
): string[] | null {
  if (!requested) return visible;
  if (visible === null) return [requested];
  return visible.includes(requested) ? [requested] : [];
}

/** Who the caller is in terms of people records, and the batches they belong to. */
export interface PersonContext {
  studentId: string | null;
  trainerId: string | null;
  /** Batches the caller is an active learner in. */
  memberBatchIds: string[];
  /** Batches the caller is assigned to teach. */
  taughtBatchIds: string[];
}

/**
 * Every batch a person learns in or teaches. It answers questions about the person (a flag's
 * audience, say), never what a permission reaches: that is `visibleBatchIds`.
 */
export function batchesOf(person: PersonContext): string[] {
  return [...new Set([...person.memberBatchIds, ...person.taughtBatchIds])];
}

/**
 * Resolves the data a `batch`-scoped permission may reach. Scope resolution is an
 * authorisation concern, so it lives in core rather than in a feature module: every module
 * that filters by batch uses the same answer, and there is no module-to-module dependency.
 */
@Injectable()
export class ScopeService {
  private readonly cache = new MemoryCache<PersonContext>(CACHE_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  async personFor(userId: string): Promise<PersonContext> {
    const cached = this.cache.get(userId);
    if (cached) return cached;

    const [student, trainer] = await Promise.all([
      this.prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } }),
      this.prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true } }),
    ]);
    const [memberships, assignments] = await Promise.all([
      student
        ? this.prisma.batchMember.findMany({
            where: { studentId: student.id, isActive: true },
            select: { batchId: true },
          })
        : Promise.resolve([]),
      trainer
        ? this.prisma.batchTrainer.findMany({
            where: { trainerId: trainer.id },
            select: { batchId: true },
          })
        : Promise.resolve([]),
    ]);
    const context: PersonContext = {
      studentId: student?.id ?? null,
      trainerId: trainer?.id ?? null,
      memberBatchIds: memberships.map((r) => r.batchId),
      taughtBatchIds: assignments.map((r) => r.batchId),
    };
    this.cache.set(userId, context);
    return context;
  }

  /**
   * Batch ids a caller may reach for one permission: `all` → null (no restriction); `batch` → the
   * batches the caller teaches; `own` → the batches the caller learns in, where their own records
   * are; a permission the caller does not hold → none. Keeping teaching and learning apart means a
   * trainer who is also a learner never reaches classmates' work through a staff permission.
   * Failing closed matters because services check an object against a permission other than the
   * one on the route (a result read against `tests:read`, say).
   */
  async visibleBatchIds(user: AuthUser, permissionKey: string): Promise<string[] | null> {
    const scope: PermissionScope | null = scopeFor(user, permissionKey);
    if (scope === null) return [];
    if (scope === 'all') return null;
    const person = await this.personFor(user.id);
    return scope === 'batch' ? person.taughtBatchIds : person.memberBatchIds;
  }

  /** Convenience for list queries: a Prisma filter fragment, or `{}` when unrestricted. */
  async batchFilter(
    user: AuthUser,
    permissionKey: string,
  ): Promise<{ id?: { in: string[] } } | Record<string, never>> {
    const ids = await this.visibleBatchIds(user, permissionKey);
    return ids === null ? {} : { id: { in: ids } };
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}
