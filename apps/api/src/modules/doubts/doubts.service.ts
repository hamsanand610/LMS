import { Injectable } from '@nestjs/common';
import {
  type DoubtCreateInput,
  type DoubtListQuery,
  type DoubtStatus,
  type DoubtSummary,
  type DoubtThread,
  type Paginated,
} from '@lms/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, scopeFor } from '../../core/auth/auth-user.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { NotificationsService } from '../notifications/index.js';

const SUMMARY_INCLUDE = {
  course: { select: { id: true, title: true } },
  lesson: { select: { id: true, title: true } },
  student: {
    select: {
      id: true,
      userId: true,
      studentCode: true,
      user: { select: { name: true } },
      members: { where: { isActive: true }, select: { batch: { select: { code: true } } } },
    },
  },
  replies: { select: { fromStaff: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
} as const satisfies Prisma.DoubtInclude;

type SummaryRow = Prisma.DoubtGetPayload<{ include: typeof SUMMARY_INCLUDE }>;

/** Which side of the desk the route serves: the learner's own doubts, or staff answering. */
export type DoubtRole = 'learner' | 'staff';

/** Who is looking: the learner who asks, or staff whose scope reaches some learners. */
type Viewer = { kind: 'learner'; studentId: string } | { kind: 'staff'; batchIds: string[] | null };

/**
 * Doubts (ADR-0014). A learner asks about a course or a lesson; the trainers of their batches — or
 * an administrator — answer in a thread. Trainers see only their own batches' learners.
 */
@Injectable()
export class DoubtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    user: AuthUser,
    role: DoubtRole,
    query: DoubtListQuery,
  ): Promise<Paginated<DoubtSummary>> {
    const org = await this.tenant.getOrganization();
    const viewer = await this.viewerFor(user, role);
    const where: Prisma.DoubtWhereInput = {
      organizationId: org.id,
      AND: [
        this.visibleTo(viewer),
        query.status ? { status: query.status } : {},
        query.courseId ? { courseId: query.courseId } : {},
        query.lessonId ? { lessonId: query.lessonId } : {},
        query.batchId && viewer.kind === 'staff'
          ? { student: { members: { some: { batchId: query.batchId, isActive: true } } } }
          : {},
        query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { student: { user: { name: { contains: query.q, mode: 'insensitive' } } } },
              ],
            }
          : {},
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.doubt.findMany({
        where,
        include: SUMMARY_INCLUDE,
        // Staff work the queue oldest-waiting first; a learner reads their newest first.
        orderBy:
          viewer.kind === 'staff' && query.status === 'open'
            ? { createdAt: 'asc' }
            : { updatedAt: 'desc' },
        ...skipTake(query),
      }),
      this.prisma.doubt.count({ where }),
    ]);
    return paginate(rows.map(toSummary), total, query);
  }

  async get(id: string, user: AuthUser, role: DoubtRole): Promise<DoubtThread> {
    const viewer = await this.viewerFor(user, role);
    const row = await this.findVisible(id, viewer);
    const replies = await this.prisma.doubtReply.findMany({
      where: { doubtId: id },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...toSummary(row),
      body: row.body,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      replies: replies.map((reply) => ({
        id: reply.id,
        body: reply.body,
        author: {
          name: reply.author.name,
          isStaff: reply.fromStaff,
          isYou: reply.authorId === user.id,
        },
        createdAt: reply.createdAt.toISOString(),
      })),
      canReply: true,
      canResolve: true,
    };
  }

  async create(input: DoubtCreateInput, user: AuthUser): Promise<DoubtThread> {
    const org = await this.tenant.getOrganization();
    const viewer = await this.viewerFor(user, 'learner');
    if (viewer.kind !== 'learner') throw new ForbiddenError('Only learners ask doubts.');
    const { courseId, lessonId } = await this.resolveSubject(input, viewer.studentId);
    const doubt = await this.prisma.doubt.create({
      data: {
        organizationId: org.id,
        studentId: viewer.studentId,
        courseId,
        lessonId,
        title: input.title,
        body: input.body,
      },
    });
    await this.audit.record({
      action: 'doubt.asked',
      resourceType: 'doubt',
      resourceId: doubt.id,
      summary: input.title,
    });
    const trainers = await this.trainerUserIds(viewer.studentId);
    if (trainers.length > 0) {
      await this.notifications.deliver({
        category: 'support',
        type: 'doubt.asked',
        title: `New doubt from ${user.name}`,
        body: input.title,
        link: `/trainer/doubts/${doubt.id}`,
        channels: ['in_app'],
        userIds: trainers,
      });
    }
    return this.get(doubt.id, user, 'learner');
  }

  async reply(id: string, body: string, user: AuthUser, role: DoubtRole): Promise<DoubtThread> {
    const viewer = await this.viewerFor(user, role);
    const doubt = await this.findVisible(id, viewer);
    const fromStaff = viewer.kind === 'staff';
    // Staff answering marks the doubt answered; the learner writing back puts it back in the queue.
    const status: DoubtStatus = fromStaff ? 'answered' : 'open';
    await this.prisma.$transaction([
      this.prisma.doubtReply.create({ data: { doubtId: id, authorId: user.id, body, fromStaff } }),
      this.prisma.doubt.update({ where: { id }, data: { status, resolvedAt: null } }),
    ]);
    await this.audit.record({
      action: 'doubt.replied',
      resourceType: 'doubt',
      resourceId: id,
      summary: doubt.title,
      after: { fromStaff, status },
    });
    if (fromStaff) {
      await this.notifications.notifyUser(doubt.student.userId, {
        category: 'support',
        type: 'doubt.answered',
        title: `${user.name} answered your doubt`,
        body: doubt.title,
        link: `/doubts/${id}`,
        channels: ['in_app', 'email'],
      });
    } else {
      const staff = await this.staffInThread(id, doubt.student.id);
      if (staff.length > 0) {
        await this.notifications.deliver({
          category: 'support',
          type: 'doubt.follow_up',
          title: `${user.name} replied to a doubt`,
          body: doubt.title,
          link: `/trainer/doubts/${id}`,
          channels: ['in_app'],
          userIds: staff,
        });
      }
    }
    return this.get(id, user, role);
  }

  async setStatus(
    id: string,
    status: 'open' | 'resolved',
    user: AuthUser,
    role: DoubtRole,
  ): Promise<DoubtThread> {
    const viewer = await this.viewerFor(user, role);
    const doubt = await this.findVisible(id, viewer);
    if (doubt.status !== status) {
      const reopenedStatus: DoubtStatus = doubt.replies.some((r) => r.fromStaff)
        ? 'answered'
        : 'open';
      await this.prisma.doubt.update({
        where: { id },
        data:
          status === 'resolved'
            ? { status: 'resolved', resolvedAt: new Date() }
            : { status: reopenedStatus, resolvedAt: null },
      });
      await this.audit.record({
        action: status === 'resolved' ? 'doubt.resolved' : 'doubt.reopened',
        resourceType: 'doubt',
        resourceId: id,
        summary: doubt.title,
        before: { status: doubt.status },
      });
    }
    return this.get(id, user, role);
  }

  /** Open doubts waiting on the caller's learners, for the trainer dashboard. */
  async waitingCount(user: AuthUser): Promise<number> {
    if (!scopeFor(user, 'doubts:answer')) return 0;
    const org = await this.tenant.getOrganization();
    const viewer = await this.viewerFor(user, 'staff');
    return this.prisma.doubt.count({
      where: { organizationId: org.id, status: 'open', AND: [this.visibleTo(viewer)] },
    });
  }

  // ───────────────────────── internals ─────────────────────────

  private async viewerFor(user: AuthUser, role: DoubtRole): Promise<Viewer> {
    if (role === 'staff') {
      const answer = scopeFor(user, 'doubts:answer');
      if (!answer) throw new ForbiddenError('You cannot answer doubts.');
      if (answer === 'all') return { kind: 'staff', batchIds: null };
      const person = await this.scope.personFor(user.id);
      return { kind: 'staff', batchIds: person.batchIds };
    }
    const person = await this.scope.personFor(user.id);
    if (!scopeFor(user, 'doubts:ask') || !person.studentId) {
      throw new ForbiddenError('Doubts are asked by learners of the institute.');
    }
    return { kind: 'learner', studentId: person.studentId };
  }

  private visibleTo(viewer: Viewer): Prisma.DoubtWhereInput {
    if (viewer.kind === 'learner') return { studentId: viewer.studentId };
    if (viewer.batchIds === null) return {};
    return { student: { members: { some: { batchId: { in: viewer.batchIds }, isActive: true } } } };
  }

  private async findVisible(id: string, viewer: Viewer): Promise<SummaryRow & { body: string }> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.doubt.findFirst({
      where: { id, organizationId: org.id, AND: [this.visibleTo(viewer)] },
      include: SUMMARY_INCLUDE,
    });
    if (!row) throw new NotFoundError('Doubt');
    return row;
  }

  /** A doubt names a course the learner is enrolled in, and optionally a lesson of that course. */
  private async resolveSubject(
    input: DoubtCreateInput,
    studentId: string,
  ): Promise<{ courseId: string | null; lessonId: string | null }> {
    let courseId = input.courseId;
    if (input.lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: input.lessonId },
        select: { module: { select: { courseId: true } } },
      });
      if (!lesson || (courseId && lesson.module.courseId !== courseId)) {
        throw new ValidationError([{ path: 'lessonId', message: 'Choose a lesson of the course' }]);
      }
      courseId = lesson.module.courseId;
    }
    if (courseId) {
      const enrolled = await this.prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId, courseId } },
        select: { id: true },
      });
      if (!enrolled) {
        throw new ValidationError([
          { path: 'courseId', message: 'Choose one of the courses you are enrolled in' },
        ]);
      }
    }
    return { courseId, lessonId: input.lessonId };
  }

  /** The trainers assigned to the learner's current batches. */
  private async trainerUserIds(studentId: string): Promise<string[]> {
    const rows = await this.prisma.batchTrainer.findMany({
      where: { batch: { members: { some: { studentId, isActive: true } } } },
      select: { trainer: { select: { userId: true } } },
    });
    return [...new Set(rows.map((r) => r.trainer.userId))];
  }

  /** Staff who already answered the thread, or else the learner's trainers. */
  private async staffInThread(doubtId: string, studentId: string): Promise<string[]> {
    const replies = await this.prisma.doubtReply.findMany({
      where: { doubtId, fromStaff: true },
      select: { authorId: true },
    });
    const answered = [...new Set(replies.map((r) => r.authorId))];
    return answered.length > 0 ? answered : this.trainerUserIds(studentId);
  }
}

function toSummary(row: SummaryRow): DoubtSummary {
  const latest = row.replies[0];
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    course: row.course ? { id: row.course.id, title: row.course.title } : null,
    lesson: row.lesson ? { id: row.lesson.id, title: row.lesson.title } : null,
    student: {
      id: row.student.id,
      name: row.student.user.name,
      studentCode: row.student.studentCode,
      batchCodes: row.student.members.map((m) => m.batch.code),
    },
    replyCount: row.replies.length,
    lastReplyFromStaff: latest?.fromStaff ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
