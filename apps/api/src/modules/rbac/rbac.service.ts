import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PERMISSION_SCOPES, SYSTEM_ROLES, type PermissionScope } from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { AuthContextService } from '../../core/auth/auth-context.service.js';
import {
  ConflictError,
  DomainRuleError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ModuleRegistryService } from '../../core/registry/module-registry.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { syncSystemRoles } from './sync.js';

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
}

export interface BundleInput {
  permissionKey: string;
  scope: PermissionScope;
}

@Injectable()
export class RbacService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly registry: ModuleRegistryService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly authContext: AuthContextService,
  ) {}

  /** Makes sure system roles exist and the Super Admin bundle covers every permission. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.registry.syncCatalogue();
      await this.syncSystemRoles();
    } catch (error) {
      this.logger.warn(`Role sync skipped: ${(error as Error).message}`);
    }
  }

  /**
   * Brings the system roles up to their default bundles.
   *
   * This delegates to the one watermark-aware implementation (ADR-0009) rather than repeating the
   * rules: a role that has never been seeded receives its whole bundle, every role receives the
   * defaults for permissions a new module has just added, and a permission a client removed in the
   * matrix is never handed back. An earlier copy of this method only seeded a role that had no
   * permissions at all, so a new module's permissions reached nobody but the Super Admin.
   */
  async syncSystemRoles(): Promise<void> {
    const org = await this.tenant.getOrganization();
    await syncSystemRoles(this.prisma, org.id);
    this.authContext.invalidateAll();
  }

  async listRoles(): Promise<RoleSummary[]> {
    const org = await this.tenant.getOrganization();
    const roles = await this.prisma.role.findMany({
      where: { organizationId: org.id },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { permissions: true, users: true } } },
    });
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissionCount: r._count.permissions,
      userCount: r._count.users,
    }));
  }

  async createRole(input: {
    key: string;
    name: string;
    description?: string;
    cloneFromRoleId?: string;
  }): Promise<RoleSummary> {
    const org = await this.tenant.getOrganization();
    const existing = await this.prisma.role.findUnique({
      where: { organizationId_key: { organizationId: org.id, key: input.key } },
    });
    if (existing) throw new ConflictError(`A role with key "${input.key}" already exists`);
    const role = await this.prisma.role.create({
      data: {
        organizationId: org.id,
        key: input.key,
        name: input.name,
        description: input.description ?? '',
        isSystem: false,
      },
    });
    if (input.cloneFromRoleId) {
      // A copy of one of this institute's roles; never of the Super Admin's, whose bundle is "all".
      const sourceRole = await this.prisma.role.findFirst({
        where: { id: input.cloneFromRoleId, organizationId: org.id },
      });
      if (!sourceRole) throw new NotFoundError('Role');
      if (sourceRole.key === SYSTEM_ROLES.SUPER_ADMIN) {
        throw new DomainRuleError('The Super Admin role cannot be copied', 'role_locked');
      }
      const source = await this.prisma.rolePermission.findMany({
        where: { roleId: sourceRole.id },
      });
      if (source.length) {
        await this.prisma.rolePermission.createMany({
          data: source.map((s) => ({
            roleId: role.id,
            permissionId: s.permissionId,
            scope: s.scope,
          })),
        });
      }
    }
    await this.audit.record({
      action: 'rbac.role_created',
      resourceType: 'role',
      resourceId: role.id,
      after: { key: role.key, name: role.name },
      summary: `Role ${role.name} created`,
    });
    this.events.emit('role.changed', { roleId: role.id });
    const [summary] = (await this.listRoles()).filter((r) => r.id === role.id);
    return summary!;
  }

  async updateRole(roleId: string, input: { name?: string; description?: string }): Promise<void> {
    const role = await this.getRole(roleId);
    const updated = await this.prisma.role.update({
      where: { id: role.id },
      data: { name: input.name, description: input.description },
    });
    await this.audit.record({
      action: 'rbac.role_updated',
      resourceType: 'role',
      resourceId: role.id,
      before: { name: role.name, description: role.description },
      after: { name: updated.name, description: updated.description },
    });
  }

  async getRolePermissions(roleId: string): Promise<BundleInput[]> {
    const role = await this.getRole(roleId);
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId: role.id },
      include: { permission: true },
    });
    return rows
      .map((r) => ({ permissionKey: r.permission.key, scope: r.scope }))
      .sort((a, b) => a.permissionKey.localeCompare(b.permissionKey));
  }

  async setRolePermissions(roleId: string, entries: BundleInput[]): Promise<BundleInput[]> {
    const role = await this.getRole(roleId);
    if (role.key === SYSTEM_ROLES.SUPER_ADMIN) {
      throw new DomainRuleError(
        'The Super Admin role always holds every permission and cannot be edited',
        'role_locked',
      );
    }
    const permissions = await this.prisma.permission.findMany();
    const byKey = new Map(permissions.map((p) => [p.key, p]));
    const catalogue = new Map(this.registry.permissions().map((p) => [p.key, p.scopes]));
    const issues: { path: string; message: string }[] = [];
    entries.forEach((e, i) => {
      if (!byKey.has(e.permissionKey))
        issues.push({
          path: `${i}.permissionKey`,
          message: `Unknown permission "${e.permissionKey}"`,
        });
      if (!PERMISSION_SCOPES.includes(e.scope))
        issues.push({ path: `${i}.scope`, message: `Unknown scope "${e.scope}"` });
      // Each permission at the scopes it means something at: an institute-wide power granted at
      // `own` would still act on everything, and would slip past the checks on granting roles.
      const allowed = catalogue.get(e.permissionKey);
      if (allowed && PERMISSION_SCOPES.includes(e.scope) && !allowed.includes(e.scope))
        issues.push({
          path: `${i}.scope`,
          message: `"${e.permissionKey}" is granted at ${allowed.join(' or ')} only`,
        });
    });
    if (issues.length) throw new ValidationError(issues);

    const before = await this.getRolePermissions(roleId);
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: entries.map((e) => ({
          roleId: role.id,
          permissionId: byKey.get(e.permissionKey)!.id,
          scope: e.scope,
        })),
      });
    });
    this.authContext.invalidateAll();
    await this.audit.record({
      action: 'rbac.bundle_updated',
      resourceType: 'role',
      resourceId: role.id,
      before,
      after: entries,
      summary: `Permissions of ${role.name} updated`,
    });
    this.events.emit('role.changed', { roleId: role.id });
    return this.getRolePermissions(roleId);
  }

  async listPermissions(): Promise<
    {
      moduleKey: string;
      moduleName: string;
      permissions: { key: string; description: string; scopes: readonly PermissionScope[] }[];
    }[]
  > {
    const manifests = this.registry.all();
    return manifests
      .filter((m) => m.permissions.length > 0)
      .map((m) => ({
        moduleKey: m.key,
        moduleName: m.name,
        permissions: m.permissions.map((p) => ({
          key: p.key,
          description: p.description,
          scopes: p.scopes,
        })),
      }));
  }

  async getRole(roleId: string) {
    const org = await this.tenant.getOrganization();
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: org.id },
    });
    if (!role) throw new NotFoundError('Role');
    return role;
  }
}
