import { Injectable } from '@nestjs/common';
import {
  LAB_TYPES,
  type ExecutionLanguage,
  type ExecutionVerdict,
  type LabAttemptRow,
  type LabRunView,
  type LabSummary,
  type LabType,
  type Paginated,
  type PracticeProblemDetail,
  type QuestionDifficulty,
  type QuestionStatus,
  type QuestionSummary,
  type QuestionValidation,
  type RunInput,
  type RunOutcome,
  type TrustLevel,
} from '@lms/shared';
import { type AuthUser, hasPermission, scopeFor } from '../../core/auth/auth-user.js';
import { ForbiddenError, NotFoundError } from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { ACCEPTED_PRACTICE_RUN } from '../execution/index.js';
import { QuestionsService } from '../questions/index.js';
import { PracticeService } from './practice.service.js';

interface LabListQuery {
  page: number;
  pageSize: number;
  q?: string;
  type?: LabType;
  status?: QuestionStatus;
  catalogue?: 'in' | 'out';
  author?: 'me';
}

interface AttemptQuery {
  page: number;
  pageSize: number;
  batchId?: string;
  status?: 'solved' | 'attempted';
}

/** Verdicts from best to worst, for "the best attempt" when none passed. */
const VERDICT_RANK: Record<string, number> = {
  passed: 0,
  wrong_answer: 1,
  failed: 2,
  runtime_error: 3,
  timeout: 4,
  memory_limit: 5,
  output_limit: 6,
  compile_error: 7,
  error: 8,
  pending: 9,
};

/**
 * Labs as staff see them (ADR-0018). An author sees and edits their own labs; whoever manages the
 * bank sees all of them; a reviewer (`practice:review`) also sees every published lab, read-only,
 * so they can follow their learners on labs others wrote. Attempts are visible only within the
 * reviewer's scope: a trainer sees the learners of their own batches, an administrator everyone. A
 * submission outside that scope is not found, so the API says nothing about learners a reviewer
 * may not see.
 */
