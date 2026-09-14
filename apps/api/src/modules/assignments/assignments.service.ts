import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type AssignmentCreateInput,
  type AssignmentDetail,
  type AssignmentModuleView,
  type AssignmentProgressRow,
  type AssignmentPublicationRecord,
  type AssignmentPublishInput,
  type AssignmentSettings,
  type AssignmentStatus,
  type AssignmentStructureInput,
  type AssignmentSummary,
  type Paginated,
  type QuestionDifficulty,
  type QuestionType,
  type UnlockRule,
  assignmentSettingsSchema,
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
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { NotificationsService } from '../notifications/index.js';
import { QuestionsService } from '../questions/index.js';

interface ListQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: AssignmentStatus;
  subject?: string;
  batchId?: string;
}

/** Negative positions used while a structure is reordered, to clear the unique index. */
const REORDER_OFFSET = -100_000;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

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
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.batchId
        ? { publications: { some: { batchId: query.batchId, withdrawnAt: null } } }
        : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.assignment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
        include: ASSIGNMENT_INCLUDE,
      }),
      this.prisma.assignment.count({ where }),
    ]);
    return paginate(rows.map(toSummary), total, query);
  }

  async get(id: string, user: AuthUser): Promise<AssignmentDetail> {
    const assignment = await this.findForStaff(id, user);
    const modules = await this.loadModules(id);
    return {
      ...toSummary(assignment),
      modules: modules.map<AssignmentModuleView>((module) => ({
        id: module.id,
        title: module.title,
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
        })),
      })),
    };
  }

  async create(input: AssignmentCreateInput, user: AuthUser): Promise<AssignmentSummary> {
    const org = await this.tenant.getOrganization();
    const assignment = await this.prisma.assignment.create({
      data: {
        organizationId: org.id,
        title: input.title,
        description: input.description,
        subject: input.subject,
        difficulty: input.difficulty,
        settings: asJson(input.settings),
        createdById: user.id,
      },
      include: ASSIGNMENT_INCLUDE,
    });
    await this.audit.record({
      action: 'assignment.created',
      resourceType: 'assignment',
      resourceId: assignment.id,
      summary: `Assignment "${assignment.title}" created`,
      after: { subject: assignment.subject },
    });
    return toSummary(assignment);
  }

  async update(
    id: string,
    input: Partial<AssignmentCreateInput>,
    user: AuthUser,
  ): Promise<AssignmentSummary> {
    const assignment = await this.findForStaff(id, user);
    const updated = await this.prisma.assignment.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.subject === undefined ? {} : { subject: input.subject }),
        ...(input.difficulty === undefined ? {} : { difficulty: input.difficulty }),
        ...(input.settings === undefined ? {} : { settings: asJson(input.settings) }),
      },
      include: ASSIGNMENT_INCLUDE,
    });
    await this.audit.record({
      action: 'assignment.updated',
      resourceType: 'assignment',
      resourceId: id,
      summary: `Assignment "${updated.title}" updated`,
      before: { title: assignment.title },
      after: { title: updated.title },
    });
    return toSummary(updated);
  }

  /**
   * Replaces the structure. Modules and placed questions that keep their id keep the submissions
   * made against them; anything the author removed takes its submissions with it, which is why a
   * question already answered cannot simply be dropped without saying so.
   */
  async saveStructure(
    id: string,
    input: AssignmentStructureInput,
    user: AuthUser,
  ): Promise<AssignmentDetail> {
    const assignment = await this.findForStaff(id, user);
    const questionIds = input.modules.flatMap((m) => m.questions.map((q) => q.questionId));
    const pickable = await this.questions.pickable(questionIds);
    const missing = questionIds.filter((questionId) => !pickable.has(questionId));
    if (missing.length > 0) {
      throw new ValidationError([
        {
          path: 'modules',
          message: `${missing.length} question(s) are not published and cannot be used`,
        },
      ]);
    }

    const existing = await this.prisma.assignmentModule.findMany({
      where: { assignmentId: id },
      include: { questions: { select: { id: true } } },
    });
    const keptModules = new Set(input.modules.map((m) => m.id).filter(Boolean) as string[]);
    const knownModules = new Set(existing.map((m) => m.id));
    for (const moduleId of keptModules) {
      if (!knownModules.has(moduleId)) throw new NotFoundError('Module');
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
        const moduleId = moduleInput.id
          ? (
              await tx.assignmentModule.update({
                where: { id: moduleInput.id },
                data: {
                  title: moduleInput.title,
                  position: moduleIndex,
                  unlockRule: asJson(moduleInput.unlockRule),
                },
              })
            ).id
          : (
              await tx.assignmentModule.create({
                data: {
                  assignmentId: id,
                  title: moduleInput.title,
                  position: moduleIndex,
                  unlockRule: asJson(moduleInput.unlockRule),
                },
              })
            ).id;

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

  async archive(id: string, user: AuthUser): Promise<{ withdrawn: number }> {
    const assignment = await this.findForStaff(id, user);
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
    const rows = await this.prisma.assignmentPublication.findMany({
      where: { assignmentId: id, withdrawnAt: null },
      orderBy: { publishedAt: 'desc' },
      include: { batch: { select: { code: true, name: true } } },
    });
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        batchId: row.batchId,
        batchCode: row.batch.code,
        batchName: row.batch.name,
        dueAt: row.dueAt?.toISOString() ?? null,
        note: row.note,
        publishedAt: row.publishedAt.toISOString(),
        learners: await this.prisma.batchMember.count({
          where: { batchId: row.batchId, isActive: true },
        }),
      })),
    );
  }

  async publish(
    id: string,
    input: AssignmentPublishInput,
    user: AuthUser,
  ): Promise<AssignmentPublicationRecord> {
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
    await this.requireBatchScope(input.batchId, user, 'assignments:publish');
    const live = await this.prisma.assignmentPublication.findFirst({
      where: { assignmentId: id, batchId: input.batchId, withdrawnAt: null },
    });
    if (live)
      throw new ConflictError('That batch already has this assignment', 'already_published');

    const batch = await this.prisma.batch.findUniqueOrThrow({
      where: { id: input.batchId },
      select: { code: true, name: true },
    });
    const publication = await this.prisma.assignmentPublication.create({
      data: {
        assignmentId: id,
        batchId: input.batchId,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        note: input.note,
        publishedById: user.id,
      },
    });
    await this.prisma.assignment.update({ where: { id }, data: { status: 'published' } });

    const members = await this.prisma.batchMember.findMany({
      where: { batchId: input.batchId, isActive: true },
      select: { student: { select: { userId: true } } },
    });
    if (members.length > 0) {
      await this.notifications.deliver({
        category: 'assessment',
        type: 'assignment.published',
        title: `New assignment: ${assignment.title}`,
        body: input.dueAt
          ? `Due by ${new Date(input.dueAt).toLocaleDateString()}.`
          : 'It is in your assignments now.',
        link: `/assignments/${id}`,
        channels: ['in_app'],
        userIds: members.map((m) => m.student.userId),
      });
    }

    await this.audit.record({
      action: 'assignment.published',
      resourceType: 'assignment',
      resourceId: id,
      summary: `${assignment.title} published to ${batch.code} (${members.length} learners)`,
      after: { batchId: input.batchId, dueAt: input.dueAt },
    });
    this.events.emit('assignment.published', { assignmentId: id, batchId: input.batchId });

    return {
      id: publication.id,
      batchId: input.batchId,
      batchCode: batch.code,
      batchName: batch.name,
      dueAt: publication.dueAt?.toISOString() ?? null,
      note: publication.note,
      publishedAt: publication.publishedAt.toISOString(),
      learners: members.length,
    };
  }

  async withdraw(id: string, publicationId: string, user: AuthUser): Promise<void> {
    const assignment = await this.findForStaff(id, user);
    const publication = await this.prisma.assignmentPublication.findFirst({
      where: { id: publicationId, assignmentId: id, withdrawnAt: null },
    });
    if (!publication) throw new NotFoundError('Publication');
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
      summary: `${assignment.title} withdrawn from a batch`,
      before: { batchId: publication.batchId },
    });
  }

  // ───────────────────────── staff views ─────────────────────────

  /** One row per learner the assignment reaches: how many they solved and what they scored. */
  async progress(
    id: string,
    query: { batchId?: string },
    user: AuthUser,
  ): Promise<AssignmentProgressRow[]> {
    await this.findForStaff(id, user);
    const publications = await this.prisma.assignmentPublication.findMany({
      where: {
        assignmentId: id,
        withdrawnAt: null,
        ...(query.batchId ? { batchId: query.batchId } : {}),
      },
      select: { batchId: true },
    });
    const batchIds = publications.map((p) => p.batchId);
    if (batchIds.length === 0) return [];

    const members = await this.prisma.batchMember.findMany({
      where: { batchId: { in: batchIds }, isActive: true },
      include: {
        batch: { select: { code: true } },
        student: { include: { user: { select: { name: true } } } },
      },
    });
    const placements = await this.prisma.assignmentQuestion.findMany({
      where: { module: { assignmentId: id } },
      select: { id: true, marks: true },
    });
    const totalMarks = placements.reduce((n, p) => n + p.marks, 0);

    const submissions = await this.prisma.submission.findMany({
      where: { assignmentId: id, studentId: { in: members.map((m) => m.studentId) } },
      orderBy: { submittedAt: 'desc' },
    });

    return members.map((member) => {
      const mine = submissions.filter((s) => s.studentId === member.studentId);
      const best = bestPerQuestion(mine);
      return {
        studentId: member.studentId,
        studentCode: member.student.studentCode,
        name: member.student.user.name,
        batchCode: member.batch.code,
        solved: [...best.values()].filter((s) => s.status === 'correct' || s.status === 'partial')
          .length,
        questionCount: placements.length,
        awardedMarks: [...best.values()].reduce((n, s) => n + Number(s.marks), 0),
        totalMarks,
        lastActivityAt: mine[0]?.submittedAt.toISOString() ?? null,
      };
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

  settingsOf(assignment: { settings: unknown }): AssignmentSettings {
    const parsed = assignmentSettingsSchema.safeParse(assignment.settings ?? {});
    return parsed.success
      ? parsed.data
      : { attemptsPerQuestion: 3, explanationPolicy: 'after_solve', duePolicy: 'allow_late' };
  }

  /** Assignment ids a batch-scoped caller may act on; null when unrestricted. */
  async visibleAssignmentIds(user: AuthUser): Promise<string[] | null> {
    const batchIds = await this.scope.visibleBatchIds(user, 'assignments:manage');
    if (batchIds === null) return null;
    const rows = await this.prisma.assignmentPublication.findMany({
      where: { batchId: { in: batchIds }, withdrawnAt: null },
      select: { assignmentId: true },
    });
    // A batch-scoped author also sees what they wrote but have not published yet.
    const own = await this.prisma.assignment.findMany({
      where: { createdById: user.id, deletedAt: null },
      select: { id: true },
    });
    return [...new Set([...rows.map((r) => r.assignmentId), ...own.map((r) => r.id)])];
  }

  async findForStaff(id: string, user: AuthUser) {
    const org = await this.tenant.getOrganization();
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, organizationId: org.id, deletedAt: null },
      include: ASSIGNMENT_INCLUDE,
    });
    if (!assignment) throw new NotFoundError('Assignment');
    const visible = await this.visibleAssignmentIds(user);
    if (visible !== null && !visible.includes(id)) {
      throw new ForbiddenError('That assignment belongs to batches you do not teach');
    }
    return assignment;
  }

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
}

