import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type EffectiveFlags,
  type FeatureFlag,
  type FeatureFlagUpdate,
  flagAudienceSchema,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { MemoryCache } from '../../core/cache/memory-cache.js';
import { DomainRuleError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ModuleRegistryService } from '../../core/registry/module-registry.service.js';
import { ModuleStateService } from '../../core/registry/module-state.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

@Injectable()
export class FlagsService {
  private readonly cache = new MemoryCache<FeatureFlag[]>(30_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly registry: ModuleRegistryService,
    private readonly moduleState: ModuleStateService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /** Manifest defaults joined with stored overrides. */
  async list(): Promise<FeatureFlag[]> {
    const cached = this.cache.get('all');
    if (cached) return cached;
    const org = await this.tenant.getOrganization();
    const rows = await this.prisma.featureFlag.findMany({ where: { organizationId: org.id } });
    const stored = new Map(rows.map((r) => [r.key, r]));
    const flags: FeatureFlag[] = this.registry.flagDefaults().map((def) => {
      const row = stored.get(def.key);
      return {
        key: def.key,
        description: def.description,
        kind: def.kind,
        locked: def.locked ?? false,
        enabled: row ? row.enabled : def.default,
        audience: flagAudienceSchema.parse(row?.audience ?? {}),
      };
    });
    this.cache.set('all', flags);
    return flags;
  }

  async update(
    key: string,
    patch: FeatureFlagUpdate,
    actorId: string | null,
  ): Promise<FeatureFlag> {
    const flags = await this.list();
    const current = flags.find((f) => f.key === key);
    if (!current) throw new NotFoundError('Feature flag');
    if (current.locked)
      throw new DomainRuleError(
        'This flag belongs to a core module and cannot be changed',
        'flag_locked',
      );
    const org = await this.tenant.getOrganization();
    const audience = flagAudienceSchema.parse({ ...current.audience, ...(patch.audience ?? {}) });
    const enabled = patch.enabled ?? current.enabled;
    await this.prisma.featureFlag.upsert({
      where: { organizationId_key: { organizationId: org.id, key } },
      create: {
        organizationId: org.id,
        key,
        description: current.description,
        kind: current.kind,
        locked: current.locked,
        enabled,
        audience,
        updatedById: actorId,
      },
      update: { enabled, audience, updatedById: actorId },
    });
    this.cache.clear();
    this.moduleState.invalidate();
    await this.audit.record({
      action: 'flags.updated',
      resourceType: 'feature_flag',
      resourceId: key,
      before: current,
      after: { ...current, enabled, audience },
      summary: `Flag ${key} ${enabled ? 'enabled' : 'disabled'}`,
    });
    this.events.emit('flag.changed', { key, enabled });
    return { ...current, enabled, audience };
  }

  /** Flags as seen by one user: enabled and within audience (batch audiences apply from Phase 2). */
  async effectiveFor(user: AuthUser): Promise<EffectiveFlags> {
    const flags = await this.list();
    const result: EffectiveFlags = {};
    for (const flag of flags) {
      const roleOk =
        flag.audience.roleKeys.length === 0 ||
        flag.audience.roleKeys.some((r) => user.roleKeys.includes(r));
      result[flag.key] = flag.enabled && roleOk;
    }
    return result;
  }

  invalidate(): void {
    this.cache.clear();
  }
}
