import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  BATCH_STATUS_TRANSITIONS,
  type BatchCreateInput,
  type BatchDetail,
  type BatchMemberRow,
  type BatchStatus,
  type BatchSummary,
  type BatchUpdateInput,
  type Paginated,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { type AuthUser, hasPermission } from '../../core/auth/auth-user.js';
import {
  ConflictError,
  DomainRuleError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { NotificationsService } from '../notifications/index.js';
import { CustomFieldsService } from '../settings/custom-fields.service.js';

interface ListQuery {
  page: number;
  pageSize: number;
  q?: string;
  programId?: string;
  status?: BatchStatus;
  trainerId?: string;
  mode?: 'online' | 'offline' | 'hybrid';
}

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly scope: ScopeService,
    private readonly notifications: NotificationsService,
    private readonly customFields: CustomFieldsService,
  ) {}

  async list(query: ListQuery, user: AuthUser): Promise<Paginated<BatchSummary>> {
    const org = await this.tenant.getOrganization();
    const visible = await this.scope.visibleBatchIds(user, 'batches:read');
    const where = {
      organizationId: org.id,
      deletedAt: null,
      ...(visible === null ? {} : { id: { in: visible } }),
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.trainerId ? { trainers: { some: { trainerId: query.trainerId } } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { code: { contains: query.q.toUpperCase() } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.batch.findMany({
        where,
        orderBy: [{ startDate: 'desc' }],
        ...skipTake(query),
        include: {
          program: true,
          _count: { select: { trainers: true, members: { where: { isActive: true } } } },
        },
      }),
      this.prisma.batch.count({ where }),
    ]);
    return paginate(rows.map(toSummary), total, query);
  }

  async get(id: string, user: AuthUser): Promise<BatchDetail> {
    const batch = await this.find(id, user);
    const trainers = await this.prisma.batchTrainer.findMany({
      where: { batchId: id },
      include: { trainer: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { subject: 'asc' },
    });
    const canManage = hasPermission(user, 'batches:manage');
    return {
      ...toSummary(batch),
      custom: (batch.custom as Record<string, unknown>) ?? {},
      trainers: trainers.map((t) => ({
        trainerId: t.trainerId,
        userId: t.trainer.user.id,
        name: t.trainer.user.name,
        subject: t.subject,
        role: t.role,
      })),
      allowedTransitions: canManage ? [...BATCH_STATUS_TRANSITIONS[batch.status]] : [],
    };
  }

  /** J-02 step 1: create the cohort. */
  async create(input: BatchCreateInput, actor: AuthUser): Promise<BatchSummary> {
    const org = await this.tenant.getOrganization();
    const program = await this.prisma.program.findFirst({
      where: { id: input.programId, organizationId: org.id, deletedAt: null },
    });
    if (!program) {
      throw new ValidationError([{ path: 'programId', message: 'That programme does not exist' }]);
    }
    if (program.status === 'archived') {
      throw new DomainRuleError('That programme is archived', 'program_archived');
    }
    const existing = await this.prisma.batch.findUnique({ where: { code: input.code } });
    if (existing)
      throw new ConflictError(`A batch with code ${input.code} already exists`, 'code_taken');
    const custom = await this.customFields.validateValues('batch', input.custom);

    const row = await this.prisma.batch.create({
      data: {
        organizationId: org.id,
        programId: input.programId,
        code: input.code,
        name: input.name,
        mode: input.mode,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        capacity: input.capacity,
        custom: asJson(custom),
        createdById: actor.id,
      },
      include: {
        program: true,
        _count: { select: { trainers: true, members: { where: { isActive: true } } } },
      },
    });
    await this.audit.record({
      action: 'batches.created',
      resourceType: 'batch',
      resourceId: row.id,
      after: { code: input.code, name: input.name, programId: input.programId },
      summary: `Batch ${input.code} created`,
    });
    this.events.emit('batch.created', { batchId: row.id });
    return toSummary(row);
  }

  async update(id: string, patch: BatchUpdateInput, user: AuthUser): Promise<BatchDetail> {
    const batch = await this.find(id, user);
    const startDate = patch.startDate ? new Date(patch.startDate) : batch.startDate;
    const endDate = patch.endDate ? new Date(patch.endDate) : batch.endDate;
    if (endDate < startDate) {
      throw new ValidationError([
        { path: 'endDate', message: 'The end date must not be before the start date' },
      ]);
    }
    if (patch.capacity !== undefined) {
      const active = await this.prisma.batchMember.count({
        where: { batchId: id, isActive: true },
      });
      if (patch.capacity < active) {
        throw new DomainRuleError(
          `The batch already has ${active} students; capacity cannot be lower`,
          'capacity_below_roster',
        );
      }
    }
    const custom =
      patch.custom === undefined
        ? undefined
        : await this.customFields.validateValues('batch', patch.custom);
    await this.prisma.batch.update({
      where: { id },
      data: {
        name: patch.name,
        mode: patch.mode,
        startDate,
        endDate,
        capacity: patch.capacity,
        custom: custom === undefined ? undefined : asJson(custom),
      },
    });
    await this.audit.record({
      action: 'batches.updated',
      resourceType: 'batch',
      resourceId: id,
      before: {
        name: batch.name,
        mode: batch.mode,
        startDate: batch.startDate,
        endDate: batch.endDate,
        capacity: batch.capacity,
      },
      after: patch,
      summary: `Batch ${batch.code} updated`,
    });
    return this.get(id, user);
  }

  /** J-02 final step: moving to `running` tells the members their batch has started. */
  async setStatus(
    id: string,
    status: BatchStatus,
    reason: string,
    user: AuthUser,
  ): Promise<BatchDetail> {
    const batch = await this.find(id, user);
    const allowed = BATCH_STATUS_TRANSITIONS[batch.status];
    if (batch.status !== status && !allowed.includes(status)) {
      throw new ConflictError(
        `A batch cannot move from ${batch.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`,
        'invalid_transition',
      );
    }
    if (status === 'running') {
      const members = await this.prisma.batchMember.count({
        where: { batchId: id, isActive: true },
      });
      if (members === 0) {
        throw new DomainRuleError(
          'Add at least one student before starting the batch',
          'batch_empty',
        );
      }
    }
    await this.prisma.batch.update({ where: { id }, data: { status } });
    await this.audit.record({
      action: 'batches.status_changed',
      resourceType: 'batch',
      resourceId: id,
      before: { status: batch.status },
      after: { status, reason },
      summary: `Batch ${batch.code} moved to ${status}`,
    });
    this.events.emit('batch.status_changed', { batchId: id, status });

    if (status === 'running' && batch.status !== 'running') {
      await this.notifications.deliver({
        category: 'batch',
        type: 'batch.started',
        title: `${batch.name} has started`,
        body: `Your batch ${batch.code} is now running. Your schedule and course material appear here as your trainers publish them.`,
        link: '/dashboard',
        channels: ['in_app', 'email'],
        audience: { roleKeys: [], batchIds: [id], programIds: [] },
      });
    }
    return this.get(id, user);
  }

  // ───────────────────────── roster ─────────────────────────

  async members(
    id: string,
    query: { page: number; pageSize: number; q?: string; includeInactive?: boolean },
    user: AuthUser,
  ): Promise<Paginated<BatchMemberRow>> {
    await this.find(id, user);
    const where = {
      batchId: id,
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.q
        ? {
            student: {
              OR: [
                { studentCode: { contains: query.q, mode: 'insensitive' as const } },
                { user: { name: { contains: query.q, mode: 'insensitive' as const } } },
              ],
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.batchMember.findMany({
        where,
        orderBy: { joinedAt: 'desc' },
        ...skipTake(query),
        include: { student: { include: { user: true } } },
      }),
      this.prisma.batchMember.count({ where }),
    ]);
    return paginate(
      rows.map((m) => ({
        studentId: m.studentId,
        studentCode: m.student.studentCode,
        name: m.student.user.name,
        email: m.student.user.email,
        status: m.student.status,
        joinedAt: m.joinedAt.toISOString(),
        leftAt: m.leftAt?.toISOString() ?? null,
        isActive: m.isActive,
      })),
      total,
      query,
    );
  }

  async addMembers(id: string, studentIds: string[], user: AuthUser): Promise<{ added: number }> {
    const batch = await this.find(id, user);
    const wanted = [...new Set(studentIds)];
    const students = await this.prisma.studentProfile.count({ where: { id: { in: wanted } } });
    if (students !== wanted.length) {
      throw new ValidationError([
        { path: 'studentIds', message: 'One or more students do not exist' },
      ]);
    }
    const added = await this.prisma.$transaction((tx) =>
      this.insertMembers(tx, batch, wanted, user.id),
    );
    await this.membersJoined(batch, added);
    return { added: added.length };
  }

  /**
   * Adds students to a batch inside the caller's transaction, with every membership rule: the
   * batch is open (not completed or archived), it has room (its row is locked, so two additions
   * at once cannot both take the last place), and nobody is added twice. Returns who was added;
   * `membersJoined` follows once the transaction has committed.
   */
  async insertMembers(
    tx: Prisma.TransactionClient,
    batch: { id: string; capacity: number; status: string },
    studentIds: string[],
    actorId: string,
  ): Promise<string[]> {
    if (batch.status === 'completed' || batch.status === 'archived') {
      throw new DomainRuleError('Students join only a planned or running batch', 'batch_closed');
    }
    await tx.$executeRaw`SELECT 1 FROM batches WHERE id = ${batch.id}::uuid FOR UPDATE`;
    const active = await tx.batchMember.findMany({
      where: { batchId: batch.id, isActive: true },
      select: { studentId: true },
    });
    const already = new Set(active.map((member) => member.studentId));
    const toAdd = [...new Set(studentIds)].filter((studentId) => !already.has(studentId));
    if (toAdd.length === 0) return [];
    if (active.length + toAdd.length > batch.capacity) {
      throw new DomainRuleError(
        `The batch holds ${batch.capacity} students; ${active.length} are enrolled and you are adding ${toAdd.length}`,
        'capacity_exceeded',
      );
    }
    await tx.batchMember.createMany({
      data: toAdd.map((studentId) => ({ batchId: batch.id, studentId, addedById: actorId })),
    });
    return toAdd;
  }

  /**
   * What follows students joining a batch, once it is committed: the audit entry, their
   * enrolments in the batch's courses (by event), fresh scope and, in a running batch, a notice.
   */
  async membersJoined(
    batch: { id: string; code: string; name: string; status: string },
    studentIds: string[],
    audited = true,
  ): Promise<void> {
    if (studentIds.length === 0) return;
    if (audited) {
      await this.audit.record({
        action: 'batches.members_added',
        resourceType: 'batch',
        resourceId: batch.id,
        after: { studentIds },
        summary: `${studentIds.length} student(s) added to ${batch.code}`,
      });
    }
    this.events.emit('batch.members_changed', { batchId: batch.id, added: studentIds.length });
    this.scope.invalidateAll();
    if (batch.status === 'running') {
      const students = await this.prisma.studentProfile.findMany({
        where: { id: { in: studentIds } },
        select: { userId: true },
      });
      await this.notifications.deliver({
        category: 'batch',
        type: 'batch.joined',
        title: `You joined ${batch.name}`,
        body: `You are now part of batch ${batch.code}.`,
        link: '/dashboard',
        channels: ['in_app'],
        userIds: students.map((s) => s.userId),
      });
    }
  }

  /**
   * Someone who is no longer a learner leaves the batches they learnt in (Phase 5): the learner
   * record stays, but rosters, roll calls and batch notices stop counting them, and the courses the
   * batches gave them are withdrawn (D4), as when an administrator removes them. A role that still
   * lets them hand in work (`assignments:submit`) keeps them in.
   */
  @OnEvent('user.roles_changed')
  async onRolesChanged(payload: { userId: string }): Promise<void> {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: payload.userId },
      select: { id: true },
    });
    if (!profile) return;
    const stillLearns = await this.prisma.rolePermission.count({
      where: {
        permission: { key: 'assignments:submit' },
        role: { users: { some: { userId: payload.userId } } },
      },
    });
    if (stillLearns > 0) return;
    const places = await this.prisma.batchMember.findMany({
      where: { studentId: profile.id, isActive: true },
      select: { id: true, batchId: true, batch: { select: { code: true } } },
    });
    if (places.length === 0) return;
    const reason = 'No longer a learner: the learner role was removed';
    await this.prisma.batchMember.updateMany({
      where: { id: { in: places.map((place) => place.id) } },
      data: { isActive: false, leftAt: new Date(), reason },
    });
    for (const place of places) {
      await this.audit.record({
        action: 'batches.member_removed',
        resourceType: 'batch',
        resourceId: place.batchId,
        before: { studentId: profile.id },
        after: { reason },
        summary: `Student left ${place.batch.code}: the learner role was removed`,
      });
      this.events.emit('batch.members_changed', {
        batchId: place.batchId,
        removed: 1,
        studentIds: [profile.id],
      });
    }
    this.scope.invalidateAll();
  }

  async removeMember(id: string, studentId: string, reason: string, user: AuthUser): Promise<void> {
    const batch = await this.find(id, user);
    const member = await this.prisma.batchMember.findFirst({
      where: { batchId: id, studentId, isActive: true },
    });
    if (!member) throw new NotFoundError('Batch member');
    await this.prisma.batchMember.update({
      where: { id: member.id },
      data: { isActive: false, leftAt: new Date(), reason },
    });
    await this.audit.record({
      action: 'batches.member_removed',
      resourceType: 'batch',
      resourceId: id,
      before: { studentId },
      after: { reason },
      summary: `Student removed from ${batch.code}`,
    });
    this.events.emit('batch.members_changed', { batchId: id, removed: 1, studentIds: [studentId] });
    this.scope.invalidateAll();
  }

  async transferMember(
    id: string,
    input: { studentId: string; toBatchId: string; reason: string },
    user: AuthUser,
  ): Promise<void> {
    const from = await this.find(id, user);
    const to = await this.find(input.toBatchId, user);
    if (from.id === to.id) {
      throw new DomainRuleError('Choose another batch to move the student to', 'invalid_target');
    }
    if (to.status === 'completed' || to.status === 'archived') {
      throw new DomainRuleError('Transfer only into a planned or running batch', 'invalid_target');
    }
    const member = await this.prisma.batchMember.findFirst({
      where: { batchId: id, studentId: input.studentId, isActive: true },
    });
    if (!member) throw new NotFoundError('Batch member');
    // One transaction: a full target leaves the student where they were, never in no batch.
    await this.prisma.$transaction(async (tx) => {
      await tx.batchMember.update({
        where: { id: member.id },
        data: {
          isActive: false,
          leftAt: new Date(),
          reason: input.reason || `Transferred to ${to.code}`,
        },
      });
      const added = await this.insertMembers(tx, to, [input.studentId], user.id);
      if (added.length === 0) {
        throw new DomainRuleError('The student is already in that batch', 'already_member');
      }
    });
    this.events.emit('batch.members_changed', {
      batchId: id,
      removed: 1,
      studentIds: [input.studentId],
    });
    await this.membersJoined(to, [input.studentId], false);
    await this.audit.record({
      action: 'batches.member_transferred',
      resourceType: 'batch',
      resourceId: id,
      after: { studentId: input.studentId, from: from.code, to: to.code, reason: input.reason },
      summary: `Student transferred from ${from.code} to ${to.code}`,
    });
  }

  /** J-02 step 3: replace the trainer assignments of a batch. */
  async setTrainers(
    id: string,
    assignments: { trainerId: string; subject: string; role: string }[],
    user: AuthUser,
  ): Promise<BatchDetail> {
    const batch = await this.find(id, user);
    const trainerIds = [...new Set(assignments.map((a) => a.trainerId))];
    if (trainerIds.length > 0) {
      const found = await this.prisma.trainerProfile.count({ where: { id: { in: trainerIds } } });
      if (found !== trainerIds.length) {
        throw new ValidationError([
          { path: 'assignments', message: 'One or more trainers do not exist' },
        ]);
      }
    }
    const seen = new Set<string>();
    for (const assignment of assignments) {
      const key = `${assignment.trainerId}:${assignment.subject.toLowerCase()}`;
      if (seen.has(key)) {
        throw new ConflictError(
          `${assignment.subject} is assigned twice to the same trainer`,
          'duplicate_assignment',
        );
      }
      seen.add(key);
    }
    const before = await this.prisma.batchTrainer.findMany({ where: { batchId: id } });
    await this.prisma.$transaction(async (tx) => {
      await tx.batchTrainer.deleteMany({ where: { batchId: id } });
      if (assignments.length > 0) {
        await tx.batchTrainer.createMany({
          data: assignments.map((a) => ({
            batchId: id,
            trainerId: a.trainerId,
            subject: a.subject,
            role: a.role,
          })),
        });
      }
    });
    await this.audit.record({
      action: 'batches.trainers_changed',
      resourceType: 'batch',
      resourceId: id,
      before: before.map((b) => ({ trainerId: b.trainerId, subject: b.subject, role: b.role })),
      after: assignments,
      summary: `Trainer assignments of ${batch.code} updated`,
    });
    this.scope.invalidateAll();
    return this.get(id, user);
  }

  /** Students not yet in this batch, for the "add members" dialog. */
  async candidates(id: string, q: string | undefined, user: AuthUser) {
    await this.find(id, user);
    const members = await this.prisma.batchMember.findMany({
      where: { batchId: id, isActive: true },
      select: { studentId: true },
    });
    const rows = await this.prisma.studentProfile.findMany({
      where: {
        id: { notIn: members.map((m) => m.studentId) },
        user: { deletedAt: null },
        ...(q
          ? {
              OR: [
                { studentCode: { contains: q, mode: 'insensitive' as const } },
                { user: { name: { contains: q, mode: 'insensitive' as const } } },
                { user: { email: { contains: q, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: {
        user: { select: { name: true, email: true } },
        members: { where: { isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    return rows.map((s) => ({
      id: s.id,
      studentCode: s.studentCode,
      name: s.user.name,
      email: s.user.email,
      status: s.status,
      otherBatches: s.members.length,
    }));
  }

  async find(id: string, user: AuthUser) {
    const org = await this.tenant.getOrganization();
    const batch = await this.prisma.batch.findFirst({
      where: { id, organizationId: org.id, deletedAt: null },
      include: {
        program: true,
        _count: { select: { trainers: true, members: { where: { isActive: true } } } },
      },
    });
    if (!batch) throw new NotFoundError('Batch');
    const visible = await this.scope.visibleBatchIds(user, 'batches:read');
    if (visible !== null && !visible.includes(batch.id)) throw new NotFoundError('Batch');
    return batch;
  }
}

function toSummary(batch: {
  id: string;
  code: string;
  name: string;
  mode: string;
  status: string;
  startDate: Date;
  endDate: Date;
  capacity: number;
  createdAt: Date;
  program: { id: string; code: string; name: string };
  _count: { trainers: number; members: number };
}): BatchSummary {
  return {
    id: batch.id,
    code: batch.code,
    name: batch.name,
    mode: batch.mode as BatchSummary['mode'],
    status: batch.status as BatchStatus,
    startDate: batch.startDate.toISOString().slice(0, 10),
    endDate: batch.endDate.toISOString().slice(0, 10),
    capacity: batch.capacity,
    program: { id: batch.program.id, code: batch.program.code, name: batch.program.name },
    studentCount: batch._count.members,
    trainerCount: batch._count.trainers,
    createdAt: batch.createdAt.toISOString(),
  };
}
