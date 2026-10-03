import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

/**
 * An account a publication still reaches: one that can sign in, or has been invited to. A
 * deactivated or erased account keeps its record but is reached by nothing (Phase 5).
 */
const REACHABLE_ACCOUNT = {
  deletedAt: null,
  status: { in: ['active', 'invited'] },
} satisfies Prisma.UserWhereInput;

/** A batch that still gives what is published to it: not archived (history), not deleted. */
const OPEN_BATCH = {
  deletedAt: null,
  status: { not: 'archived' },
} satisfies Prisma.BatchWhereInput;

/** Likewise for a programme. */
const OPEN_PROGRAM = {
  deletedAt: null,
  status: { not: 'archived' },
} satisfies Prisma.ProgramWhereInput;

/** What one learner's reconciliation changed. */
export interface EnrolmentRepair {
  /** Completed courses a lifecycle change had withdrawn, put back as completed (L4). */
  completedKept: number;
  /** Open courses that no longer reach the learner, withdrawn (D4). */
  withdrawn: number;
  /** Withdrawn courses that reach the learner again, given back. */
  returned: number;
  /** Courses that reach the learner with no enrolment yet, enrolled. */
  added: number;
}

/**
 * Enrolments are derived, never entered by hand: publishing a course to a scope enrols every
 * student in that scope, and a student joining a batch is enrolled in what that batch already has.
 * Everything else in the platform reads enrolments, so this is the only place that writes them.
 *
 * The lifecycle (Phase 5, `docs/phases/PHASE-05-integration.md` §6):
 * - a course reaches a learner through a live publication — to everyone, to them, to a batch they
 *   hold a place in, or to that batch's programme — while their account is active or invited and
 *   the batch and programme are not archived (a completed batch still gives: its learners go on
 *   after the timetable ends; an archived one is history);
 * - an open enrolment the learner is no longer reached by is withdrawn: the record and progress
 *   stay, access ends (D4), and it comes back if the course reaches them again;
 * - a completed enrolment is never withdrawn: completion, its date and the certificate are the
 *   learner's record, and they may go on reviewing what they finished.
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
    // Another publication of the same course may be enrolling the same learners at the same moment.
    await this.prisma.enrollment.createMany({
      data: toAdd.map((studentId) => ({ studentId, courseId, source: scopeType })),
      skipDuplicates: true,
    });
    this.logger.log({ courseId, scopeType, scopeId, added: toAdd.length }, 'Enrolments derived');
    return toAdd.length;
  }

  /**
   * Settles the enrolments a withdrawn publication no longer justifies. A learner who never opened
   * the course loses the row; one who had started keeps it, withdrawn, so their progress is not
   * thrown away by a content decision but access ends as for any learner it no longer reaches (D4).
   * A completed enrolment stays as it is. Returns how many rows were removed.
   */
  async syncUnpublication(courseId: string): Promise<number> {
    const reachable = new Set(await this.studentsWithAccess(courseId));
    const enrolments = await this.prisma.enrollment.findMany({
      where: { courseId, status: 'active' },
      select: { id: true, studentId: true, progressPct: true },
    });
    const unreached = enrolments.filter((e) => !reachable.has(e.studentId));
    const removable = unreached.filter((e) => e.progressPct === 0);
    const started = unreached.filter((e) => e.progressPct > 0);
    if (started.length > 0) {
      await this.prisma.enrollment.updateMany({
        where: { id: { in: started.map((e) => e.id) }, status: 'active' },
        data: { status: 'withdrawn' },
      });
    }
    if (removable.length === 0) return 0;
    await this.prisma.enrollment.deleteMany({
      where: { id: { in: removable.map((e) => e.id) }, progressPct: 0 },
    });
    return removable.length;
  }

  /**
   * Enrols one student in everything currently published to them, and gives back any course they
   * had been withdrawn from that reaches them again. Returns how many rows were added.
   */
  async syncStudent(studentId: string): Promise<number> {
    return (await this.settleReached(studentId)).added;
  }

  /**
   * A learner who leaves a batch loses the open courses that reached them only through it:
   * ADR-0010's remedy ("move the learner's batch") made real. The enrolment stays, as `withdrawn`,
   * so the record is kept, and `syncStudent` restores it if a publication reaches them again.
   */
  async withdrawUncovered(studentId: string): Promise<number> {
    const withdrawn = await this.withdrawUnreached(studentId);
    // A transfer adds the learner to their next batch straight after; checking again here settles
    // the outcome whichever of the two handlers finishes last.
    await this.syncStudent(studentId);
    return withdrawn;
  }

  /**
   * Brings one learner's enrolments to what the lifecycle says they should be, whatever events
   * were missed on the way. Idempotent: a second run changes nothing.
   */
  async reconcileStudent(studentId: string): Promise<EnrolmentRepair> {
    // A completed course is never withdrawn (L4); rows an earlier rule withdrew are put back.
    const completedKept = (
      await this.prisma.enrollment.updateMany({
        where: { studentId, status: 'withdrawn', completedAt: { not: null } },
        data: { status: 'completed' },
      })
    ).count;
    const withdrawn = await this.withdrawUnreached(studentId);
    const { returned, added } = await this.settleReached(studentId);
    return { completedKept, withdrawn, returned, added };
  }

  /** Withdraws the open enrolments no live publication justifies any more. */
  private async withdrawUnreached(studentId: string): Promise<number> {
    const covered = new Set((await this.publicationsReaching(studentId)).map((p) => p.courseId));
    // Only open courses: a completed one is the learner's record and stays (L4).
    const open = await this.prisma.enrollment.findMany({
      where: { studentId, status: 'active' },
      select: { id: true, courseId: true },
    });
    const leaving = open.filter((enrolment) => !covered.has(enrolment.courseId));
    if (leaving.length === 0) return 0;
    await this.prisma.enrollment.updateMany({
      where: { id: { in: leaving.map((e) => e.id) }, status: 'active' },
      data: { status: 'withdrawn' },
    });
    return leaving.length;
  }

  /** Gives back withdrawn courses that reach the learner again and enrols them in new ones. */
  private async settleReached(studentId: string): Promise<{ returned: number; added: number }> {
    const publications = await this.publicationsReaching(studentId);
    if (publications.length === 0) return { returned: 0, added: 0 };
    const courseIds = [...new Set(publications.map((p) => p.courseId))];

    const returning = await this.prisma.enrollment.findMany({
      where: { studentId, status: 'withdrawn', courseId: { in: courseIds } },
      select: { id: true, completedAt: true },
    });
    for (const enrolment of returning) {
      await this.prisma.enrollment.update({
        where: { id: enrolment.id },
        data: { status: enrolment.completedAt ? 'completed' : 'active' },
      });
    }

    const existing = await this.prisma.enrollment.findMany({
      where: { studentId, courseId: { in: courseIds } },
      select: { courseId: true },
    });
    const already = new Set(existing.map((e) => e.courseId));
    const toAdd = publications.filter(
      (p, index) =>
        !already.has(p.courseId) &&
        publications.findIndex((q) => q.courseId === p.courseId) === index,
    );
    if (toAdd.length > 0) {
      await this.prisma.enrollment.createMany({
        data: toAdd.map((p) => ({ studentId, courseId: p.courseId, source: p.scopeType })),
        skipDuplicates: true,
      });
    }
    return { returned: returning.length, added: toAdd.length };
  }

  /**
   * The live publications of published courses that reach a student: through their open batches
   * and those batches' open programmes, to them, or to everyone — and none at all once the account
   * is deactivated or erased.
   */
  private async publicationsReaching(
    studentId: string,
  ): Promise<{ courseId: string; scopeType: string }[]> {
    const org = await this.tenant.getOrganization();
    const learner = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, user: { organizationId: org.id, ...REACHABLE_ACCOUNT } },
      select: { id: true },
    });
    if (!learner) return [];
    const places = await this.prisma.batchMember.findMany({
      where: { studentId, isActive: true, batch: OPEN_BATCH },
      select: {
        batchId: true,
        batch: {
          select: { programId: true, program: { select: { status: true, deletedAt: true } } },
        },
      },
    });
    const batchIds = places.map((p) => p.batchId);
    const programIds = [
      ...new Set(
        places
          .filter(
            (p) => p.batch.program.status !== 'archived' && p.batch.program.deletedAt === null,
          )
          .map((p) => p.batch.programId),
      ),
    ];
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

  /** Student ids a publication scope covers, under the same rule. */
  async studentsInScope(scopeType: string, scopeId: string | null): Promise<string[]> {
    const org = await this.tenant.getOrganization();
    const account = { organizationId: org.id, ...REACHABLE_ACCOUNT };
    if (scopeType === 'all') {
      const rows = await this.prisma.studentProfile.findMany({
        where: { user: account },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    if (scopeType === 'learner') {
      const learner = await this.prisma.studentProfile.findFirst({
        where: { id: scopeId ?? '', user: account },
        select: { id: true },
      });
      return learner ? [learner.id] : [];
    }
    const where: Prisma.BatchMemberWhereInput =
      scopeType === 'batch'
        ? { batchId: scopeId ?? '', isActive: true, batch: OPEN_BATCH, student: { user: account } }
        : {
            isActive: true,
            batch: { ...OPEN_BATCH, programId: scopeId ?? '', program: OPEN_PROGRAM },
            student: { user: account },
          };
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
        await this.settle(studentId, 'withdraw');
      }
    }
    if (!payload.added) return;
    const members = await this.prisma.batchMember.findMany({
      where: { batchId: payload.batchId, isActive: true },
      select: { studentId: true },
    });
    for (const member of members) await this.settle(member.studentId, 'sync');
  }

  /** An archived batch gives nothing any more; one that is not archived changes nothing here. */
  @OnEvent('batch.status_changed')
  async onBatchStatusChanged(payload: { batchId: string; status: string }): Promise<void> {
    if (payload.status !== 'archived') return;
    const members = await this.prisma.batchMember.findMany({
      where: { batchId: payload.batchId, isActive: true },
      select: { studentId: true },
    });
    for (const member of members) await this.settle(member.studentId, 'withdraw');
  }

  /** Archiving a programme ends what it gave; bringing it back gives it again. */
  @OnEvent('program.status_changed')
  async onProgramStatusChanged(payload: { programId: string; status: string }): Promise<void> {
    const members = await this.prisma.batchMember.findMany({
      where: { isActive: true, batch: { programId: payload.programId } },
      select: { studentId: true },
    });
    const ids = [...new Set(members.map((m) => m.studentId))];
    for (const id of ids) {
      await this.settle(id, payload.status === 'archived' ? 'withdraw' : 'sync');
    }
  }

  /** A deactivated or erased account is reached by nothing: its open courses are withdrawn. */
  @OnEvent('user.deactivated')
  async onUserDeactivated(payload: { userId: string }): Promise<void> {
    const learner = await this.learnerOf(payload.userId);
    if (learner) await this.settle(learner, 'withdraw');
  }

  /**
   * A new learner is enrolled in what reaches them at once — a course published to everyone —
   * rather than when they first join a batch (Phase 5).
   */
  @OnEvent('student.created')
  async onStudentCreated(payload: { studentId: string }): Promise<void> {
    await this.settle(payload.studentId, 'sync');
  }

  /** A reactivated account is reached again by what is published to it. */
  @OnEvent('user.reactivated')
  async onUserReactivated(payload: { userId: string }): Promise<void> {
    const learner = await this.learnerOf(payload.userId);
    if (learner) await this.settle(learner, 'sync');
  }

  private async learnerOf(userId: string): Promise<string | null> {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  /** Errors are logged, not thrown: the reconciliation job settles anything left behind. */
  private async settle(studentId: string, how: 'withdraw' | 'sync'): Promise<void> {
    try {
      if (how === 'withdraw') await this.withdrawUncovered(studentId);
      else await this.syncStudent(studentId);
    } catch (error) {
      this.logger.error(
        { err: error, studentId },
        how === 'withdraw' ? 'Could not withdraw enrolments' : 'Could not derive enrolments',
      );
    }
  }
}
