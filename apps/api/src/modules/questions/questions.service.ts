import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EXECUTED_TYPES,
  LAB_ONLY_TYPES,
  WEB_CHECK_PASS,
  questionSpecSchema,
  type CodingProblemInput,
  type CompareMode,
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
   * correct, the explanations, the rubric, the hidden test cases, the SQL setup and the reference
   * solution. Staff who may read the question see all of it, hidden cases included, so the editor
   * can show and save them.
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
      hints: question.hints,
      spec: parseSpec(question.spec),
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
            inputFormat: coding.inputFormat,
            outputFormat: coding.outputFormat,
            constraints: coding.constraints,
            expectedBehaviour: coding.expectedBehaviour,
            compareMode: coding.compareMode as CompareMode,
            ...(forLearner ? {} : { setupSql: coding.setupSql, sqlCheck: coding.sqlCheck }),
            testCases: coding.testCases
              // A learner never learns a hidden case exists beyond the count, nor sees a disabled one.
              .filter((testCase) => !forLearner || (testCase.enabled && testCase.isSample))
              .map((testCase) => ({
                id: testCase.id,
                isSample: testCase.isSample,
                weight: testCase.weight,
                label: testCase.label,
                enabled: testCase.enabled,
                timeLimitMs: testCase.timeLimitMs,
                memoryLimitMb: testCase.memoryLimitMb,
                input: testCase.input,
                expectedOutput: testCase.expectedOutput,
                explanation: testCase.explanation,
              })),
          }
        : null,
      validation: (question.validation as QuestionValidation | null) ?? null,
      practice: forLearner
        ? null
        : { inCatalogue: question.inPractice, points: question.practicePoints },
    };
  }

  async create(input: QuestionCreateInput, user: AuthUser): Promise<QuestionSummary> {
    const org = await this.tenant.getOrganization();
    await this.checkTerms(input);
    // `/labs/playground` is the playground's own address, so no lab may take that slug.
    const taken = new Set([
      'playground',
      ...(await this.prisma.question.findMany({ select: { slug: true } })).map((q) => q.slug),
    ]);
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
        hints: input.hints,
        spec: asJson(input.spec),
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
                  ...problemFields(input.coding),
                  testCases: {
                    create: input.coding.testCases.map((testCase, position) =>
                      caseFields(testCase, position, input.type),
                    ),
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
      // Options keep their ids across edits too: answers already given store the ids chosen, so a
      // reworded option must still be the one they picked. Removed options go; new ones are added.
      const knownOptions = new Set(
        (await tx.questionOption.findMany({ where: { questionId: id }, select: { id: true } })).map(
          (o) => o.id,
        ),
      );
      const keptOptions = input.options
        .map((o) => o.id)
        .filter((optionId): optionId is string => Boolean(optionId && knownOptions.has(optionId)));
      await tx.questionOption.deleteMany({
        where: { questionId: id, id: { notIn: [...keptOptions, ZERO_UUID] } },
      });
      for (const [index, optionId] of keptOptions.entries()) {
        await tx.questionOption.update({
          where: { id: optionId },
          data: { position: -100_000 + index },
        });
      }
      for (const [position, option] of input.options.entries()) {
        const data = {
          body: option.body,
          isCorrect: option.isCorrect,
          explanation: option.explanation,
          position,
        };
        if (option.id && knownOptions.has(option.id)) {
          await tx.questionOption.update({ where: { id: option.id }, data });
        } else {
          await tx.questionOption.create({ data: { questionId: id, ...data } });
        }
      }
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
          hints: input.hints,
          spec: asJson(input.spec),
          tags: input.tags,
          version: { increment: 1 },
          // Any edit invalidates the last validation run.
          ...(input.coding ? { validation: Prisma.DbNull } : {}),
        },
      });
      if (input.coding) {
        const problem = await tx.codingProblem.upsert({
          where: { questionId: id },
          create: { questionId: id, ...problemFields(input.coding) },
          update: problemFields(input.coding),
        });
        // Cases keep their ids across edits, so the results already recorded against them still
        // name the right case. Cases the author removed go; new ones are added.
        const existing = await tx.testCase.findMany({
          where: { problemId: problem.id },
          select: { id: true },
        });
        const known = new Set(existing.map((c) => c.id));
        const kept = input.coding.testCases
          .map((c) => c.id)
          .filter((caseId): caseId is string => Boolean(caseId && known.has(caseId)));
        await tx.testCase.deleteMany({
          where: { problemId: problem.id, id: { notIn: [...kept, ZERO_UUID] } },
        });
        // Park the kept rows out of the way of the (problem, position) index while they move.
        for (const [index, caseId] of kept.entries()) {
          await tx.testCase.update({ where: { id: caseId }, data: { position: -100_000 + index } });
        }
        for (const [position, testCase] of input.coding.testCases.entries()) {
          if (testCase.id && known.has(testCase.id)) {
            await tx.testCase.update({
              where: { id: testCase.id },
              data: caseFields(testCase, position, input.type),
            });
          } else {
            await tx.testCase.create({
              data: { problemId: problem.id, ...caseFields(testCase, position, input.type) },
            });
          }
        }
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

    if (status === 'published' && EXECUTED_TYPES.includes(question.type)) {
      const validation = question.validation as QuestionValidation | null;
      if (!validation?.ok) {
        throw new DomainRuleError(
          'Check the reference solution against the test cases before publishing this question',
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
    if (!EXECUTED_TYPES.includes(question.type)) {
      throw new DomainRuleError(
        'Only a coding, SQL, debugging or web question has a reference solution to check',
        'not_a_coding_question',
      );
    }
    const result = await this.execution.validateReferenceSolution(id);
    if (!result) {
      throw new DomainRuleError(
        'Code cannot be run right now, so the reference solution could not be checked. Try again shortly.',
        'execution_unavailable',
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

  /**
   * Puts a published lab in the Labs catalogue, or takes it out. Whoever manages the catalogue may
   * do it for any question they may edit; an author with `practice:publish_own`, for their own.
   */
  async setPractice(
    id: string,
    input: { inCatalogue: boolean; points: number },
    user: AuthUser,
  ): Promise<QuestionSummary> {
    const question = await this.find(id);
    this.requireEditable(question, user);
    const ownLab = hasPermission(user, 'practice:publish_own') && question.authorId === user.id;
    if (!hasPermission(user, 'practice:manage') && !ownLab) {
      throw new ForbiddenError('You can only put the labs you wrote in the catalogue');
    }
    if (input.inCatalogue && !EXECUTED_TYPES.includes(question.type)) {
      throw new DomainRuleError(
        'Only a lab (a coding, SQL, debugging or web question) can appear in the Labs catalogue',
        'not_a_coding_question',
      );
    }
    if (input.inCatalogue && question.status !== 'published') {
      throw new DomainRuleError(
        'Publish the question before putting it in the Labs catalogue',
        'question_not_published',
      );
    }
    // Learners only ever see a lab that passes its own check (ADR-0018), so it is listed only then.
    if (input.inCatalogue && (question.validation as { ok?: unknown } | null)?.ok !== true) {
      throw new DomainRuleError(
        'Run the check first: a lab is listed only once its reference solution passes',
        'question_not_validated',
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
      summary: input.inCatalogue
        ? 'Added to the Labs catalogue'
        : 'Removed from the Labs catalogue',
      after: { inPractice: input.inCatalogue, points: input.points },
    });
    return toSummary(updated);
  }

  // ───────────────────────── shared helpers ─────────────────────────

  /**
   * Questions an assignment or a test may use: published, and readable by the caller. Someone who
   * reads only their own questions uses only their own: putting another author's question on a
   * paper would show them its answer key and hidden cases in the staff views.
   */
  async pickable(
    ids: string[],
    user: AuthUser,
  ): Promise<Map<string, { marks: number; type: QuestionType }>> {
    if (ids.length === 0) return new Map();
    const org = await this.tenant.getOrganization();
    const readsAll =
      hasPermission(user, 'questions:manage') || scopeFor(user, 'questions:read') === 'all';
    const rows = await this.prisma.question.findMany({
      where: {
        id: { in: ids },
        organizationId: org.id,
        deletedAt: null,
        status: 'published',
        ...(readsAll ? {} : { authorId: user.id }),
      },
      select: { id: true, marks: true, type: true },
    });
    // Debugging and web questions belong to the Labs until Roadmap Phase 3 gives them a workspace in
    // assignments and tests (ADR-0018); offering one here would leave a learner with no way to answer.
    const labOnly = rows.filter((row) => LAB_ONLY_TYPES.includes(row.type));
    if (labOnly.length > 0) {
      throw new ValidationError([
        {
          path: 'questions',
          message: `${labOnly.length} question(s) are debugging or web labs, which are used in the Labs only for now`,
        },
      ]);
    }
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

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/** A stored spec read defensively: a hand-edited row never breaks the page. */
function parseSpec(value: unknown) {
  const parsed = questionSpecSchema.safeParse(value ?? {});
  return parsed.success
    ? parsed.data
    : { fileKinds: [], maxFiles: 0, linkRequired: false, linkLabel: '', checklist: [] };
}

function problemFields(coding: CodingProblemInput) {
  return {
    languages: coding.languages,
    starterCode: asJson(coding.starterCode),
    referenceSolution: asJson(coding.referenceSolution),
    timeLimitMs: coding.timeLimitMs,
    memoryLimitMb: coding.memoryLimitMb,
    inputFormat: coding.inputFormat,
    outputFormat: coding.outputFormat,
    constraints: coding.constraints,
    expectedBehaviour: coding.expectedBehaviour,
    compareMode: coding.compareMode,
    setupSql: coding.setupSql,
    sqlCheck: coding.sqlCheck,
    // The schema browser is read again from the dataset, which may have changed (ADR-0020).
    sqlSchema: Prisma.DbNull,
  };
}

function caseFields(
  testCase: CodingProblemInput['testCases'][number],
  position: number,
  type: QuestionType,
) {
  return {
    input: testCase.input,
    // A web check prints `pass` when it holds (ADR-0019); that is all it can be compared with.
    expectedOutput: type === 'web' ? WEB_CHECK_PASS : testCase.expectedOutput,
    isSample: testCase.isSample,
    weight: testCase.weight,
    label: testCase.label,
    explanation: testCase.explanation,
    enabled: testCase.enabled,
    timeLimitMs: testCase.timeLimitMs,
    memoryLimitMb: testCase.memoryLimitMb,
    position,
  };
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
