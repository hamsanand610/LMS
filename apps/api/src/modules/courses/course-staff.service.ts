import { Injectable } from '@nestjs/common';
import type { CourseStaffMember } from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { NotFoundError, ValidationError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

/**
 * Course staff (ADR-0023): the trainers an administrator puts in charge of a course's content.
 * They change its details and outline, publish it to the batches they teach, and see it whole.
 */
@Injectable()
export class CourseStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly scope: ScopeService,
  ) {}

  /** Whether the caller is on the course's staff. */
  async isStaff(courseId: string, user: AuthUser): Promise<boolean> {
    const person = await this.scope.personFor(user.id);
    if (!person.trainerId) return false;
    const row = await this.prisma.courseStaff.findUnique({
      where: { courseId_trainerId: { courseId, trainerId: person.trainerId } },
      select: { courseId: true },
    });
    return row !== null;
  }

  /** The courses the caller is staff of. */
  async courseIdsOf(user: AuthUser): Promise<string[]> {
    const person = await this.scope.personFor(user.id);
    if (!person.trainerId) return [];
    const rows = await this.prisma.courseStaff.findMany({
      where: { trainerId: person.trainerId },
      select: { courseId: true },
    });
    return rows.map((row) => row.courseId);
  }

  async list(courseId: string): Promise<CourseStaffMember[]> {
    const rows = await this.prisma.courseStaff.findMany({
      where: { courseId },
      orderBy: { assignedAt: 'asc' },
      select: { trainerId: true, trainer: { select: { user: { select: { name: true } } } } },
    });
    return rows.map((row) => ({ trainerId: row.trainerId, name: row.trainer.user.name }));
  }

  /** Replaces a course's staff with trainers of this institute; recorded in the audit log. */
  async set(courseId: string, trainerIds: string[], actor: AuthUser): Promise<CourseStaffMember[]> {
    const org = await this.tenant.getOrganization();
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, organizationId: org.id, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!course) throw new NotFoundError('Course');
    const wanted = [...new Set(trainerIds)];
    const found = await this.prisma.trainerProfile.count({
      where: { id: { in: wanted }, user: { organizationId: org.id, deletedAt: null } },
    });
    if (found !== wanted.length) {
      throw new ValidationError([
        { path: 'trainerIds', message: 'Some of those trainers were not found' },
      ]);
    }

    const before = await this.list(courseId);
    await this.prisma.$transaction([
      this.prisma.courseStaff.deleteMany({ where: { courseId, trainerId: { notIn: wanted } } }),
      this.prisma.courseStaff.createMany({
        data: wanted.map((trainerId) => ({ courseId, trainerId, assignedById: actor.id })),
        skipDuplicates: true,
      }),
    ]);
    const after = await this.list(courseId);
    await this.audit.record({
      action: 'course.staff_changed',
      resourceType: 'course',
      resourceId: courseId,
      summary: `Staff of ${course.title}: ${after.map((s) => s.name).join(', ') || 'nobody'}`,
      before: before.map((s) => s.trainerId),
      after: after.map((s) => s.trainerId),
      actorId: actor.id,
    });
    return after;
  }
}
