import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type EffectiveFlags,
  type NavigationConfig,
  type NavigationItem,
  type NavigationOverride,
  navigationConfigSchema,
  type Portal,
  PORTALS,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, scopeFor } from '../../core/auth/auth-user.js';
import { MemoryCache } from '../../core/cache/memory-cache.js';
import { ValidationError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ModuleRegistryService } from '../../core/registry/module-registry.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

/** Widest first: a caller holding `all` passes a `batch` minimum, and so on. */
const SCOPE_ORDER = ['all', 'batch', 'own'] as const;

@Injectable()
export class NavigationService {
  private readonly cache = new MemoryCache<Record<Portal, NavigationOverride[]>>(30_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly registry: ModuleRegistryService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /** Effective navigation for a user: manifest items filtered by permission and flags, then client overrides. */
  async forUser(user: AuthUser, flags: EffectiveFlags): Promise<Record<Portal, NavigationItem[]>> {
    const overrides = await this.allOverrides();
    const result: Record<Portal, NavigationItem[]> = { student: [], trainer: [], admin: [] };
    for (const item of this.registry.navigationDefaults()) {
      if (item.permission) {
        const scope = scopeFor(user, item.permission);
        if (!scope) continue;
        if (item.minScope && SCOPE_ORDER.indexOf(scope) > SCOPE_ORDER.indexOf(item.minScope)) {
          continue;
        }
      }
      if (item.flag && flags[item.flag] === false) continue;
      if (item.moduleFlag && flags[item.moduleFlag] === false) continue;
      const override = overrides[item.portal].find((o) => o.key === item.key);
      if (override?.hidden) continue;
      result[item.portal].push({
        key: item.key,
        label: override?.label ?? item.label,
        route: item.route,
        icon: override?.icon ?? item.icon,
        order: override?.order ?? item.order,
        group: item.group,
      });
    }
    for (const portal of PORTALS)
      result[portal].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    return result;
  }

  /** Defaults with overrides applied, for the navigation settings page (no permission filtering). */
  async getConfig(portal: Portal): Promise<{
    portal: Portal;
    items: (NavigationItem & { hidden: boolean; defaultLabel: string; defaultOrder: number })[];
  }> {
    const overrides = (await this.allOverrides())[portal];
    const items = this.registry
      .navigationDefaults()
      .filter((i) => i.portal === portal)
      .map((item) => {
        const o = overrides.find((x) => x.key === item.key);
        return {
          key: item.key,
          label: o?.label ?? item.label,
          route: item.route,
          icon: o?.icon ?? item.icon,
          order: o?.order ?? item.order,
          group: item.group,
          hidden: o?.hidden ?? false,
          defaultLabel: item.label,
          defaultOrder: item.order,
        };
      })
      .sort((a, b) => a.order - b.order);
    return { portal, items };
  }

  async updateConfig(config: NavigationConfig, actorId: string | null): Promise<void> {
    const parsed = navigationConfigSchema.parse(config);
    const known = new Set(
      this.registry
        .navigationDefaults()
        .filter((i) => i.portal === parsed.portal)
        .map((i) => i.key),
    );
    const unknown = parsed.items.filter((i) => !known.has(i.key)).map((i) => i.key);
    if (unknown.length)
      throw new ValidationError([
        { path: 'items', message: `Unknown navigation keys: ${unknown.join(', ')}` },
      ]);
    const org = await this.tenant.getOrganization();
    const before = await this.getConfig(parsed.portal);
    await this.prisma.navigationConfig.upsert({
      where: { organizationId_portal: { organizationId: org.id, portal: parsed.portal } },
      create: {
        organizationId: org.id,
        portal: parsed.portal,
        items: parsed.items,
        updatedById: actorId,
      },
      update: { items: parsed.items, updatedById: actorId },
    });
    this.cache.clear();
    await this.audit.record({
      action: 'navigation.updated',
      resourceType: 'navigation',
      resourceId: parsed.portal,
      before: before.items,
      after: parsed.items,
      summary: `Navigation of the ${parsed.portal} portal updated`,
    });
    this.events.emit('navigation.changed', { portal: parsed.portal });
  }

  private async allOverrides(): Promise<Record<Portal, NavigationOverride[]>> {
    const cached = this.cache.get('all');
    if (cached) return cached;
    const org = await this.tenant.getOrganization();
    const rows = await this.prisma.navigationConfig.findMany({ where: { organizationId: org.id } });
    const result: Record<Portal, NavigationOverride[]> = { student: [], trainer: [], admin: [] };
    for (const row of rows) {
      const portal = row.portal as Portal;
      if (PORTALS.includes(portal))
        result[portal] = navigationConfigSchema.shape.items.parse(row.items);
    }
    this.cache.set('all', result);
    return result;
  }
}
