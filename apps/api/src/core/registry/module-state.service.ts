import { Injectable } from '@nestjs/common';
import { moduleFlagKey } from '@lms/shared';
import { MemoryCache } from '../cache/memory-cache.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantService } from '../tenant/tenant.service.js';
import { ModuleRegistryService } from './module-registry.service.js';

/**
 * Answers "is module X enabled?" from the module flag in the database (default from the manifest).
 * Core modules are always enabled. Cached briefly; flag changes call `invalidate`.
 */
@Injectable()
export class ModuleStateService {
  private readonly cache = new MemoryCache<boolean>(30_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly registry: ModuleRegistryService,
  ) {}

  async isEnabled(moduleKey: string): Promise<boolean> {
    const manifest = this.registry.get(moduleKey);
    if (!manifest) return false;
    if (manifest.core) return true;
    const cached = this.cache.get(moduleKey);
    if (cached !== undefined) return cached;
    const org = await this.tenant.getOrganization();
    const flag = await this.prisma.featureFlag.findUnique({
      where: { organizationId_key: { organizationId: org.id, key: moduleFlagKey(moduleKey) } },
    });
    const declared = manifest.flags.find((f) => f.key === moduleFlagKey(moduleKey));
    const enabled = flag ? flag.enabled : (declared?.default ?? true);
    this.cache.set(moduleKey, enabled);
    return enabled;
  }

  invalidate(): void {
    this.cache.clear();
  }
}
