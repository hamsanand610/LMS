import { Injectable } from '@nestjs/common';
import { flagAudienceSchema, moduleFlagKey, type FlagAudience } from '@lms/shared';
import type { AuthUser } from '../auth/auth-user.js';
import { MemoryCache } from '../cache/memory-cache.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { batchesOf, ScopeService } from '../scope/scope.service.js';
import { TenantService } from '../tenant/tenant.service.js';
import { inAudience } from './flag-audience.js';
import { ModuleRegistryService } from './module-registry.service.js';

interface ModuleFlagState {
  enabled: boolean;
  audience: FlagAudience;
}

/**
 * Answers "is module X enabled?" from the module flag in the database (default from the manifest).
 * Core modules are always enabled. `isEnabled` is the institute-wide switch, for background work;
 * `isEnabledFor` adds the flag's audience, for anything done on a person's behalf. Cached briefly;
 * flag changes call `invalidate`.
 */
@Injectable()
export class ModuleStateService {
  private readonly cache = new MemoryCache<ModuleFlagState>(30_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly registry: ModuleRegistryService,
    private readonly scope: ScopeService,
  ) {}

  async isEnabled(moduleKey: string): Promise<boolean> {
    const manifest = this.registry.get(moduleKey);
    if (!manifest) return false;
    if (manifest.core) return true;
    return (await this.state(moduleKey)).enabled;
  }

  /**
   * Whether the module is on for this person: on for the institute, and they are in its audience.
   * Without a person (a public route) only the institute-wide switch applies.
   */
  async isEnabledFor(moduleKey: string, user: AuthUser | undefined): Promise<boolean> {
    const manifest = this.registry.get(moduleKey);
    if (!manifest) return false;
    if (manifest.core) return true;
    const state = await this.state(moduleKey);
    if (!state.enabled || !user) return state.enabled;
    const person = await this.scope.personFor(user.id);
    return inAudience(state.audience, {
      roleKeys: user.roleKeys,
      batchIds: batchesOf(person, user),
    });
  }

  invalidate(): void {
    this.cache.clear();
  }

  private async state(moduleKey: string): Promise<ModuleFlagState> {
    const cached = this.cache.get(moduleKey);
    if (cached !== undefined) return cached;
    const org = await this.tenant.getOrganization();
    const flag = await this.prisma.featureFlag.findUnique({
      where: { organizationId_key: { organizationId: org.id, key: moduleFlagKey(moduleKey) } },
    });
    const declared = this.registry
      .get(moduleKey)
      ?.flags.find((f) => f.key === moduleFlagKey(moduleKey));
    const state: ModuleFlagState = {
      enabled: flag ? flag.enabled : (declared?.default ?? true),
      audience: flagAudienceSchema.parse(flag?.audience ?? {}),
    };
    this.cache.set(moduleKey, state);
    return state;
  }
}
