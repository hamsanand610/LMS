import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SYSTEM_ROLES, type Paginated, type SessionSummary } from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { AuthContextService } from '../../core/auth/auth-context.service.js';
import { type AuthUser, holdsAtLeast } from '../../core/auth/auth-user.js';
import {
  ConflictError,
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { paginate, parseSort, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { InvitationService } from '../auth/invitation.service.js';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  status: 'invited' | 'active' | 'suspended' | 'deactivated';
  roles: { key: string; name: string }[];
  lastLoginAt: string | null;
  /** Set while too many wrong passwords keep the account locked. */
  lockedUntil: string | null;
  createdAt: string;
}

export interface ListUsersQuery {
  page: number;
  pageSize: number;
  sort?: string;
  q?: string;
  role?: string;
  status?: 'invited' | 'active' | 'suspended' | 'deactivated';
}

const SORT_FIELDS = ['name', 'email', 'status', 'lastLoginAt', 'createdAt'] as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly invitations: InvitationService,
    private readonly authContext: AuthContextService,
  ) {}

  async list(query: ListUsersQuery): Promise<Paginated<UserSummary>> {
    const org = await this.tenant.getOrganization();
    const where = {
      organizationId: org.id,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { roles: { some: { role: { key: query.role } } } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { email: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const orderBy = parseSort(query.sort, SORT_FIELDS, {
      field: 'createdAt',
      direction: 'desc',
    }).map((s) => ({ [s.field]: s.direction }));
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        ...skipTake(query),
        include: { roles: { include: { role: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(rows.map(toSummary), total, query);
  }

  async get(id: string): Promise<UserSummary> {
    const user = await this.find(id);
    return toSummary(user);
  }

  async invite(
    input: { name: string; email: string; mobile?: string | null; roleKeys: string[] },
    actor: AuthUser,
  ): Promise<UserSummary> {
    const org = await this.tenant.getOrganization();
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing)
      throw new ConflictError('An account with this email already exists', 'email_taken');
    const roles = await this.resolveRoles(input.roleKeys, actor);

    const user = await this.prisma.user.create({
      data: {
        organizationId: org.id,
        email,
        mobile: input.mobile || null,
        name: input.name.trim(),
        status: 'invited',
        createdById: actor.id,
        roles: { create: roles.map((r) => ({ roleId: r.id, grantedById: actor.id })) },
      },
      include: { roles: { include: { role: true } } },
    });
    await this.invitations.issue(user.id, actor.id);
    await this.audit.record({
      action: 'users.invited',
      resourceType: 'user',
      resourceId: user.id,
      after: { email, name: user.name, roles: input.roleKeys },
      summary: `Invited ${user.email}`,
    });
    // Awaited: the learner or trainer profile a role needs exists when the response goes back.
    await this.events.emitAsync('user.created', { userId: user.id });
    return toSummary(user);
  }

  async update(
    id: string,
    input: { name?: string; mobile?: string | null },
    actor: AuthUser,
  ): Promise<UserSummary> {
    const user = await this.find(id);
    await this.assertMayManage(user, actor);
    if (input.mobile) {
      const clash = await this.prisma.user.findFirst({
        where: { mobile: input.mobile, NOT: { id } },
      });
      if (clash) throw new ConflictError('Another account uses this mobile number', 'mobile_taken');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        mobile: input.mobile === undefined ? undefined : input.mobile || null,
      },
      include: { roles: { include: { role: true } } },
    });
    this.authContext.invalidate(id);
    await this.audit.record({
      action: 'users.updated',
      resourceType: 'user',
      resourceId: id,
      before: { name: user.name, mobile: user.mobile },
      after: { name: updated.name, mobile: updated.mobile },
    });
    return toSummary(updated);
  }

  async deactivate(id: string, reason: string, actor: AuthUser): Promise<void> {
    if (id === actor.id)
      throw new DomainRuleError('You cannot deactivate your own account', 'self_action');
    const user = await this.find(id);
    await this.assertMayManage(user, actor);
    if (user.status === 'deactivated') return;
    await this.assertNotLastSuperAdmin(user.id);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { status: 'deactivated', tokenVersion: { increment: 1 } },
      }),
      this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    this.authContext.invalidate(id);
    await this.audit.record({
      action: 'users.deactivated',
      resourceType: 'user',
      resourceId: id,
      before: { status: user.status },
      after: { status: 'deactivated', reason },
      summary: `Deactivated ${user.email}`,
    });
    // Awaited, so the account leaves its batches and courses before the request returns (Phase 5).
    await this.events.emitAsync('user.deactivated', { userId: id });
  }

  async reactivate(id: string, actor: AuthUser): Promise<void> {
    const user = await this.find(id);
    await this.assertMayManage(user, actor);
    if (user.status !== 'deactivated' && user.status !== 'suspended') return;
    const status = user.passwordHash ? 'active' : 'invited';
    await this.prisma.user.update({
      where: { id },
      data: { status, failedLoginCount: 0, lockedUntil: null },
    });
    this.authContext.invalidate(id);
    await this.audit.record({
      action: 'users.reactivated',
      resourceType: 'user',
      resourceId: id,
      before: { status: user.status },
      after: { status },
      summary: `Reactivated ${user.email}`,
    });
    // The places the deactivation ended, and the courses they gave, come back (Phase 5).
    await this.events.emitAsync('user.reactivated', { userId: id });
  }

  async setRoles(id: string, roleKeys: string[], actor: AuthUser): Promise<UserSummary> {
    const user = await this.find(id);
    // Changing one's own roles is how a privilege is taken rather than given.
    if (id === actor.id && !actor.roleKeys.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
      throw new ForbiddenError('You cannot change your own roles; ask another administrator');
    }
    await this.assertMayManage(user, actor);
    const roles = await this.resolveRoles(roleKeys, actor);
    const currentKeys = user.roles.map((r) => r.role.key);
    if (
      currentKeys.includes(SYSTEM_ROLES.SUPER_ADMIN) &&
      !roleKeys.includes(SYSTEM_ROLES.SUPER_ADMIN)
    ) {
      await this.assertNotLastSuperAdmin(user.id);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roles.map((r) => ({ userId: id, roleId: r.id, grantedById: actor.id })),
      });
      // Role changes end existing sessions (rule: forced logout on role change).
      return tx.user.update({
        where: { id },
        data: { tokenVersion: { increment: 1 } },
        include: { roles: { include: { role: true } } },
      });
    });
    this.authContext.invalidate(id);
    await this.audit.record({
      action: 'users.roles_changed',
      resourceType: 'user',
      resourceId: id,
      before: { roles: currentKeys },
      after: { roles: roleKeys },
      summary: `Roles of ${user.email} changed`,
    });
    await this.events.emitAsync('user.roles_changed', { userId: id, roleKeys });
    return toSummary(updated);
  }

  /** Lifts a lock left by too many wrong passwords; the next sign-in starts afresh. */
  async unlock(id: string, actor: AuthUser): Promise<UserSummary> {
    const user = await this.find(id);
    await this.assertMayManage(user, actor);
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    this.authContext.invalidate(id);
    await this.audit.record({
      action: 'users.unlocked',
      resourceType: 'user',
      resourceId: id,
      before: { lockedUntil: user.lockedUntil, failedLoginCount: user.failedLoginCount },
      summary: `Unlocked ${user.email}`,
      actorId: actor.id,
    });
    return this.get(id);
  }

  /** The devices a person is signed in on now. */
  async sessions(id: string, actor: AuthUser): Promise<SessionSummary[]> {
    const user = await this.find(id);
    await this.assertMayManage(user, actor);
    const rows = await this.prisma.session.findMany({
      where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      ip: s.ip,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
      expiresAt: s.expiresAt.toISOString(),
      current: false,
    }));
  }

  /** Ends one session, or (no id) every session of the person, as signing out everywhere does. */
  async endSessions(id: string, sessionId: string | null, actor: AuthUser): Promise<void> {
    const user = await this.find(id);
    await this.assertMayManage(user, actor);
    const now = new Date();
    if (sessionId) {
      const result = await this.prisma.session.updateMany({
        where: { id: sessionId, userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (result.count === 0) throw new NotFoundError('Session');
    } else {
      await this.prisma.$transaction([
        this.prisma.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: now },
        }),
        // An access token already handed out stops working too.
        this.prisma.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } }),
      ]);
      this.authContext.invalidate(id);
    }
    await this.audit.record({
      action: sessionId ? 'users.session_ended' : 'users.signed_out_everywhere',
      resourceType: 'user',
      resourceId: id,
      after: sessionId ? { sessionId } : undefined,
      summary: sessionId
        ? `A session of ${user.email} ended`
        : `${user.email} signed out everywhere`,
      actorId: actor.id,
    });
  }

  async resendInvitation(id: string, actor: AuthUser): Promise<{ expiresAt: string }> {
    const user = await this.find(id);
    await this.assertMayManage(user, actor);
    if (user.status !== 'invited')
      throw new ConflictError('Only invited accounts can receive a new invitation', 'not_invited');
    const result = await this.invitations.issue(id, actor.id);
    await this.audit.record({
      action: 'users.invitation_resent',
      resourceType: 'user',
      resourceId: id,
      summary: `Invitation resent to ${user.email}`,
    });
    return { expiresAt: result.expiresAt.toISOString() };
  }

  async updateOwnProfile(userId: string, input: { name?: string }): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { name: input.name?.trim() } });
    this.authContext.invalidate(userId);
    await this.audit.record({
      action: 'users.self_updated',
      resourceType: 'user',
      resourceId: userId,
      after: input,
    });
  }

  // ───────────── internals ─────────────

  private async find(id: string) {
    const org = await this.tenant.getOrganization();
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId: org.id, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundError('User');
    return user;
  }

  private async resolveRoles(roleKeys: string[], actor: AuthUser) {
    if (roleKeys.length === 0)
      throw new ValidationError([{ path: 'roleKeys', message: 'Assign at least one role' }]);
    const org = await this.tenant.getOrganization();
    const roles = await this.prisma.role.findMany({
      where: { organizationId: org.id, key: { in: roleKeys } },
    });
    const found = new Set(roles.map((r) => r.key));
    const missing = roleKeys.filter((k) => !found.has(k));
    if (missing.length)
      throw new ValidationError([
        { path: 'roleKeys', message: `Unknown roles: ${missing.join(', ')}` },
      ]);
    if (
      roleKeys.includes(SYSTEM_ROLES.SUPER_ADMIN) &&
      !actor.roleKeys.includes(SYSTEM_ROLES.SUPER_ADMIN)
    ) {
      throw new DomainRuleError(
        'Only a Super Admin can grant the Super Admin role',
        'super_admin_grant',
      );
    }
    await this.assertHoldsWhatTheyGrant(
      roles.map((r) => r.id),
      actor,
      'grant',
    );
    return roles;
  }

  /**
   * A Super Admin's account is changed only by a Super Admin, and anyone else's only by someone
   * who holds what that account holds: an administrator who could remove a role, or switch the
   * account off, would otherwise outrank the people who manage them.
   */
  private async assertMayManage(
    user: { roles: { role: { id: string; key: string } }[] },
    actor: AuthUser,
  ): Promise<void> {
    const targetIsSuperAdmin = user.roles.some((r) => r.role.key === SYSTEM_ROLES.SUPER_ADMIN);
    if (targetIsSuperAdmin && !actor.roleKeys.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
      throw new ForbiddenError('Only a Super Admin can change a Super Admin’s account');
    }
    await this.assertHoldsWhatTheyGrant(
      user.roles.map((r) => r.role.id),
      actor,
      'manage',
    );
  }

  /**
   * No privilege is handed out by someone who does not hold it: every permission the roles carry
   * must be the actor's own, at the same scope or wider. Grants over the holder's own records only
   * (a learner taking their own tests) are no privilege over anyone else and are not compared;
   * bundles keep each permission to the scopes the catalogue allows, so nothing institute-wide can
   * hide behind `own`.
   */
  private async assertHoldsWhatTheyGrant(
    roleIds: string[],
    actor: AuthUser,
    verb: 'grant' | 'manage',
  ): Promise<void> {
    if (actor.roleKeys.includes(SYSTEM_ROLES.SUPER_ADMIN) || roleIds.length === 0) return;
    const grants = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds }, scope: { not: 'own' } },
      select: { scope: true, permission: { select: { key: true } } },
    });
    const beyond = [
      ...new Set(
        grants
          .filter((g) => !holdsAtLeast(actor, g.permission.key, g.scope))
          .map((g) => `${g.permission.key} (${g.scope})`),
      ),
    ];
    if (beyond.length > 0) {
      throw new ForbiddenError(
        verb === 'grant'
          ? `You cannot grant a role that carries permissions you do not hold: ${beyond.slice(0, 5).join(', ')}`
          : `You cannot change this account: it holds permissions you do not hold: ${beyond.slice(0, 5).join(', ')}`,
      );
    }
  }

  private async assertNotLastSuperAdmin(userId: string): Promise<void> {
    const org = await this.tenant.getOrganization();
    const others = await this.prisma.user.count({
      where: {
        organizationId: org.id,
        deletedAt: null,
        status: 'active',
        NOT: { id: userId },
        roles: { some: { role: { key: SYSTEM_ROLES.SUPER_ADMIN } } },
      },
    });
    if (others === 0)
      throw new DomainRuleError('At least one active Super Admin must remain', 'last_super_admin');
  }
}

function toSummary(user: {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  status: 'invited' | 'active' | 'suspended' | 'deactivated';
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
  createdAt: Date;
  roles: { role: { key: string; name: string } }[];
}): UserSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    status: user.status,
    roles: user.roles.map((r) => ({ key: r.role.key, name: r.role.name })),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    lockedUntil:
      user.lockedUntil && user.lockedUntil > new Date() ? user.lockedUntil.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}
