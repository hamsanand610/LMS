import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  formatDateTime,
  type AssignmentCreateInput,
  type AssignmentDetail,
  type AssignmentKind,
  type AssignmentModuleView,
  type AssignmentPublicationRecord,
  type AssignmentPublishInput,
  type AssignmentResourcesInput,
  type AssignmentStatus,
  type AssignmentStructureInput,
  type AssignmentSummary,
  type AssignmentUpdateInput,
  type Paginated,
  type QuestionDifficulty,
  type QuestionType,
  type UnlockRule,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission } from '../../core/auth/auth-user.js';
import {
  ConflictError,
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { requireAuthorOrInstituteWide } from '../../core/scope/ownership.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { requireOpenAudience } from '../../core/scope/open-audience.js';
import { requireAttachableFile } from '../files/index.js';
import { NotificationsService } from '../notifications/index.js';
import { QuestionsService } from '../questions/index.js';
import { TaxonomiesService } from '../settings/taxonomies.service.js';
import { LearnerAssignmentsService } from './learner-assignments.service.js';
import { learnersReached, parseSettings } from './reach.js';

interface ListQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: AssignmentStatus;
  kind?: AssignmentKind;
  subject?: string;
  courseId?: string;
  batchId?: string;
}

/** Negative positions used while a structure is reordered, to clear the unique index. */
const REORDER_OFFSET = -100_000;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Writing assignments and giving them to learners. Everything a batch-scoped trainer does is
 * checked against the batches they teach; changing an assignment itself is for its author or for
 * institute-wide staff, because an assignment reaches every batch it is given to.
 */
