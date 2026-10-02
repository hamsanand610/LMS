import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type EffectiveFlags,
  type FeatureFlag,
  type FeatureFlagUpdate,
  flagAudienceSchema,
  type FlagAudience,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { MemoryCache } from '../../core/cache/memory-cache.js';
import { DomainRuleError, NotFoundError, ValidationError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ModuleRegistryService } from '../../core/registry/module-registry.service.js';
import { inAudience } from '../../core/registry/flag-audience.js';
import { ModuleStateService } from '../../core/registry/module-state.service.js';
import { batchesOf, ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

@Injectable()
export class FlagsService {
  private readonly cache = new MemoryCache<FeatureFlag[]>(30_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly registry: ModuleRegistryService,
    private readonly moduleState: ModuleStateService,
    private readonly scope: ScopeService,
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
    await this.requireKnownAudience(audience, org.id);
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

  /** Every batch and role an audience names must exist in this institute. */
  private async requireKnownAudience(
    audience: FlagAudience,
    organizationId: string,
  ): Promise<void> {
    const [batches, roles] = await Promise.all([
      audience.batchIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.batch.count({
            where: { id: { in: audience.batchIds }, organizationId, deletedAt: null },
          }),
      audience.roleKeys.length === 0
        ? Promise.resolve(0)
        : this.prisma.role.count({ where: { key: { in: audience.roleKeys }, organizationId } }),
    ]);
    const issues: { path: string; message: string }[] = [];
    if (batches !== new Set(audience.batchIds).size) {
      issues.push({ path: 'audience.batchIds', message: 'One or more batches do not exist' });
    }
    if (roles !== new Set(audience.roleKeys).size) {
      issues.push({ path: 'audience.roleKeys', message: 'One or more roles do not exist' });
    }
    if (issues.length > 0) throw new ValidationError(issues);
  }

  /** Flags as seen by one user: enabled, and the user inside the flag's audience. */
  async effectiveFor(user: AuthUser): Promise<EffectiveFlags> {
    const [flags, person] = await Promise.all([this.list(), this.scope.personFor(user.id)]);
    const member = { roleKeys: user.roleKeys, batchIds: batchesOf(person) };
    const result: EffectiveFlags = {};
    for (const flag of flags) {
      result[flag.key] = flag.enabled && inAudience(flag.audience, member);
    }
    return result;
  }

  invalidate(): void {
    this.cache.clear();
  }
}