const ASSIGNMENT_INCLUDE = {
  modules: {
    include: { _count: { select: { questions: true } }, questions: { select: { marks: true } } },
  },
  _count: { select: { publications: { where: { withdrawnAt: null } } } },
} as const;

/** The best attempt a learner made at each question. */
export function bestPerQuestion<
  T extends { assignmentQuestionId: string; marks: unknown; status: string },
>(submissions: T[]): Map<string, T> {
  const best = new Map<string, T>();
  for (const submission of submissions) {
    const current = best.get(submission.assignmentQuestionId);
    if (!current || Number(submission.marks) > Number(current.marks)) {
      best.set(submission.assignmentQuestionId, submission);
    }
  }
  return best;
}

function toSummary(row: {
  id: string;
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  status: string;
  settings: unknown;
  createdAt: Date;
  modules: { questions: { marks: number }[] }[];
  _count: { publications: number };
}): AssignmentSummary {
  const questions = row.modules.flatMap((m) => m.questions);
  const parsed = assignmentSettingsSchema.safeParse(row.settings ?? {});
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    difficulty: row.difficulty,
    status: row.status as AssignmentStatus,
    moduleCount: row.modules.length,
    questionCount: questions.length,
    totalMarks: questions.reduce((n, q) => n + q.marks, 0),
    publicationCount: row._count.publications,
    settings: parsed.success
      ? parsed.data
      : { attemptsPerQuestion: 3, explanationPolicy: 'after_solve', duePolicy: 'allow_late' },
    createdAt: row.createdAt.toISOString(),
  };
}
