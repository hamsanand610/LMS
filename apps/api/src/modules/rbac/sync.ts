import type { ModuleManifest } from '@lms/module-sdk';
import { PLATFORM_PERMISSIONS } from '@lms/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { SYSTEM_ROLE_DEFINITIONS } from './role-bundles.js';

type Db = Pick<PrismaClient, 'permission' | 'role' | 'rolePermission' | 'setting'>;

/** Setting key holding the permission keys the seeder has already handed out (ADR-0009). */
export const SEEDED_PERMISSIONS_KEY = 'rbac.seeded_permissions';

/**
 * Upserts the permission catalogue (used by the seed and at boot).
 *
 * The source is `PLATFORM_PERMISSIONS`, not the manifests: a permission the plan asks to be
 * seeded for a module this build does not have — the placement keys of §12.3 — belongs to no
 * manifest, and would otherwise never exist as a row for a role to be granted. The manifests are
 * passed in so a module that declares a permission outside the catalogue is caught here.
 */
export async function syncPermissionCatalogue(
  db: Db,
  manifests: ModuleManifest[],
): Promise<number> {
  const known = new Set(PLATFORM_PERMISSIONS.map((permission) => permission.key));
  for (const manifest of manifests) {
    for (const permission of manifest.permissions) {
      if (!known.has(permission.key)) {
        throw new Error(
          `Module "${manifest.key}" declares "${permission.key}", which is not in the platform catalogue`,
        );
      }
    }
  }

  let count = 0;
  for (const p of PLATFORM_PERMISSIONS) {
    await db.permission.upsert({
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
    count += 1;
  }
  return count;
}

async function readWatermark(db: Db, organizationId: string): Promise<Set<string>> {
  const row = await db.setting.findUnique({
    where: { organizationId_key: { organizationId, key: SEEDED_PERMISSIONS_KEY } },
  });
  const value = row?.value as { keys?: unknown } | null;
  const keys = Array.isArray(value?.keys) ? value.keys : [];
  return new Set(keys.filter((k): k is string => typeof k === 'string'));
}

/**
 * Creates the system roles when missing and applies default bundles.
 *
 * The Super Admin bundle is always brought up to the full catalogue. For the other system
 * roles the defaults are applied **once per permission**: a role that has never been seeded
 * receives its whole bundle, and every role receives defaults for permissions that are new to
 * the catalogue since the last run (a new module). Permissions a client removed in the UI are
 * never re-added, because they are already past the watermark (ADR-0009).
 */
export async function syncSystemRoles(db: Db, organizationId: string): Promise<void> {
  const permissions = await db.permission.findMany();
  const byKey = new Map(permissions.map((p) => [p.key, p]));
  const seeded = await readWatermark(db, organizationId);
  const isFirstRun = seeded.size === 0;

  for (const [key, def] of Object.entries(SYSTEM_ROLE_DEFINITIONS)) {
    const role = await db.role.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, name: def.name, description: def.description, isSystem: true },
      update: { isSystem: true },
    });

    if (def.bundle === '*') {
      for (const p of permissions) {
        await db.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
          create: { roleId: role.id, permissionId: p.id, scope: 'all' },
          update: { scope: 'all' },
        });
      }
      continue;
    }

    const existing = await db.rolePermission.count({ where: { roleId: role.id } });
    const grantAll = existing === 0 || isFirstRun;
    for (const entry of def.bundle) {
      if (!grantAll && seeded.has(entry.key)) continue;
      const permission = byKey.get(entry.key);
      if (!permission) continue;
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id, scope: entry.scope },
        update: {},
      });
    }
  }

  const allKeys = [...new Set(permissions.map((p) => p.key))].sort();
  await db.setting.upsert({
    where: { organizationId_key: { organizationId, key: SEEDED_PERMISSIONS_KEY } },
    create: { organizationId, key: SEEDED_PERMISSIONS_KEY, value: { keys: allKeys } },
    update: { value: { keys: allKeys } },
  });
}
