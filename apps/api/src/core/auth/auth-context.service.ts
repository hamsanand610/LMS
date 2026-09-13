import { Injectable } from '@nestjs/common';
import type { GrantedPermission } from '@lms/shared';
import { MemoryCache } from '../cache/memory-cache.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';

const CACHE_TTL_MS = 60_000;

/**
 * Resolves the caller's roles and effective permissions. Cached for one minute per user;
 * role or bundle changes call `invalidate` so they apply promptly.
 */
@Injectable()
export class AuthContextService {
  private readonly cache = new MemoryCache<Omit<AuthUser, 'sessionId'>>(CACHE_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  async load(userId: string): Promise<Omit<AuthUser, 'sessionId'> | null> {
    const cached = this.cache.get(userId);
    if (cached) return cached;

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
    this.cache.set(userId, context);
    return context;
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}
