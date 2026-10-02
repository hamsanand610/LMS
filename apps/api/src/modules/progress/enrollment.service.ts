import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

/**
 * Enrolments are derived, never entered by hand: publishing a course to a scope enrols every
 * student in that scope, and a student joining a batch is enrolled in what that batch already has.
 * Everything else in the platform reads enrolments, so this is the only place that writes them.
 */
@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  /** Enrols everyone a publication reaches. Returns how many rows were added. */
  async syncPublication(
    courseId: string,
    scopeType: string,
    scopeId: string | null,
  ): Promise<number> {
    const studentIds = await this.studentsInScope(scopeType, scopeId);
    if (studentIds.length === 0) return 0;
    const existing = await this.prisma.enrollment.findMany({
      where: { courseId, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    const already = new Set(existing.map((e) => e.studentId));
    const toAdd = studentIds.filter((id) => !already.has(id));
    if (toAdd.length === 0) return 0;
    await this.prisma.enrollment.createMany({
      data: toAdd.map((studentId) => ({ studentId, courseId, source: scopeType })),
    });
    this.logger.log({ courseId, scopeType, scopeId, added: toAdd.length }, 'Enrolments derived');
    return toAdd.length;
  }

  /**
   * Removes the enrolments a withdrawn publication no longer justifies. A learner who has already
   * started keeps their row, so their progress is not thrown away by a content decision.
   */
  async syncUnpublication(courseId: string): Promise<number> {
    const reachable = new Set(await this.studentsWithAccess(courseId));
    const enrolments = await this.prisma.enrollment.findMany({
      where: { courseId },
      select: { id: true, studentId: true, progressPct: true },
    });
    const removable = enrolments.filter((e) => !reachable.has(e.studentId) && e.progressPct === 0);
    if (removable.length === 0) return 0;
    await this.prisma.enrollment.deleteMany({ where: { id: { in: removable.map((e) => e.id) } } });
    return removable.length;
  }

  /**
   * Enrols one student in everything currently published to them, and gives back any course they
   * had been withdrawn from that reaches them again.
   */
  async syncStudent(studentId: string): Promise<number> {
    const publications = await this.publicationsReaching(studentId);
    if (publications.length === 0) return 0;

    const returning = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        status: 'withdrawn',
        courseId: { in: publications.map((p) => p.courseId) },
      },
      select: { id: true, completedAt: true },
    });
    for (const enrolment of returning) {
      await this.prisma.enrollment.update({
        where: { id: enrolment.id },
        data: { status: enrolment.completedAt ? 'completed' : 'active' },
      });
    }

    const existing = await this.prisma.enrollment.findMany({
      where: { studentId, courseId: { in: publications.map((p) => p.courseId) } },
      select: { courseId: true },
    });
    const already = new Set(existing.map((e) => e.courseId));
    const toAdd = publications.filter((p) => !already.has(p.courseId));
    if (toAdd.length === 0) return 0;
    await this.prisma.enrollment.createMany({
      data: toAdd.map((p) => ({ studentId, courseId: p.courseId, source: p.scopeType })),
      skipDuplicates: true,
    });
    return toAdd.length;
  }

  /**
   * A learner who leaves a batch loses the courses that reached them only through it: ADR-0010's
   * remedy ("move the learner's batch") made real. The enrolment stays, as `withdrawn`, so the record
   * is kept, and `syncStudent` restores it if a publication reaches them again.
   */
  async withdrawUncovered(studentId: string): Promise<number> {
    const covered = new Set((await this.publicationsReaching(studentId)).map((p) => p.courseId));
    const open = await this.prisma.enrollment.findMany({
      where: { studentId, status: { in: ['active', 'completed'] } },
      select: { id: true, courseId: true },
    });
    const leaving = open.filter((enrolment) => !covered.has(enrolment.courseId));
    if (leaving.length > 0) {
      await this.prisma.enrollment.updateMany({
        where: { id: { in: leaving.map((e) => e.id) } },
        data: { status: 'withdrawn' },
      });
    }
    // A transfer adds the learner to their next batch straight after; checking again here settles
    // the outcome whichever of the two handlers finishes last.
    await this.syncStudent(studentId);
    return leaving.length;
  }

  /** The live publications of published courses that reach a student through their batches. */
  private async publicationsReaching(
    studentId: string,
  ): Promise<{ courseId: string; scopeType: string }[]> {
    const org = await this.tenant.getOrganization();
    const batches = await this.prisma.batchMember.findMany({
      where: { studentId, isActive: true },
      select: { batchId: true, batch: { select: { programId: true } } },
    });
    const batchIds = batches.map((b) => b.batchId);
    const programIds = [...new Set(batches.map((b) => b.batch.programId))];
    return this.prisma.coursePublication.findMany({
      where: {
        unpublishedAt: null,
        course: { organizationId: org.id, deletedAt: null, status: 'published' },
        OR: [
          { scopeType: 'all' },
          { scopeType: 'batch', scopeId: { in: batchIds } },
          { scopeType: 'program', scopeId: { in: programIds } },
          { scopeType: 'learner', scopeId: studentId },
        ],
      },
      select: { courseId: true, scopeType: true },
    });
  }

  /** Student ids a publication scope covers. */
  async studentsInScope(scopeType: string, scopeId: string | null): Promise<string[]> {
    const org = await this.tenant.getOrganization();
    if (scopeType === 'all') {
      const rows = await this.prisma.studentProfile.findMany({
        where: { user: { organizationId: org.id, deletedAt: null } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    if (scopeType === 'learner') {
      const learner = await this.prisma.studentProfile.findFirst({
        where: { id: scopeId ?? '', user: { organizationId: org.id, deletedAt: null } },
        select: { id: true },
      });
      return learner ? [learner.id] : [];
    }
    const where =
      scopeType === 'batch'
        ? { batchId: scopeId ?? '', isActive: true }
        : { isActive: true, batch: { programId: scopeId ?? '' } };
    const members = await this.prisma.batchMember.findMany({ where, select: { studentId: true } });
    return [...new Set(members.map((m) => m.studentId))];
  }

  /** Students any live publication of a course reaches. */
  async studentsWithAccess(courseId: string): Promise<string[]> {
    const publications = await this.prisma.coursePublication.findMany({
      where: { courseId, unpublishedAt: null },
      select: { scopeType: true, scopeId: true },
    });
    const ids = new Set<string>();
    for (const publication of publications) {
      for (const id of await this.studentsInScope(publication.scopeType, publication.scopeId)) {
        ids.add(id);
      }
    }
    return [...ids];
  }

  /**
   * A student added to a batch picks up whatever that batch already has; a student removed from one
   * loses what reached them only through it.
   */
  @OnEvent('batch.members_changed')
  async onBatchMembersChanged(payload: {
    batchId: string;
    added?: number;
    removed?: number;
    studentIds?: string[];
  }): Promise<void> {
    if (payload.removed) {
      for (const studentId of payload.studentIds ?? []) {
        try {
          await this.withdrawUncovered(studentId);
        } catch (error) {
          this.logger.error({ err: error, studentId }, 'Could not withdraw enrolments');
        }
      }
    }
    if (!payload.added) return;
    const members = await this.prisma.batchMember.findMany({
      where: { batchId: payload.batchId, isActive: true },
      select: { studentId: true },
    });
    for (const member of members) {
      try {
        await this.syncStudent(member.studentId);
      } catch (error) {
        this.logger.error(
          { err: error, studentId: member.studentId },
          'Could not derive enrolments',
        );
      }
    }
  }
}
