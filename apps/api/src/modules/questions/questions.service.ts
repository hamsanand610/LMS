import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type ExecutionLanguage,
  type Paginated,
  type QuestionCreateInput,
  type QuestionDetail,
  type QuestionDifficulty,
  type QuestionOptionView,
  type QuestionStatus,
  type QuestionSummary,
  type QuestionType,
  type QuestionValidation,
  type QuestionVersionRecord,
  slugify,
  uniqueSlug,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission, scopeFor } from '../../core/auth/auth-user.js';
import {
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { Prisma } from '../../generated/prisma/client.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { ExecutionService } from '../execution/index.js';
import { TaxonomiesService } from '../settings/taxonomies.service.js';

interface ListQuery {
  page: number;
  pageSize: number;
  q?: string;
  type?: QuestionType;
  subject?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  status?: QuestionStatus;
  author?: string;
  tag?: string;
}

/** What a question looks like in the bank, and who may change it. */
@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly execution: ExecutionService,
    private readonly taxonomies: TaxonomiesService,
  ) {}

  async list(query: ListQuery, user: AuthUser): Promise<Paginated<QuestionSummary>> {
    const org = await this.tenant.getOrganization();
    const where = {
      organizationId: org.id,
      deletedAt: null,
      ...this.authorFilter(query.author, user),
      ...(query.type ? { type: query.type } : {}),
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.topic ? { topic: query.topic } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              { body: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
        include: QUESTION_COUNTS,
      }),
      this.prisma.question.count({ where }),
    ]);
    return paginate(rows.map(toSummary), total, query);
  }

  /**
   * One question. `forLearner` strips everything that would give the answer away: which option is
   * correct, the explanations, the hidden test cases and the reference solution.
   */
  async get(id: string, user: AuthUser, forLearner = false): Promise<QuestionDetail> {
    const question = await this.find(id);
    if (!forLearner) this.requireReadable(question, user);
    const options = await this.prisma.questionOption.findMany({
      where: { questionId: id },
      orderBy: { position: 'asc' },
    });
    const coding = await this.prisma.codingProblem.findUnique({
      where: { questionId: id },
      include: { testCases: { orderBy: { position: 'asc' } } },
    });

    return {
      ...toSummary({ ...question, _count: (await this.usageCount(id))._count }),
      body: question.body,
      negativeMarks: Number(question.negativeMarks),
      explanation: forLearner ? '' : question.explanation,
      rubric: forLearner ? '' : question.rubric,
      options: options.map<QuestionOptionView>((option) => ({
        id: option.id,
        body: option.body,
        position: option.position,
        ...(forLearner ? {} : { isCorrect: option.isCorrect, explanation: option.explanation }),
      })),
      coding: coding
        ? {
            languages: coding.languages as ExecutionLanguage[],
            starterCode: coding.starterCode as Record<string, string>,
            ...(forLearner
              ? {}
              : { referenceSolution: coding.referenceSolution as Record<string, string> }),
            timeLimitMs: coding.timeLimitMs,
            memoryLimitMb: coding.memoryLimitMb,
            testCases: coding.testCases.map((testCase) => ({
              id: testCase.id,
              isSample: testCase.isSample,
              weight: testCase.weight,
              // A hidden case is counted, never shown, whoever is asking.
              ...(testCase.isSample
                ? { input: testCase.input, expectedOutput: testCase.expectedOutput }
                : {}),
            })),
          }
        : null,
      validation: (question.validation as QuestionValidation | null) ?? null,
    };
  }

  async create(input: QuestionCreateInput, user: AuthUser): Promise<QuestionSummary> {
    const org = await this.tenant.getOrganization();
    await this.checkTerms(input);
    const taken = new Set(
      (await this.prisma.question.findMany({ select: { slug: true } })).map((q) => q.slug),
    );
    const question = await this.prisma.question.create({
      data: {
        organizationId: org.id,
        slug: uniqueSlug(slugify(input.title), taken),
        title: input.title,
        body: input.body,
        type: input.type,
        subject: input.subject,
        topic: input.topic,
        difficulty: input.difficulty,
        marks: input.marks,
        negativeMarks: input.negativeMarks,
        explanation: input.explanation,
        rubric: input.rubric,
        tags: input.tags,
        authorId: user.id,
        options: {
          create: input.options.map((option, position) => ({
            body: option.body,
            isCorrect: option.isCorrect,
            explanation: option.explanation,
            position,
          })),
        },
        ...(input.coding
          ? {
              coding: {
                create: {
                  languages: input.coding.languages,
                  starterCode: asJson(input.coding.starterCode),
                  referenceSolution: asJson(input.coding.referenceSolution),
                  timeLimitMs: input.coding.timeLimitMs,
                  memoryLimitMb: input.coding.memoryLimitMb,
                  testCases: {
                    create: input.coding.testCases.map((testCase, position) => ({
                      input: testCase.input,
                      expectedOutput: testCase.expectedOutput,
                      isSample: testCase.isSample,
                      weight: testCase.weight,
                      position,
                    })),
                  },
                },
              },
            }
          : {}),
      },
      include: QUESTION_COUNTS,
    });

    await this.snapshot(question.id, user.id, 'Created');
    await this.audit.record({
      action: 'question.created',
      resourceType: 'question',
      resourceId: question.id,
      summary: `Question "${question.title}" created`,
      after: { type: question.type, subject: question.subject, marks: question.marks },
    });
    return toSummary(question);
  }

  /** A saved question keeps its type: a paper that used it must stay meaningful. */
  async update(id: string, input: QuestionCreateInput, user: AuthUser): Promise<QuestionSummary> {
    const question = await this.find(id);
    this.requireEditable(question, user);
    if (question.type !== input.type) {
      throw new DomainRuleError(
        'The type of a saved question cannot change; write a new one instead',
        'question_type_locked',
      );
    }
    await this.checkTerms(input);

    await this.prisma.$transaction(async (tx) => {
      await tx.questionOption.deleteMany({ where: { questionId: id } });
      await tx.question.update({
        where: { id },
        data: {
          title: input.title,
          body: input.body,
          subject: input.subject,
          topic: input.topic,
          difficulty: input.difficulty,
          marks: input.marks,
          negativeMarks: input.negativeMarks,
          explanation: input.explanation,
          rubric: input.rubric,
          tags: input.tags,
          version: { increment: 1 },
          // Any edit invalidates the last validation run.
          ...(input.coding ? { validation: Prisma.DbNull } : {}),
          options: {
            create: input.options.map((option, position) => ({
              body: option.body,
              isCorrect: option.isCorrect,
              explanation: option.explanation,
              position,
            })),
          },
        },
      });
      if (input.coding) {
        await tx.codingProblem.deleteMany({ where: { questionId: id } });
        await tx.codingProblem.create({
          data: {
            questionId: id,
            languages: input.coding.languages,
            starterCode: asJson(input.coding.starterCode),
            referenceSolution: asJson(input.coding.referenceSolution),
            timeLimitMs: input.coding.timeLimitMs,
            memoryLimitMb: input.coding.memoryLimitMb,
            testCases: {
              create: input.coding.testCases.map((testCase, position) => ({
                input: testCase.input,
                expectedOutput: testCase.expectedOutput,
                isSample: testCase.isSample,
                weight: testCase.weight,
                position,
              })),
            },
          },
        });
      }
    });

    // Snapshotted after the change, so each row is the question as it was at that version.
    await this.snapshot(id, user.id, 'Edited');
    await this.audit.record({
      action: 'question.updated',
      resourceType: 'question',
      resourceId: id,
      summary: `Question "${input.title}" updated`,
      before: { title: question.title, marks: question.marks },
      after: { title: input.title, marks: input.marks },
    });
    const updated = await this.prisma.question.findUniqueOrThrow({
      where: { id },
      include: QUESTION_COUNTS,
    });
    return toSummary(updated);
  }

  /**
   * Publishing is what makes a question usable in an assignment or a test. A coding question must
   * have passed its own reference solution first, which is what stops a broken problem reaching
   * a learner.
   */
  async setStatus(id: string, status: QuestionStatus, user: AuthUser): Promise<QuestionSummary> {
    const question = await this.find(id);
    this.requireEditable(question, user);

    if (status === 'published' && question.type === 'coding') {
      const validation = question.validation as QuestionValidation | null;
      if (!validation?.ok) {
        throw new DomainRuleError(
          'Validate the reference solution before publishing this coding question',
          'question_not_validated',
        );
      }
    }
    if (status === 'retired') {
      const inUse = await this.usageCount(id);
      if (inUse._count.uses > 0) {
        // Retiring is allowed: papers already built keep the question. It only leaves the pickers.
        await this.audit.record({
          action: 'question.retired_in_use',
          resourceType: 'question',
          resourceId: id,
          summary: `Retired while used by ${inUse._count.uses} paper(s)`,
        });
      }
    }

    const updated = await this.prisma.question.update({
      where: { id },
      data: { status },
      include: QUESTION_COUNTS,
    });
    await this.audit.record({
      action: `question.${status}`,
      resourceType: 'question',
      resourceId: id,
      summary: `Question "${question.title}" is now ${status}`,
      before: { status: question.status },
      after: { status },
    });
    if (status === 'published') this.events.emit('question.published', { questionId: id });
    if (status === 'retired') this.events.emit('question.retired', { questionId: id });
    return toSummary(updated);
  }

  /** Runs the question's own reference solution against its cases. */
  async validate(id: string, user: AuthUser): Promise<QuestionValidation> {
    const question = await this.find(id);
    this.requireEditable(question, user);
    if (question.type !== 'coding') {
      throw new DomainRuleError('Only a coding question is validated', 'not_a_coding_question');
    }
    const result = await this.execution.validateReferenceSolution(id);
    if (!result) {
      throw new DomainRuleError(
        'The configured driver runs in the browser, so validation has to be run from the editor',
        'validation_needs_client',
      );
    }
    await this.prisma.question.update({ where: { id }, data: { validation: asJson(result) } });
    await this.audit.record({
      action: 'question.validated',
      resourceType: 'question',
      resourceId: id,
      summary: result.ok ? 'Reference solution passes' : 'Reference solution failed',
      after: { ok: result.ok, driver: result.driver },
    });
    return result;
  }

  /** Stores what an author's browser reported when it ran the reference solution. */
  async recordValidation(
    id: string,
    result: QuestionValidation,
    user: AuthUser,
  ): Promise<QuestionValidation> {
    const question = await this.find(id);
    this.requireEditable(question, user);
    const stored: QuestionValidation = {
      ...result,
      driver: this.execution.driverName,
      trust: this.execution.trust,
      validatedAt: new Date().toISOString(),
    };
    await this.prisma.question.update({ where: { id }, data: { validation: asJson(stored) } });
    await this.audit.record({
      action: 'question.validated',
      resourceType: 'question',
      resourceId: id,
      summary: `${stored.ok ? 'Passes' : 'Fails'} in the ${stored.driver} driver`,
      after: { ok: stored.ok, trust: stored.trust },
    });
    return stored;
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const question = await this.find(id);
    this.requireEditable(question, user);
    const usage = await this.usageCount(id);
    if (usage._count.uses > 0) {
      throw new DomainRuleError(
        `${usage._count.uses} assignment(s) or test(s) use this question; retire it instead`,
        'question_in_use',
      );
    }
    await this.prisma.question.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      action: 'question.deleted',
      resourceType: 'question',
      resourceId: id,
      summary: `Question "${question.title}" deleted`,
    });
  }

  async versions(id: string, user: AuthUser): Promise<QuestionVersionRecord[]> {
    const question = await this.find(id);
    this.requireReadable(question, user);
    const rows = await this.prisma.questionVersion.findMany({
      where: { questionId: id },
      orderBy: { version: 'desc' },
      take: 50,
    });
    return rows.map((row) => ({
      version: row.version,
      changedBy: row.changedById,
      changedAt: row.changedAt.toISOString(),
      summary: row.summary,
    }));
  }

  /** Puts a published coding question in the practice catalogue, or takes it out. */
  async setPractice(
    id: string,
    input: { inCatalogue: boolean; points: number },
    user: AuthUser,
  ): Promise<QuestionSummary> {
    const question = await this.find(id);
    this.requireEditable(question, user);
    if (input.inCatalogue && question.type !== 'coding') {
      throw new DomainRuleError(
        'Only a coding question can appear in the practice catalogue',
        'not_a_coding_question',
      );
    }
    if (input.inCatalogue && question.status !== 'published') {
      throw new DomainRuleError(
        'Publish the question before putting it in the practice catalogue',
        'question_not_published',
      );
    }
    const updated = await this.prisma.question.update({
      where: { id },
      data: { inPractice: input.inCatalogue, practicePoints: input.points },
      include: QUESTION_COUNTS,
    });
    await this.audit.record({
      action: 'question.practice_changed',
      resourceType: 'question',
      resourceId: id,
      summary: input.inCatalogue ? 'Added to practice' : 'Removed from practice',
      after: { inPractice: input.inCatalogue, points: input.points },
    });
    return toSummary(updated);
  }

  // ───────────────────────── shared helpers ─────────────────────────

  /** Questions an assignment or a test may use: published, and visible to the caller. */
  async pickable(ids: string[]): Promise<Map<string, { marks: number; type: QuestionType }>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.question.findMany({
      where: { id: { in: ids }, deletedAt: null, status: 'published' },
      select: { id: true, marks: true, type: true },
    });
    return new Map(rows.map((row) => [row.id, { marks: row.marks, type: row.type }]));
  }

  async find(id: string) {
    const org = await this.tenant.getOrganization();
    const question = await this.prisma.question.findFirst({
      where: { id, organizationId: org.id, deletedAt: null },
    });
    if (!question) throw new NotFoundError('Question');
    return question;
  }

  private async usageCount(id: string) {
    const [assignments, tests] = await Promise.all([
      this.prisma.assignmentQuestion.count({ where: { questionId: id } }),
      this.prisma.testQuestion.count({ where: { questionId: id } }),
    ]);
    return { _count: { uses: assignments + tests } };
  }

  private authorFilter(author: string | undefined, user: AuthUser) {
    // Someone who only holds `questions:create_own` sees their own work, whatever they ask for.
    if (!hasPermission(user, 'questions:manage')) return { authorId: user.id };
    if (author === 'me') return { authorId: user.id };
    return {};
  }

  private requireReadable(question: { authorId: string | null }, user: AuthUser): void {
    if (hasPermission(user, 'questions:manage')) return;
    if (scopeFor(user, 'questions:read') === 'all') return;
    if (question.authorId === user.id) return;
    throw new ForbiddenError('That question was written by somebody else');
  }

  private requireEditable(question: { authorId: string | null }, user: AuthUser): void {
    if (hasPermission(user, 'questions:manage')) return;
    if (hasPermission(user, 'questions:create_own') && question.authorId === user.id) return;
    throw new ForbiddenError('You can only edit the questions you wrote');
  }

  private async checkTerms(input: QuestionCreateInput): Promise<void> {
    const issues: { path: string; message: string }[] = [];
    if (input.subject && !(await this.taxonomies.isValid('subject', input.subject))) {
      issues.push({ path: 'subject', message: `"${input.subject}" is not one of the subjects` });
    }
    if (input.topic && !(await this.taxonomies.isValid('topic', input.topic))) {
      issues.push({ path: 'topic', message: `"${input.topic}" is not one of the topics` });
    }
    if (issues.length > 0) throw new ValidationError(issues);
  }

  /** Records the question as it stands, under its current version number. */
  private async snapshot(id: string, userId: string | null, summary: string): Promise<void> {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        options: { orderBy: { position: 'asc' } },
        coding: { include: { testCases: { orderBy: { position: 'asc' } } } },
      },
    });
    if (!question) return;
    await this.prisma.questionVersion.upsert({
      where: { questionId_version: { questionId: id, version: question.version } },
      create: {
        questionId: id,
        version: question.version,
        snapshot: asJson(JSON.parse(JSON.stringify(question)) as Record<string, unknown>),
        summary,
        changedById: userId,
      },
      update: {
        snapshot: asJson(JSON.parse(JSON.stringify(question)) as Record<string, unknown>),
        summary,
        changedById: userId,
      },
    });
  }
}

const QUESTION_COUNTS = {
  author: { select: { name: true } },
  _count: { select: { assignmentQuestions: true, testQuestions: true } },
} as const;

function toSummary(row: {
  id: string;
  title: string;
  type: string;
  subject: string;
  topic: string;
  difficulty: string;
  marks: number;
  status: string;
  version: number;
  tags: string[];
  authorId: string | null;
  createdAt: Date;
  author?: { name: string } | null;
  _count: { assignmentQuestions?: number; testQuestions?: number; uses?: number };
}): QuestionSummary {
  return {
    id: row.id,
    title: row.title,
    type: row.type as QuestionType,
    subject: row.subject,
    topic: row.topic,
    difficulty: row.difficulty as QuestionDifficulty,
    marks: row.marks,
    status: row.status as QuestionStatus,
    version: row.version,
    tags: row.tags,
    authorId: row.authorId,
    authorName: row.author?.name ?? null,
    usageCount:
      row._count.uses ?? (row._count.assignmentQuestions ?? 0) + (row._count.testQuestions ?? 0),
    createdAt: row.createdAt.toISOString(),
  };
}
