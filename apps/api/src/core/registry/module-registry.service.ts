import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { ModuleManifest } from '@lms/module-sdk';
import { moduleFlagKey } from '@lms/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantService } from '../tenant/tenant.service.js';

export const MODULE_MANIFESTS = Symbol('MODULE_MANIFESTS');

/**
 * Holds every module manifest, validates the set at boot and makes sure the database
 * has the permissions and flags the manifests declare (idempotent upserts).
 */
@Injectable()
export class ModuleRegistryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ModuleRegistryService.name);
  private readonly byKey = new Map<string, ModuleManifest>();

  constructor(
    @Inject(MODULE_MANIFESTS) manifests: ModuleManifest[],
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {
    for (const manifest of manifests) {
      if (this.byKey.has(manifest.key)) throw new Error(`Duplicate module key "${manifest.key}"`);
      this.byKey.set(manifest.key, manifest);
    }
    for (const manifest of manifests) {
      for (const dep of manifest.dependsOn) {
        if (!this.byKey.has(dep))
          throw new Error(`Module "${manifest.key}" depends on unknown module "${dep}"`);
      }
    }
  }

  all(): ModuleManifest[] {
    return [...this.byKey.values()];
  }

  get(key: string): ModuleManifest | undefined {
    return this.byKey.get(key);
  }

  permissions() {
    return this.all().flatMap((m) => m.permissions);
  }

  navigationDefaults() {
    return this.all().flatMap((m) =>
      m.navigation.map((item) => ({
        ...item,
        flag: item.flag ?? (m.core ? undefined : moduleFlagKey(m.key)),
        moduleKey: m.key,
      })),
    );
  }

  flagDefaults() {
    return this.all().flatMap((m) => {
      const declared = [...m.flags];
      if (!m.core && !declared.some((f) => f.key === moduleFlagKey(m.key))) {
        declared.push({
          key: moduleFlagKey(m.key),
          description: `Enable the ${m.name} module`,
          default: true,
          kind: 'module',
        });
      }
      return declared.map((f) => ({ ...f, moduleKey: m.key }));
    });
  }

  /** Upserts the permission catalogue and flag defaults so a fresh database matches the code. */
  async onApplicationBootstrap(): Promise<void> {
    await this.syncCatalogue();
  }

  async syncCatalogue(): Promise<void> {
    for (const p of this.permissions()) {
      await this.prisma.permission.upsert({
        where: { key: p.key },
        create: {
          key: p.key,
          resource: p.resource,
          action: p.action,
          moduleKey: p.moduleKey,
          description: p.description,
        },
        update: {
          resource: p.resource,
          action: p.action,
          moduleKey: p.moduleKey,
          description: p.description,
        },
      });
    }
    let org;
    try {
      org = await this.tenant.getOrganization();
    } catch (error) {
      this.logger.warn((error as Error).message);
      return;
    }
    for (const f of this.flagDefaults()) {
      await this.prisma.featureFlag.upsert({
        where: { organizationId_key: { organizationId: org.id, key: f.key } },
        create: {
          organizationId: org.id,
          key: f.key,
          description: f.description,
          enabled: f.default,
          kind: f.kind,
          locked: f.locked ?? false,
        },
        update: { description: f.description, kind: f.kind, locked: f.locked ?? false },
      });
    }
    this.logger.log(
      `Module catalogue synced (${this.byKey.size} modules, ${this.permissions().length} permissions)`,
    );
  }
}