@Injectable()
export class LabsStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
    private readonly questions: QuestionsService,
    private readonly practice: PracticeService,
  ) {}

  async list(query: LabListQuery, user: AuthUser): Promise<Paginated<LabSummary>> {
    const org = await this.tenant.getOrganization();
    const where = {
      organizationId: org.id,
      deletedAt: null,
      type: query.type ? query.type : { in: [...LAB_TYPES] },
      ...this.visibleTo(user, query.author === 'me'),
      ...(query.status ? { status: query.status } : {}),
      ...(query.catalogue ? { inPractice: query.catalogue === 'in' } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        ...skipTake(query),
        include: { author: { select: { name: true } } },
      }),
      this.prisma.question.count({ where }),
    ]);
    const ids = rows.map((r) => r.id);
    const [lessons, attempts] = await Promise.all([
      this.lessonCounts(ids),
      this.attemptStats(ids, user),
    ]);
    return paginate(
      rows.map((row) => ({
        questionId: row.id,
        slug: row.slug,
        title: row.title,
        type: row.type as LabType,
        difficulty: row.difficulty as QuestionDifficulty,
        topic: row.topic,
        status: row.status as QuestionStatus,
        version: row.version,
        validated: (row.validation as QuestionValidation | null)?.ok === true,
        inCatalogue: row.inPractice,
        points: row.practicePoints,
        authorId: row.authorId,
        authorName: row.author?.name ?? null,
        lessonCount: lessons.get(row.id) ?? 0,
        canEdit:
          hasPermission(user, 'questions:manage') ||
          (hasPermission(user, 'questions:create_own') && row.authorId === user.id),
        attempts: attempts
          ? (attempts.get(row.id) ?? { learners: 0, solved: 0, submissions: 0 })
          : null,
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      query,
    );
  }

  /** A lab exactly as a learner would see it, in whatever state it is. */
  async preview(questionId: string, user: AuthUser): Promise<PracticeProblemDetail> {
    const question = await this.readableLab(questionId, user);
    return this.practice.detail(question, user, true);
  }

  /** A run in the preview: the visible cases or the author's own input. Nothing is recorded. */
  async previewRun(questionId: string, input: RunInput, user: AuthUser): Promise<RunOutcome> {
    await this.readableLab(questionId, user);
    return this.practice.runQuestion(questionId, input, user);
  }

  /** Into the catalogue or out of it; QuestionsService decides who may. */
  setCatalogue(
    questionId: string,
    input: { inCatalogue: boolean; points: number },
    user: AuthUser,
  ): Promise<QuestionSummary> {
    return this.questions.setPractice(questionId, input, user);
  }

  /** The learners within scope who attempted a lab, one row each. */
  async attempts(
    questionId: string,
    query: AttemptQuery,
    user: AuthUser,
  ): Promise<Paginated<LabAttemptRow>> {
    await this.readableLab(questionId, user);
    const visible = await this.scope.visibleBatchIds(user, 'practice:review');
    if (query.batchId && visible !== null && !visible.includes(query.batchId)) {
      throw new ForbiddenError('That batch is not one of yours');
    }
    const batchIds = query.batchId ? [query.batchId] : visible;
    const userFilter = batchIds === null ? {} : { userId: { in: await this.learnerIds(batchIds) } };

    const [all, accepted] = await Promise.all([
      this.prisma.executionRun.groupBy({
        by: ['userId'],
        where: { questionId, context: 'practice', userId: { not: null }, ...userFilter },
        _count: { _all: true },
        _max: { createdAt: true, passedCount: true },
      }),
      this.prisma.executionRun.groupBy({
        by: ['userId'],
        where: { questionId, ...ACCEPTED_PRACTICE_RUN, userId: { not: null }, ...userFilter },
      }),
    ]);
    const solved = new Set(accepted.map((r) => r.userId!));
    const filtered = all
      .filter((r) => r.userId)
      .filter((r) =>
        query.status === 'solved'
          ? solved.has(r.userId!)
          : query.status === 'attempted'
            ? !solved.has(r.userId!)
            : true,
      )
      .sort((a, b) => (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0));
    const page = filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
    const userIds = page.map((r) => r.userId!);

    const [users, profiles, runs] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      }),
      this.prisma.studentProfile.findMany({
        where: { userId: { in: userIds } },
        select: {
          userId: true,
          studentCode: true,
          members: {
            where: { isActive: true, ...(batchIds === null ? {} : { batchId: { in: batchIds } }) },
            select: { batch: { select: { name: true } } },
          },
        },
      }),
      this.prisma.executionRun.findMany({
        where: { questionId, context: 'practice', userId: { in: userIds } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          verdict: true,
          trust: true,
          passedCount: true,
          totalCount: true,
        },
      }),
    ]);
    const nameOf = new Map(users.map((u) => [u.id, u.name]));
    const profileOf = new Map(profiles.map((p) => [p.userId, p]));
    // Runs come newest first: the first one seen is the latest; the best passes the most cases,
    // and between equals the better verdict wins. Only sandbox-judged runs can be the best.
    const latestOf = new Map<string, string>();
    const bestOf = new Map<string, { verdict: ExecutionVerdict; passed: number; total: number }>();
    for (const run of runs) {
      if (!run.userId) continue;
      if (!latestOf.has(run.userId)) latestOf.set(run.userId, run.id);
      if (run.trust !== 'trusted') continue;
      const known = bestOf.get(run.userId);
      const candidate = {
        verdict: run.verdict as ExecutionVerdict,
        passed: run.passedCount,
        total: run.totalCount,
      };
      const better =
        !known ||
        candidate.passed > known.passed ||
        (candidate.passed === known.passed &&
          (VERDICT_RANK[candidate.verdict] ?? 9) < (VERDICT_RANK[known.verdict] ?? 9));
      if (better) bestOf.set(run.userId, candidate);
    }
    return paginate(
      page.map((row) => {
        const id = row.userId!;
        const profile = profileOf.get(id);
        const best = bestOf.get(id) ?? {
          verdict: 'error' as ExecutionVerdict,
          passed: 0,
          total: 0,
        };
        return {
          userId: id,
          name: nameOf.get(id) ?? 'Unknown',
          studentCode: profile?.studentCode ?? null,
          batches: profile?.members.map((m) => m.batch.name) ?? [],
          submissions: row._count._all,
          solved: solved.has(id),
          bestVerdict: solved.has(id) ? 'passed' : best.verdict,
          bestPassed: best.passed,
          total: best.total,
          latestRunId: latestOf.get(id) ?? '',
          lastSubmittedAt: (row._max.createdAt ?? new Date(0)).toISOString(),
        };
      }),
      filtered.length,
      query,
    );
  }

  /** One submission, with its code and every case's verdict; outside the reviewer's scope, none. */
  async run(runId: string, user: AuthUser): Promise<LabRunView> {
    const run = await this.prisma.executionRun.findFirst({
      where: { id: runId, context: 'practice', userId: { not: null }, questionId: { not: null } },
      include: {
        user: { select: { name: true } },
        question: { select: { title: true, organizationId: true } },
      },
    });
    const org = await this.tenant.getOrganization();
    if (!run || !run.userId || !run.questionId || run.question?.organizationId !== org.id) {
      throw new NotFoundError('Submission');
    }
    await this.readableLab(run.questionId, user);
    const visible = await this.scope.visibleBatchIds(user, 'practice:review');
    if (visible !== null && !(await this.learnerIds(visible)).includes(run.userId)) {
      throw new NotFoundError('Submission');
    }
    return {
      id: run.id,
      questionId: run.questionId,
      labTitle: run.question?.title ?? '',
      userId: run.userId,
      learnerName: run.user?.name ?? 'Unknown',
      language: run.language as ExecutionLanguage,
      verdict: run.verdict as ExecutionVerdict,
      trust: run.trust as TrustLevel,
      passed: run.passedCount,
      total: run.totalCount,
      durationMs: run.durationMs,
      submittedAt: run.createdAt.toISOString(),
      code: run.code,
      cases: await this.practice.caseSummary(run.questionId, run.detail),
    };
  }

  // ───────────────────────── internals ─────────────────────────

  /** Whoever manages the bank, or reads all of it, sees every lab; an author, their own. */
  private readsAll(user: AuthUser): boolean {
    return hasPermission(user, 'questions:manage') || scopeFor(user, 'questions:read') === 'all';
  }

  /** The labs a person may list: all, their own, or their own and every published one. */
  private visibleTo(user: AuthUser, onlyMine: boolean) {
    if (onlyMine) return { authorId: user.id };
    if (this.readsAll(user)) return {};
    if (hasPermission(user, 'practice:review')) {
      return { OR: [{ authorId: user.id }, { status: 'published' as const }] };
    }
    return { authorId: user.id };
  }

  private async findLab(questionId: string) {
    const org = await this.tenant.getOrganization();
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        organizationId: org.id,
        deletedAt: null,
        type: { in: [...LAB_TYPES] },
      },
    });
    if (!question) throw new NotFoundError('Lab');
    return question;
  }

  private async readableLab(questionId: string, user: AuthUser) {
    const question = await this.findLab(questionId);
    const reviewable = question.status === 'published' && hasPermission(user, 'practice:review');
    if (!this.readsAll(user) && question.authorId !== user.id && !reviewable) {
      throw new ForbiddenError('That lab was written by somebody else');
    }
    return question;
  }

  /** User ids of the learners active in these batches. */
  private async learnerIds(batchIds: string[]): Promise<string[]> {
    if (batchIds.length === 0) return [];
    const members = await this.prisma.batchMember.findMany({
      where: { batchId: { in: batchIds }, isActive: true },
      select: { student: { select: { userId: true } } },
    });
    return [...new Set(members.map((m) => m.student.userId))];
  }

  /** How many lab lessons open each lab. */
  private async lessonCounts(questionIds: string[]): Promise<Map<string, number>> {
    if (questionIds.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<{ question_id: string; lessons: bigint }[]>`
      SELECT content->>'questionId' AS question_id, COUNT(*) AS lessons
      FROM lessons
      WHERE type = 'lab' AND content->>'questionId' = ANY(${questionIds})
      GROUP BY content->>'questionId'`;
    return new Map(rows.map((r) => [r.question_id, Number(r.lessons)]));
  }

  /** Attempt figures per lab, counted only over the learners the caller may review. */
  private async attemptStats(
    questionIds: string[],
    user: AuthUser,
  ): Promise<Map<string, { learners: number; solved: number; submissions: number }> | null> {
    if (!hasPermission(user, 'practice:review')) return null;
    const out = new Map<string, { learners: number; solved: number; submissions: number }>();
    if (questionIds.length === 0) return out;
    const visible = await this.scope.visibleBatchIds(user, 'practice:review');
    const userFilter = visible === null ? {} : { userId: { in: await this.learnerIds(visible) } };
    const [all, accepted] = await Promise.all([
      this.prisma.executionRun.groupBy({
        by: ['questionId', 'userId'],
        where: {
          questionId: { in: questionIds },
          context: 'practice',
          userId: { not: null },
          ...userFilter,
        },
        _count: { _all: true },
      }),
      this.prisma.executionRun.groupBy({
        by: ['questionId', 'userId'],
        where: {
          questionId: { in: questionIds },
          ...ACCEPTED_PRACTICE_RUN,
          userId: { not: null },
          ...userFilter,
        },
      }),
    ]);
    for (const row of all) {
      if (!row.questionId) continue;
      const stats = out.get(row.questionId) ?? { learners: 0, solved: 0, submissions: 0 };
      stats.learners += 1;
      stats.submissions += row._count._all;
      out.set(row.questionId, stats);
    }
    for (const row of accepted) {
      if (!row.questionId) continue;
      const stats = out.get(row.questionId);
      if (stats) stats.solved += 1;
    }
    return out;
  }
}
