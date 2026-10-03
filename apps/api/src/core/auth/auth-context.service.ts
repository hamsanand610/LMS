import { Injectable } from '@nestjs/common';
import type { GrantedPermission } from '@lms/shared';
import { MemoryCache } from '../cache/memory-cache.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';

const CACHE_TTL_MS = 60_000;
/** How long a session's liveness is trusted before it is read again (Phase 6). */
const SESSION_TTL_MS = 15_000;

interface SessionLiveness {
  userId: string;
  live: boolean;
}

/**
 * Resolves the caller's roles and effective permissions. Cached for one minute per user;
 * role or bundle changes call `invalidate` so they apply promptly.
 *
 * A load that read the database before an `invalidate` must not put its (now stale) answer back
 * in the cache afterwards (Phase 6): each user, and the cache as a whole, carry a generation that
 * an invalidation bumps, and a load only caches what it read under the generation it started in.
 */
@Injectable()
export class AuthContextService {
  private readonly cache = new MemoryCache<Omit<AuthUser, 'sessionId'>>(CACHE_TTL_MS);
  private readonly sessions = new MemoryCache<SessionLiveness>(SESSION_TTL_MS);
  private readonly generations = new Map<string, number>();
  private generation = 0;

  constructor(private readonly prisma: PrismaService) {}

  async load(userId: string): Promise<Omit<AuthUser, 'sessionId'> | null> {
    const cached = this.cache.get(userId);
    if (cached) return cached;
    const started = this.generationOf(userId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    if (!user) return null;

    const permissionMap = new Map<string, GrantedPermission>();
    const order = ['all', 'batch', 'own'] as const;
    for (const userRole of user.roles) {
      for (const rp of userRole.role.permissions) {
        const existing = permissionMap.get(rp.permission.key);
        if (!existing || order.indexOf(rp.scope) < order.indexOf(existing.scope)) {
          permissionMap.set(rp.permission.key, { key: rp.permission.key, scope: rp.scope });
        }
      }
    }
    // Every signed-in user may access their own account data.
    permissionMap.set('auth:self', { key: 'auth:self', scope: 'own' });

    const context: Omit<AuthUser, 'sessionId'> = {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      status: user.status,
      roleKeys: user.roles.map((r) => r.role.key),
      permissions: [...permissionMap.values()],
      tokenVersion: user.tokenVersion,
    };
    if (this.generationOf(userId) === started) this.cache.set(userId, context);
    return context;
  }

  /**
   * Whether the session an access token was issued for is still alive (Phase 6). Its family is
   * asked rather than the one row: a refresh retires the row it rotates but keeps the family, while
   * signing out, an administrator ending the session and refresh-token reuse leave the family with
   * no live session — and then every access token of that family stops working at once.
   */
  async sessionLive(sessionId: string, userId: string): Promise<boolean> {
    const cached = this.sessions.get(sessionId);
    if (cached && cached.userId === userId) return cached.live;
    const started = this.generationOf(userId);
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, familyId: true },
    });
    let live = false;
    if (session && session.userId === userId) {
      live =
        (await this.prisma.session.count({
          where: { familyId: session.familyId, revokedAt: null, expiresAt: { gt: new Date() } },
        })) > 0;
    }
    if (this.generationOf(userId) === started) this.sessions.set(sessionId, { userId, live });
    return live;
  }

  /** Forgets everything cached about one user: their context and their sessions' liveness. */
  invalidate(userId: string): void {
    this.generations.set(userId, (this.generations.get(userId) ?? 0) + 1);
    this.cache.delete(userId);
    this.sessions.clear();
  }

  invalidateAll(): void {
    this.generation += 1;
    this.cache.clear();
    this.sessions.clear();
  }

  private generationOf(userId: string): string {
    return `${this.generation}:${this.generations.get(userId) ?? 0}`;
  }
}