@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly scope: ScopeService,
    private readonly questions: QuestionsService,
    private readonly notifications: NotificationsService,
    private readonly taxonomies: TaxonomiesService,
    private readonly learner: LearnerAssignmentsService,
  ) {}

  // ───────────────────────── authoring ─────────────────────────

  async list(query: ListQuery, user: AuthUser): Promise<Paginated<AssignmentSummary>> {
    const org = await this.tenant.getOrganization();
    const visible = await this.visibleAssignmentIds(user);
    const where = {
      organizationId: org.id,
      deletedAt: null,
      ...(visible === null ? {} : { id: { in: visible } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.batchId
        ? { publications: { some: { batchId: query.batchId, withdrawnAt: null } } }
        : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.assignment.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        ...skipTake(query),
        include: SUMMARY_INCLUDE,
      }),
      this.prisma.assignment.count({ where }),
    ]);
    return paginate(await this.withAuthors(rows), total, query);
  }

  async get(id: string, user: AuthUser): Promise<AssignmentDetail> {
    const assignment = await this.findForStaff(id, user);
    const [modules, answered, resources] = await Promise.all([
      this.loadModules(id),
      this.prisma.submission.groupBy({
        by: ['assignmentQuestionId'],
        where: { assignmentId: id },
        _count: { _all: true },
      }),
      this.resources(id),
    ]);
    const answers = new Map(answered.map((a) => [a.assignmentQuestionId, a._count._all]));
    const [summary] = await this.withAuthors([assignment]);
    return {
      ...summary!,
      instructions: assignment.instructions,
      resources,
      modules: modules.map<AssignmentModuleView>((module) => ({
        id: module.id,
        title: module.title,
        description: module.description,
        topic: module.topic,
        courseModuleId: module.courseModuleId,
        dueAfterDays: module.dueAfterDays,
        position: module.position,
        unlockRule: module.unlockRule as UnlockRule,
        questions: module.questions.map((question, index) => ({
          id: question.id,
          questionId: question.questionId,
          title: question.question.title,
          type: question.question.type as QuestionType,
          difficulty: question.question.difficulty as QuestionDifficulty,
          marks: question.marks,
          position: index,
          submissionCount: answers.get(question.id) ?? 0,
        })),
      })),
    };
  }

  async create(input: AssignmentCreateInput, user: AuthUser): Promise<AssignmentSummary> {
    const org = await this.tenant.getOrganization();
    await this.checkReferences(input);
    const assignment = await this.prisma.assignment.create({
      data: {
        organizationId: org.id,
        title: input.title,
        description: input.description,
        instructions: input.instructions,
        subject: input.subject,
        difficulty: input.difficulty,
        kind: input.kind,
        courseId: input.courseId,
        programId: input.programId,
        estimatedMinutes: input.estimatedMinutes,
        passPercent: input.passPercent,
        settings: asJson(input.settings),
        createdById: user.id,
      },
      include: SUMMARY_INCLUDE,
    });
    await this.audit.record({
      action: 'assignment.created',
      resourceType: 'assignment',
      resourceId: assignment.id,
      summary: `Assignment "${assignment.title}" created`,
      after: { subject: assignment.subject, kind: assignment.kind },
    });
    const [summary] = await this.withAuthors([assignment]);
    return summary!;
  }

  async update(
    id: string,
    input: AssignmentUpdateInput,
    user: AuthUser,
  ): Promise<AssignmentSummary> {
    const assignment = await this.findForStaff(id, user);
    requireAuthorOrInstituteWide(assignment, user, 'assignments:manage', 'assignment');
    await this.checkReferences(input);
    const updated = await this.prisma.assignment.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.instructions === undefined ? {} : { instructions: input.instructions }),
        ...(input.subject === undefined ? {} : { subject: input.subject }),
        ...(input.difficulty === undefined ? {} : { difficulty: input.difficulty }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        ...(input.courseId === undefined ? {} : { courseId: input.courseId }),
        ...(input.programId === undefined ? {} : { programId: input.programId }),
        ...(input.estimatedMinutes === undefined
          ? {}
          : { estimatedMinutes: input.estimatedMinutes }),
        ...(input.passPercent === undefined ? {} : { passPercent: input.passPercent }),
        ...(input.settings === undefined ? {} : { settings: asJson(input.settings) }),
      },
      include: SUMMARY_INCLUDE,
    });
    await this.audit.record({
      action: 'assignment.updated',
      resourceType: 'assignment',
      resourceId: id,
      summary: `Assignment "${updated.title}" updated`,
      before: { title: assignment.title, settings: assignment.settings },
      after: { title: updated.title, settings: updated.settings },
    });
    const [summary] = await this.withAuthors([updated]);
    return summary!;
  }

  /**
   * Replaces the structure. Modules and placed questions that keep their id keep the answers given
   * to them; a placement that has answers cannot be removed, because the answers would go with it.
   */
  async saveStructure(
    id: string,
    input: AssignmentStructureInput,
    user: AuthUser,
  ): Promise<AssignmentDetail> {
    const assignment = await this.findForStaff(id, user);
    requireAuthorOrInstituteWide(assignment, user, 'assignments:manage', 'assignment');
    const questionIds = input.modules.flatMap((m) => m.questions.map((q) => q.questionId));
    const pickable = await this.questions.pickable(questionIds, user);
    const missing = questionIds.filter((questionId) => !pickable.has(questionId));
    if (missing.length > 0) {
      throw new ValidationError([
        {
          path: 'modules',
          message: `${missing.length} question(s) are not published, or not yours to use`,
        },
      ]);
    }
    for (const module of input.modules) {
      if (module.topic && !(await this.taxonomies.isValid('topic', module.topic))) {
        throw new ValidationError([
          { path: 'modules', message: `"${module.topic}" is not one of the topics` },
        ]);
      }
    }
    const courseModuleIds = input.modules
      .map((m) => m.courseModuleId)
      .filter((m): m is string => !!m);
    if (courseModuleIds.length > 0) {
      const found = await this.prisma.courseModule.count({
        where: {
          id: { in: courseModuleIds },
          ...(assignment.courseId ? { courseId: assignment.courseId } : {}),
        },
      });
      if (found !== new Set(courseModuleIds).size) {
        throw new ValidationError([
          {
            path: 'modules',
            message: 'A module points at a course module outside this assignment’s course',
          },
        ]);
      }
    }

    const existing = await this.prisma.assignmentModule.findMany({
      where: { assignmentId: id },
      include: { questions: { include: { question: { select: { title: true } } } } },
    });
    const keptModules = new Set(input.modules.map((m) => m.id).filter(Boolean) as string[]);
    const knownModules = new Set(existing.map((m) => m.id));
    for (const moduleId of keptModules) {
      if (!knownModules.has(moduleId)) throw new NotFoundError('Module');
    }

    // Every placement that would disappear, and whether anyone has answered it.
    const wantedByModule = new Map(
      input.modules
        .filter((m) => m.id)
        .map((m) => [m.id!, new Set(m.questions.map((q) => q.questionId))]),
    );
    const leaving = existing.flatMap((module) =>
      module.questions.filter(
        (placement) =>
          !keptModules.has(module.id) || !wantedByModule.get(module.id)?.has(placement.questionId),
      ),
    );
    if (leaving.length > 0) {
      const answered = await this.prisma.submission.findFirst({
        where: { assignmentQuestionId: { in: leaving.map((p) => p.id) } },
        select: { assignmentQuestionId: true },
      });
      if (answered) {
        const title = leaving.find((p) => p.id === answered.assignmentQuestionId)?.question.title;
        throw new DomainRuleError(
          `"${title ?? 'A question'}" already has answers, so it cannot be taken out of this assignment`,
          'placement_has_answers',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.assignmentModule.deleteMany({
        where: { assignmentId: id, id: { notIn: [...keptModules, ZERO_UUID] } },
      });
      let parked = REORDER_OFFSET;
      for (const moduleId of keptModules) {
        await tx.assignmentModule.update({ where: { id: moduleId }, data: { position: parked } });
        parked += 1;
      }

      for (const [moduleIndex, moduleInput] of input.modules.entries()) {
        const data = {
          title: moduleInput.title,
          description: moduleInput.description,
          topic: moduleInput.topic,
          courseModuleId: moduleInput.courseModuleId,
          dueAfterDays: moduleInput.dueAfterDays,
          position: moduleIndex,
          unlockRule: asJson(moduleInput.unlockRule),
        };
        const moduleId = moduleInput.id
          ? (await tx.assignmentModule.update({ where: { id: moduleInput.id }, data })).id
          : (await tx.assignmentModule.create({ data: { assignmentId: id, ...data } })).id;

        // Placements are keyed by question, so a re-ordered question keeps its submissions.
        const placed = await tx.assignmentQuestion.findMany({ where: { moduleId } });
        const wanted = new Set(moduleInput.questions.map((q) => q.questionId));
        await tx.assignmentQuestion.deleteMany({
          where: { moduleId, questionId: { notIn: [...wanted, ZERO_UUID] } },
        });
        const byQuestion = new Map(placed.map((p) => [p.questionId, p]));
        let parkedQuestion = REORDER_OFFSET;
        for (const existingPlacement of placed) {
          if (!wanted.has(existingPlacement.questionId)) continue;
          await tx.assignmentQuestion.update({
            where: { id: existingPlacement.id },
            data: { position: parkedQuestion },
          });
          parkedQuestion += 1;
        }
        for (const [index, question] of moduleInput.questions.entries()) {
          const marks = question.marks ?? pickable.get(question.questionId)?.marks ?? 1;
          const current = byQuestion.get(question.questionId);
          if (current) {
            await tx.assignmentQuestion.update({
              where: { id: current.id },
              data: { position: index, marks },
            });
          } else {
            await tx.assignmentQuestion.create({
              data: { moduleId, questionId: question.questionId, position: index, marks },
            });
          }
        }
      }
    });

    await this.audit.record({
      action: 'assignment.structure_saved',
      resourceType: 'assignment',
      resourceId: id,
      summary: `${assignment.title}: ${input.modules.length} module(s)`,
      after: {
        modules: input.modules.length,
        questions: input.modules.reduce((n, m) => n + m.questions.length, 0),
      },
    });
    return this.get(id, user);
  }

  /** Replaces the reading and downloads that go with the assignment. */
  async saveResources(
    id: string,
    input: AssignmentResourcesInput,
    user: AuthUser,
  ): Promise<AssignmentDetail> {
    const assignment = await this.findForStaff(id, user);
    requireAuthorOrInstituteWide(assignment, user, 'assignments:manage', 'assignment');
    for (const resource of input.resources) {
      if (resource.fileId) {
        await requireAttachableFile(this.prisma, resource.fileId, {
          contexts: ['assignment-resource'],
        });
      }
    }
    await this.prisma.$transaction([
      this.prisma.assignmentResource.deleteMany({ where: { assignmentId: id } }),
      this.prisma.assignmentResource.createMany({
        data: input.resources.map((resource, position) => ({
          assignmentId: id,
          title: resource.title,
          url: resource.url,
          fileId: resource.fileId,
          position,
        })),
      }),
    ]);
    await this.audit.record({
      action: 'assignment.resources_saved',
      resourceType: 'assignment',
      resourceId: id,
      summary: `${assignment.title}: ${input.resources.length} resource(s)`,
    });
    return this.get(id, user);
  }

  /** A signed link to one of the assignment's files, for staff who can see the assignment. */
  async resourceLink(id: string, resourceId: string, user: AuthUser): Promise<{ url: string }> {
    await this.findForStaff(id, user);
    return this.learner.resourceUrl(id, resourceId);
  }

  async archive(id: string, user: AuthUser): Promise<{ withdrawn: number }> {
    const assignment = await this.findForStaff(id, user);
    requireAuthorOrInstituteWide(assignment, user, 'assignments:manage', 'assignment');
    // Archiving withdraws it everywhere, so a batch-scoped author may do it only while every live
    // publication is in a batch they teach.
    const visible = await this.scope.visibleBatchIds(user, 'assignments:manage');
    if (visible !== null) {
      const elsewhere = await this.prisma.assignmentPublication.count({
        where: {
          assignmentId: id,
          withdrawnAt: null,
          NOT: {
            OR: [
              { batchId: { in: visible } },
              { student: { members: { some: { isActive: true, batchId: { in: visible } } } } },
            ],
          },
        },
      });
      if (elsewhere > 0) {
        throw new ForbiddenError(
          `This assignment is also given to ${elsewhere} audience(s) outside the batches you teach`,
        );
      }
    }
    const withdrawn = await this.prisma.assignmentPublication.updateMany({
      where: { assignmentId: id, withdrawnAt: null },
      data: { withdrawnAt: new Date() },
    });
    await this.prisma.assignment.update({ where: { id }, data: { status: 'archived' } });
    await this.audit.record({
      action: 'assignment.archived',
      resourceType: 'assignment',
      resourceId: id,
      summary: `Assignment "${assignment.title}" archived`,
    });
    return { withdrawn: withdrawn.count };
  }

  // ───────────────────────── publication ─────────────────────────

  async publications(id: string, user: AuthUser): Promise<AssignmentPublicationRecord[]> {
    await this.findForStaff(id, user);
    const visible = await this.scope.visibleBatchIds(user, 'assignments:manage');
    const rows = await this.prisma.assignmentPublication.findMany({
      where: {
        assignmentId: id,
        withdrawnAt: null,
        ...(visible === null
          ? {}
          : {
              OR: [
                { batchId: { in: visible } },
                { student: { members: { some: { isActive: true, batchId: { in: visible } } } } },
              ],
            }),
      },
      orderBy: { publishedAt: 'desc' },
      include: PUBLICATION_INCLUDE,
    });
    const reached = await learnersReached(this.prisma, rows);
    return rows.map((row) => toPublicationRecord(row, countFor(reached, row.id)));
  }

  /** Gives the assignment to a batch or to named learners, and tells them. */
  async publish(
    id: string,
    input: AssignmentPublishInput,
    user: AuthUser,
  ): Promise<AssignmentPublicationRecord[]> {
    const assignment = await this.findForStaff(id, user);
    const questionCount = await this.prisma.assignmentQuestion.count({
      where: { module: { assignmentId: id } },
    });
    if (questionCount === 0) {
      throw new DomainRuleError(
        'Add at least one question before publishing this assignment',
        'assignment_has_no_questions',
      );
    }
    if (!hasPermission(user, 'assignments:publish')) {
      throw new ForbiddenError('You do not have access to this resource');
    }
    await requireOpenAudience(this.prisma, { batchIds: input.batchId ? [input.batchId] : [] });
    const dates = {
      opensAt: input.opensAt ? new Date(input.opensAt) : null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      closesAt: input.closesAt ? new Date(input.closesAt) : null,
      note: input.note,
      publishedById: user.id,
    };

    let created: { id: string }[];
    let audience: string;
    if (input.batchId) {
      await this.requireBatchScope(input.batchId, user, 'assignments:publish');
      const live = await this.prisma.assignmentPublication.findFirst({
        where: { assignmentId: id, batchId: input.batchId, withdrawnAt: null },
      });
      if (live)
        throw new ConflictError('That batch already has this assignment', 'already_published');
      const batch = await this.prisma.batch.findUniqueOrThrow({
        where: { id: input.batchId },
        select: { code: true },
      });
      created = [
        await this.prisma.assignmentPublication.create({
          data: { assignmentId: id, batchId: input.batchId, ...dates },
        }),
      ];
      audience = batch.code;
    } else {
      const studentIds = [...new Set(input.studentIds)];
      await this.requireLearnersInScope(studentIds, user);
      const already = await this.prisma.assignmentPublication.count({
        where: { assignmentId: id, studentId: { in: studentIds }, withdrawnAt: null },
      });
      if (already > 0) {
        throw new ConflictError(
          `${already} of those learners already have this assignment given to them`,
          'already_published',
        );
      }
      created = await this.prisma.$transaction(
        studentIds.map((studentId) =>
          this.prisma.assignmentPublication.create({
            data: { assignmentId: id, studentId, ...dates },
          }),
        ),
      );
      audience = `${studentIds.length} learner(s)`;
    }
    await this.prisma.assignment.update({ where: { id }, data: { status: 'published' } });

    const rows = await this.prisma.assignmentPublication.findMany({
      where: { id: { in: created.map((c) => c.id) } },
      include: PUBLICATION_INCLUDE,
    });
    const reached = await learnersReached(this.prisma, rows);
    const learnerIds = [...reached.keys()];
    if (learnerIds.length > 0) {
      const users = await this.prisma.studentProfile.findMany({
        where: { id: { in: learnerIds } },
        select: { userId: true },
      });
      const timezone = (await this.tenant.getOrganization()).timezone;
      await this.notifications.deliver({
        category: 'assessment',
        type: 'assignment.published',
        title: `New assignment: ${assignment.title}`,
        body: input.dueAt
          ? `Due by ${formatDateTime(input.dueAt, { timeZone: timezone })}.`
          : input.opensAt
            ? `Opens on ${formatDateTime(input.opensAt, { timeZone: timezone })}.`
            : 'It is in your assignments now.',
        link: `/assignments/${id}`,
        channels: ['in_app'],
        userIds: users.map((u) => u.userId),
      });
    }

    await this.audit.record({
      action: 'assignment.published',
      resourceType: 'assignment',
      resourceId: id,
      summary: `${assignment.title} given to ${audience} (${learnerIds.length} learners)`,
      after: {
        batchId: input.batchId,
        learners: input.studentIds.length,
        opensAt: input.opensAt,
        dueAt: input.dueAt,
        closesAt: input.closesAt,
      },
    });
    for (const row of rows) {
      this.events.emit('assignment.published', {
        assignmentId: id,
        batchId: row.batchId,
        studentId: row.studentId,
      });
    }
    return rows.map((row) => toPublicationRecord(row, countFor(reached, row.id)));
  }

  async withdraw(id: string, publicationId: string, user: AuthUser): Promise<void> {
    const assignment = await this.findForStaff(id, user);
    const publication = await this.prisma.assignmentPublication.findFirst({
      where: { id: publicationId, assignmentId: id, withdrawnAt: null },
    });
    if (!publication) throw new NotFoundError('Publication');
    if (publication.batchId) {
      await this.requireBatchScope(publication.batchId, user, 'assignments:publish');
    } else if (publication.studentId) {
      if (!hasPermission(user, 'assignments:publish')) {
        throw new ForbiddenError('You do not have access to this resource');
      }
      await this.requireLearnersInScope([publication.studentId], user);
    }
    await this.prisma.assignmentPublication.update({
      where: { id: publicationId },
      data: { withdrawnAt: new Date() },
    });
    const remaining = await this.prisma.assignmentPublication.count({
      where: { assignmentId: id, withdrawnAt: null },
    });
    if (remaining === 0) {
      await this.prisma.assignment.update({ where: { id }, data: { status: 'draft' } });
    }
    await this.audit.record({
      action: 'assignment.withdrawn',
      resourceType: 'assignment',
      resourceId: id,
      summary: `${assignment.title} withdrawn from ${publication.batchId ? 'a batch' : 'a learner'}`,
      before: { batchId: publication.batchId, studentId: publication.studentId },
    });
  }

  // ───────────────────────── shared helpers ─────────────────────────

  async loadModules(assignmentId: string) {
    return this.prisma.assignmentModule.findMany({
      where: { assignmentId },
      orderBy: { position: 'asc' },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: {
            question: { select: { id: true, title: true, type: true, difficulty: true } },
          },
        },
      },
    });
  }

  settingsOf(assignment: { settings: unknown }) {
    return parseSettings(assignment.settings);
  }

  /**
   * Assignment ids a batch-scoped caller may act on; null when unrestricted. A trainer reaches the
   * assignments given to their batches or to learners in them, and the ones they wrote.
   */
  async visibleAssignmentIds(
    user: AuthUser,
    permission = 'assignments:manage',
  ): Promise<string[] | null> {
    const batchIds = await this.scope.visibleBatchIds(user, permission);
    if (batchIds === null) return null;
    const rows = await this.prisma.assignmentPublication.findMany({
      where: {
        withdrawnAt: null,
        OR: [
          { batchId: { in: batchIds } },
          { student: { members: { some: { isActive: true, batchId: { in: batchIds } } } } },
        ],
      },
      select: { assignmentId: true },
    });
    const own = await this.prisma.assignment.findMany({
      where: { createdById: user.id, deletedAt: null },
      select: { id: true },
    });
    return [...new Set([...rows.map((r) => r.assignmentId), ...own.map((r) => r.id)])];
  }

  async findForStaff(id: string, user: AuthUser, permission = 'assignments:manage') {
    const org = await this.tenant.getOrganization();
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, organizationId: org.id, deletedAt: null },
      include: SUMMARY_INCLUDE,
    });
    if (!assignment) throw new NotFoundError('Assignment');
    const visible = await this.visibleAssignmentIds(user, permission);
    if (visible !== null && !visible.includes(id)) {
      throw new ForbiddenError('That assignment belongs to batches you do not teach');
    }
    return assignment;
  }

  /**
   * An assignment reaches every batch it is published to, so changing it changes it for all of
   * them. A batch-scoped member of staff changes only what they wrote; institute-wide staff, any.
   */
  private async requireBatchScope(
    batchId: string,
    user: AuthUser,
    permission: string,
  ): Promise<void> {
    if (!hasPermission(user, permission)) {
      throw new ForbiddenError('You do not have access to this resource');
    }
    const batch = await this.prisma.batch.findFirst({ where: { id: batchId, deletedAt: null } });
    if (!batch) throw new NotFoundError('Batch');
    const visible = await this.scope.visibleBatchIds(user, permission);
    if (visible !== null && !visible.includes(batchId)) {
      throw new ForbiddenError('That batch is not one of yours');
    }
  }

  /** Learners exist, are active, and — for a batch-scoped caller — are in a batch they teach. */
  private async requireLearnersInScope(studentIds: string[], user: AuthUser): Promise<void> {
    const org = await this.tenant.getOrganization();
    const students = await this.prisma.studentProfile.findMany({
      where: {
        id: { in: studentIds },
        user: { organizationId: org.id, deletedAt: null, status: 'active' },
      },
      select: { id: true, members: { where: { isActive: true }, select: { batchId: true } } },
    });
    if (students.length !== studentIds.length) {
      throw new ValidationError([
        { path: 'studentIds', message: 'Some of those learners were not found' },
      ]);
    }
    const visible = await this.scope.visibleBatchIds(user, 'assignments:publish');
    if (visible === null) return;
    const outside = students.filter((s) => !s.members.some((m) => visible.includes(m.batchId)));
    if (outside.length > 0) {
      throw new ForbiddenError(`${outside.length} of those learners are not in your batches`);
    }
  }

  /** The taxonomy terms, course and programme an assignment names exist. */
  private async checkReferences(input: Partial<AssignmentCreateInput>): Promise<void> {
    const issues: { path: string; message: string }[] = [];
    if (input.subject && !(await this.taxonomies.isValid('subject', input.subject))) {
      issues.push({ path: 'subject', message: `"${input.subject}" is not one of the subjects` });
    }
    if (input.difficulty && !(await this.taxonomies.isValid('course-level', input.difficulty))) {
      issues.push({
        path: 'difficulty',
        message: `"${input.difficulty}" is not one of the levels`,
      });
    }
    const org = await this.tenant.getOrganization();
    if (input.courseId) {
      const course = await this.prisma.course.count({
        where: { id: input.courseId, organizationId: org.id, deletedAt: null },
      });
      if (course === 0) issues.push({ path: 'courseId', message: 'That course was not found' });
    }
    if (input.programId) {
      const program = await this.prisma.program.count({
        where: { id: input.programId, organizationId: org.id, deletedAt: null },
      });
      if (program === 0)
        issues.push({ path: 'programId', message: 'That programme was not found' });
    }
    if (issues.length > 0) throw new ValidationError(issues);
  }

  private async resources(assignmentId: string) {
    const rows = await this.prisma.assignmentResource.findMany({
      where: { assignmentId },
      orderBy: { position: 'asc' },
    });
    const fileIds = rows.map((r) => r.fileId).filter((id): id is string => !!id);
    const files =
      fileIds.length === 0
        ? []
        : await this.prisma.file.findMany({
            where: { id: { in: fileIds } },
            select: { id: true, originalName: true },
          });
    const names = new Map(files.map((f) => [f.id, f.originalName]));
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      fileId: row.fileId,
      fileName: row.fileId ? (names.get(row.fileId) ?? null) : null,
      position: row.position,
    }));
  }

  private async withAuthors(rows: SummaryRow[]): Promise<AssignmentSummary[]> {
    const authorIds = [
      ...new Set(rows.map((r) => r.createdById).filter((id): id is string => !!id)),
    ];
    const authors =
      authorIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, name: true },
          });
    const names = new Map(authors.map((a) => [a.id, a.name]));
    return rows.map((row) =>
      toSummary(row, row.createdById ? (names.get(row.createdById) ?? null) : null),
    );
  }
}

