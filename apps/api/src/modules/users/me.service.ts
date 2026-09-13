import { Injectable } from '@nestjs/common';
import {
  type MeResponse,
  type Portal,
  PORTALS,
  ROLE_HOME_PORTAL,
  ROLE_PRIORITY,
  type SystemRoleKey,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { BrandingService } from '../settings/branding.service.js';
import { FlagsService } from '../settings/flags.service.js';
import { NavigationService } from '../settings/navigation.service.js';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly branding: BrandingService,
    private readonly flags: FlagsService,
    private readonly navigation: NavigationService,
  ) {}

  async build(user: AuthUser): Promise<MeResponse> {
    const [org, row, branding, flags] = await Promise.all([
      this.tenant.getOrganization(),
      this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { roles: { include: { role: true } } },
      }),
      this.branding.getPublic(),
      this.flags.effectiveFor(user),
    ]);
    const navigation = await this.navigation.forUser(user, flags);
    // A portal is available when a role lands on it or when the user has navigation items in it
    // (student and trainer portals have no modules yet in Phase 1 but must still open).
    const rolePortals = user.roleKeys
      .map((key) => ROLE_HOME_PORTAL[key as SystemRoleKey])
      .filter((p): p is Portal => Boolean(p));
    const portals = PORTALS.filter((p) => rolePortals.includes(p) || navigation[p].length > 0);
    const homePortal = pickHomePortal(user.roleKeys, portals);

    return {
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        avatarUrl: null,
        status: row.status,
      },
      roles: row.roles.map((r) => ({ key: r.role.key, name: r.role.name })),
      homePortal,
      portals,
      permissions: user.permissions,
      flags,
      navigation,
      branding,
      organization: { key: org.key, name: org.name, timezone: org.timezone, locale: org.locale },
      serverTime: new Date().toISOString(),
    };
  }
}

function pickHomePortal(roleKeys: string[], portals: Portal[]): Portal {
  for (const key of ROLE_PRIORITY) {
    if (roleKeys.includes(key)) {
      const portal = ROLE_HOME_PORTAL[key as SystemRoleKey];
      if (portals.includes(portal)) return portal;
    }
  }
  return portals[0] ?? 'student';
}
