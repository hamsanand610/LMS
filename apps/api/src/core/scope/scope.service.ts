import { Injectable } from '@nestjs/common';
import type { PermissionScope } from '@lms/shared';
import { type AuthUser, scopeFor } from '../auth/auth-user.js';
import { MemoryCache } from '../cache/memory-cache.js';
import { PrismaService } from '../prisma/prisma.service.js';

const CACHE_TTL_MS = 60_000;

/** Who the caller is in terms of people records, and which batches they may see. */
export interface PersonContext {
  studentId: string | null;
  trainerId: string | null;
  /** Batches the caller is assigned to (trainer) or a member of (student). */
  batchIds: string[];
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
      batchIds: [...new Set([...memberships, ...assignments].map((r) => r.batchId))],
    };
    this.cache.set(userId, context);
    return context;
  }

  /**
   * Batch ids a caller may reach for one permission:
   * `all` → null (no restriction), `batch`/`own` → the caller's own batches.
   */
  async visibleBatchIds(user: AuthUser, permissionKey: string): Promise<string[] | null> {
    const scope: PermissionScope | null = scopeFor(user, permissionKey);
    if (scope === 'all') return null;
    const person = await this.personFor(user.id);
    return person.batchIds;
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
