import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type Paginated,
  SYSTEM_ROLES,
  type TrainerCreateInput,
  type TrainerDetail,
  type TrainerSummary,
  type TrainerUpdateInput,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, scopeFor } from '../../core/auth/auth-user.js';
import { ConflictError, DomainRuleError, NotFoundError } from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { InvitationService } from '../auth/invitation.service.js';

interface ListQuery {
  page: number;
  pageSize: number;
  q?: string;
  subject?: string;
  status?: 'invited' | 'active' | 'suspended' | 'deactivated';
}

@Injectable()
export class TrainersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly scope: ScopeService,
    private readonly invitations: InvitationService,
  ) {}

  async list(query: ListQuery, user: AuthUser): Promise<Paginated<TrainerSummary>> {
    const org = await this.tenant.getOrganization();
    // `trainers:read` at scope `own` means a trainer sees only their own record.
    const ownOnly = scopeFor(user, 'trainers:read') === 'own';
    const person = ownOnly ? await this.scope.personFor(user.id) : null;
    const where = {
      user: {
        organizationId: org.id,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
      },
      ...(ownOnly ? { id: person?.trainerId ?? '00000000-0000-0000-0000-000000000000' } : {}),
      ...(query.subject ? { subjects: { has: query.subject } } : {}),
      ...(query.q
        ? {
            OR: [
              { user: { name: { contains: query.q, mode: 'insensitive' as const } } },
              { user: { email: { contains: query.q, mode: 'insensitive' as const } } },
              { headline: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.trainerProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
        include: { user: true, _count: { select: { assignments: true } } },
      }),
      this.prisma.trainerProfile.count({ where }),
    ]);
    return paginate(rows.map(toSummary), total, query);
  }

  async get(id: string, user: AuthUser): Promise<TrainerDetail> {
    const trainer = await this.find(id, user);
    const assignments = await this.prisma.batchTrainer.findMany({
      where: { trainerId: trainer.id },
      include: { batch: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      ...toSummary(trainer),
      bio: trainer.bio,
      assignments: assignments.map((a) => ({
        batchId: a.batchId,
        batchCode: a.batch.code,
        batchName: a.batch.name,
        subject: a.subject,
        role: a.role,
        batchStatus: a.batch.status,
      })),
    };
  }

  async create(input: TrainerCreateInput, actor: AuthUser): Promise<TrainerSummary> {
    const org = await this.tenant.getOrganization();
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email },
      include: { trainerProfile: true },
    });
    if (existing?.trainerProfile) {
      throw new ConflictError('This person is already a trainer', 'trainer_exists');
    }
    if (existing) {
      throw new ConflictError('An account with this email already exists', 'email_taken');
    }
    if (input.mobile) {
      const clash = await this.prisma.user.findFirst({ where: { mobile: input.mobile } });
      if (clash) throw new ConflictError('Another account uses this mobile number', 'mobile_taken');
    }
    const role = await this.prisma.role.findUnique({
      where: { organizationId_key: { organizationId: org.id, key: SYSTEM_ROLES.TRAINER } },
    });
    if (!role)
      throw new DomainRuleError('The trainer role is missing; run the base seed', 'role_missing');

    const trainer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: org.id,
          email,
          mobile: input.mobile || null,
          name: input.name.trim(),
          status: 'invited',
          createdById: actor.id,
          roles: { create: [{ roleId: role.id, grantedById: actor.id }] },
        },
      });
      const profile = await tx.trainerProfile.create({
        data: {
          userId: created.id,
          subjects: input.subjects,
          headline: input.headline,
          bio: input.bio,
        },
      });
      return tx.trainerProfile.findUniqueOrThrow({
        where: { id: profile.id },
        include: { user: true, _count: { select: { assignments: true } } },
      });
    });

    if (input.sendInvitation) await this.invitations.issue(trainer.userId, actor.id);
    await this.audit.record({
      action: 'trainers.created',
      resourceType: 'trainer',
      resourceId: trainer.id,
      after: { email, name: input.name, subjects: input.subjects },
      summary: `Trainer ${email} created`,
    });
    this.events.emit('trainer.created', { trainerId: trainer.id, userId: trainer.userId });
    return toSummary(trainer);
  }

  async update(id: string, patch: TrainerUpdateInput, user: AuthUser): Promise<TrainerDetail> {
    const trainer = await this.find(id, user);
    if (patch.mobile) {
      const clash = await this.prisma.user.findFirst({
        where: { mobile: patch.mobile, NOT: { id: trainer.userId } },
      });
      if (clash) throw new ConflictError('Another account uses this mobile number', 'mobile_taken');
    }
    const before = {
      name: trainer.user.name,
      mobile: trainer.user.mobile,
      subjects: trainer.subjects,
      headline: trainer.headline,
      bio: trainer.bio,
    };
    await this.prisma.$transaction(async (tx) => {
      if (patch.name !== undefined || patch.mobile !== undefined) {
        await tx.user.update({
          where: { id: trainer.userId },
          data: {
            name: patch.name?.trim(),
            mobile: patch.mobile === undefined ? undefined : patch.mobile || null,
          },
        });
      }
      await tx.trainerProfile.update({
        where: { id },
        data: { subjects: patch.subjects, headline: patch.headline, bio: patch.bio },
      });
    });
    await this.audit.record({
      action: 'trainers.updated',
      resourceType: 'trainer',
      resourceId: id,
      before,
      after: { ...before, ...patch },
      summary: `Trainer ${trainer.user.email} updated`,
    });
    this.events.emit('trainer.updated', { trainerId: id });
    return this.get(id, user);
  }

  /** Subjects used across trainers, for filter dropdowns and batch assignment. */
  async subjects(): Promise<string[]> {
    const rows = await this.prisma.trainerProfile.findMany({ select: { subjects: true } });
    return [...new Set(rows.flatMap((r) => r.subjects))].sort((a, b) => a.localeCompare(b));
  }

  async find(id: string, user: AuthUser) {
    const org = await this.tenant.getOrganization();
    const trainer = await this.prisma.trainerProfile.findFirst({
      where: { id, user: { organizationId: org.id, deletedAt: null } },
      include: { user: true, _count: { select: { assignments: true } } },
    });
    if (!trainer) throw new NotFoundError('Trainer');
    if (scopeFor(user, 'trainers:read') === 'own') {
      const person = await this.scope.personFor(user.id);
      if (person.trainerId !== trainer.id) throw new NotFoundError('Trainer');
    }
    return trainer;
  }
}

function toSummary(trainer: {
  id: string;
  userId: string;
  subjects: string[];
  headline: string;
  createdAt: Date;
  user: {
    name: string;
    email: string;
    mobile: string | null;
    status: 'invited' | 'active' | 'suspended' | 'deactivated';
  };
  _count: { assignments: number };
}): TrainerSummary {
  return {
    id: trainer.id,
    userId: trainer.userId,
    name: trainer.user.name,
    email: trainer.user.email,
    mobile: trainer.user.mobile,
    subjects: trainer.subjects,
    headline: trainer.headline,
    accountStatus: trainer.user.status,
    batchCount: trainer._count.assignments,
    createdAt: trainer.createdAt.toISOString(),
  };
}