const SUMMARY_INCLUDE = {
  course: { select: { title: true } },
  program: { select: { name: true } },
  modules: {
    include: { _count: { select: { questions: true } }, questions: { select: { marks: true } } },
  },
  _count: { select: { publications: { where: { withdrawnAt: null } } } },
} as const;

type SummaryRow = {
  id: string;
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  kind: string;
  status: string;
  courseId: string | null;
  programId: string | null;
  estimatedMinutes: number;
  passPercent: number;
  settings: unknown;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  course: { title: string } | null;
  program: { name: string } | null;
  modules: { _count: { questions: number }; questions: { marks: number }[] }[];
  _count: { publications: number };
};

function toSummary(row: SummaryRow, createdByName: string | null): AssignmentSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    difficulty: row.difficulty,
    kind: row.kind as AssignmentKind,
    status: row.status as AssignmentStatus,
    courseId: row.courseId,
    courseTitle: row.course?.title ?? null,
    programId: row.programId,
    programName: row.program?.name ?? null,
    moduleCount: row.modules.length,
    questionCount: row.modules.reduce((n, m) => n + m._count.questions, 0),
    totalMarks: row.modules.reduce((n, m) => n + m.questions.reduce((t, q) => t + q.marks, 0), 0),
    publicationCount: row._count.publications,
    estimatedMinutes: row.estimatedMinutes,
    passPercent: row.passPercent,
    settings: parseSettings(row.settings),
    createdByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const PUBLICATION_INCLUDE = {
  batch: { select: { code: true, name: true } },
  student: { select: { studentCode: true, user: { select: { name: true } } } },
} as const;

function countFor(reached: Map<string, string[]>, publicationId: string): number {
  let count = 0;
  for (const publications of reached.values()) if (publications.includes(publicationId)) count += 1;
  return count;
}

function toPublicationRecord(
  row: {
    id: string;
    batchId: string | null;
    studentId: string | null;
    opensAt: Date | null;
    dueAt: Date | null;
    closesAt: Date | null;
    note: string;
    publishedAt: Date;
    batch: { code: string; name: string } | null;
    student: { studentCode: string; user: { name: string } } | null;
  },
  learners: number,
): AssignmentPublicationRecord {
  return {
    id: row.id,
    audience: row.batchId ? 'batch' : 'learner',
    batchId: row.batchId,
    batchCode: row.batch?.code ?? null,
    batchName: row.batch?.name ?? null,
    studentId: row.studentId,
    studentName: row.student?.user.name ?? null,
    studentCode: row.student?.studentCode ?? null,
    opensAt: row.opensAt?.toISOString() ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
    closesAt: row.closesAt?.toISOString() ?? null,
    note: row.note,
    publishedAt: row.publishedAt.toISOString(),
    learners,
  };
}
