import type { ModuleManifest } from '@lms/module-sdk';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { SYSTEM_ROLE_DEFINITIONS } from './role-bundles.js';

type Db = Pick<PrismaClient, 'permission' | 'role' | 'rolePermission'>;

/** Upserts the permission catalogue declared by the manifests (used by the seed and at boot). */
export async function syncPermissionCatalogue(
  db: Db,
  manifests: ModuleManifest[],
): Promise<number> {
  let count = 0;
  for (const manifest of manifests) {
    for (const p of manifest.permissions) {
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
  }
  return count;
}

/**
 * Creates the system roles when missing and applies default bundles to roles that have none.
 * The Super Admin bundle is always brought up to the full catalogue.
 */
export async function syncSystemRoles(db: Db, organizationId: string): Promise<void> {
  const permissions = await db.permission.findMany();
  const byKey = new Map(permissions.map((p) => [p.key, p]));
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
    if (existing > 0) continue;
    for (const entry of def.bundle) {
      const p = byKey.get(entry.key);
      if (p)
        await db.rolePermission.create({
          data: { roleId: role.id, permissionId: p.id, scope: entry.scope },
        });
    }
  }
}
