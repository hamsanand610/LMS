import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type CompareMode,
  type ExecutionLanguage,
  type ExecutionVerdict,
  type Paginated,
  type PracticeProblemCard,
  type PracticeProblemDetail,
  type PracticeStatus,
  type PracticeSubmissionRecord,
  type PracticeSubmitInput,
  type PracticeSubmitOutcome,
  type PracticeSummary,
  type QuestionDifficulty,
  type RunInput,
  type RunOutcome,
  type TrustLevel,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { NotFoundError } from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { ACCEPTED_PRACTICE_RUN, ExecutionService } from '../execution/index.js';

interface ListQuery {
  page: number;
  pageSize: number;
  q?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  language?: ExecutionLanguage;
  status?: PracticeStatus;
}

/**
 * The practice catalogue is a view over the question bank: a problem is a published coding (or
 * SQL) question whose author put it in the catalogue. Nothing is authored twice, so a problem used
 * in an assignment and offered for practice is the same question with the same test cases.
 *
 * Both Run and Submit execute in the sandbox (ADR-0016). A Run tries the visible cases, or the
 * learner's own input, and records nothing. A Submit runs every case, hidden ones included, and is
 * recorded; only a trusted submission that passes every case counts as solved.
 */
@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly events: EventEmitter2,
    private readonly execution: ExecutionService,
  ) {}

  /** Whether code can be run on this installation, and in which languages. */
  driverInfo(): { available: boolean; driver: string; trust: TrustLevel; languages: string[] } {
    return {
      available: this.execution.available,
      driver: this.execution.driverName,
      trust: this.execution.trust,
      languages: [...this.execution.languages()],
    };
  }

  async list(query: ListQuery, user: AuthUser): Promise<Paginated<PracticeProblemCard>> {
    const org = await this.tenant.getOrganization();
    const where = {
      organizationId: org.id,
      deletedAt: null,
      inPractice: true,
      status: 'published' as const,
      type: { in: ['coding' as const, 'sql' as const] },
      ...(query.topic ? { topic: query.topic } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.language ? { coding: { languages: { has: query.language } } } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
        ...skipTake(query),
        include: { coding: { select: { languages: true } } },
      }),
      this.prisma.question.count({ where }),
    ]);

    const runs = await this.runsFor(
      user.id,
      rows.map((row) => row.id),
    );
    const cards = rows.map((row) => this.toCard(row, runs.get(row.id)));
    // Status is a property of the learner, not of the row, so it is filtered after the join.
    const filtered = query.status ? cards.filter((card) => card.status === query.status) : cards;
    return paginate(filtered, query.status ? filtered.length : total, query);
  }

  async summary(user: AuthUser): Promise<PracticeSummary> {
    const org = await this.tenant.getOrganization();
    const problems = await this.prisma.question.findMany({
      where: { organizationId: org.id, deletedAt: null, inPractice: true, status: 'published' },
      select: { id: true, practicePoints: true, topic: true },
    });
    const runs = await this.runsFor(
      user.id,
      problems.map((p) => p.id),
    );
    let solved = 0;
    let attempted = 0;
    let points = 0;
    for (const problem of problems) {
      const stats = runs.get(problem.id);
      if (!stats) continue;
      if (stats.accepted > 0) {
        solved += 1;
        points += problem.practicePoints;
      } else {
        attempted += 1;
      }
    }
    const topics = [...new Set(problems.map((p) => p.topic).filter(Boolean))].sort();
    return { solved, attempted, total: problems.length, points, topics };
  }

  async get(slug: string, user: AuthUser): Promise<PracticeProblemDetail> {
    const problem = await this.findBySlug(slug);
    const coding = await this.prisma.codingProblem.findUnique({
      where: { questionId: problem.id },
      include: { testCases: { where: { enabled: true }, orderBy: { position: 'asc' } } },
    });
    if (!coding) throw new NotFoundError('Problem');
    const runs = await this.runsFor(user.id, [problem.id]);

    const sql = problem.type === 'sql';
    return {
      ...this.toCard({ ...problem, coding: { languages: coding.languages } }, runs.get(problem.id)),
      type: sql ? 'sql' : 'coding',
      body: problem.body,
      inputFormat: coding.inputFormat,
      outputFormat: coding.outputFormat,
      constraints: coding.constraints,
      compareMode: coding.compareMode as CompareMode,
      // The tables and rows an SQL answer runs against are part of the question.
      schemaSql: sql ? coding.setupSql : '',
      hints: problem.hints,
      starterCode: coding.starterCode as Record<string, string>,
      timeLimitMs: coding.timeLimitMs,
      memoryLimitMb: coding.memoryLimitMb,
      // Only the visible cases; hidden ones are counted, never shown.
      samples: coding.testCases
        .filter((c) => c.isSample)
        .map((c) => ({
          id: c.id,
          label: c.label,
          input: c.input,
          expectedOutput: c.expectedOutput,
          explanation: c.explanation,
        })),
      hiddenTestCount: coding.testCases.filter((c) => !c.isSample).length,
    };
  }

  /** Tries the code on the visible cases, or once on the learner's own input. Nothing is recorded. */
  async run(slug: string, input: RunInput, _user: AuthUser): Promise<RunOutcome> {
    const question = await this.findBySlug(slug);
    const problem = await this.execution.loadProblem(question.id);
    if (!problem) throw new NotFoundError('Problem');
    return this.execution.run(
      problem,
      input.language,
      input.code,
      input.customInput,
      input.caseIds,
    );
  }

  /** Runs every case, hidden ones included, records the result and says whether it is solved. */
  async submit(
    slug: string,
    input: PracticeSubmitInput,
    user: AuthUser,
  ): Promise<PracticeSubmitOutcome> {
    const question = await this.findBySlug(slug);
    const problem = await this.execution.loadProblem(question.id);
    if (!problem) throw new NotFoundError('Problem');
    const solvedBefore =
      (await this.runsFor(user.id, [question.id])).get(question.id)?.accepted ?? 0;

    const evaluation = await this.execution.evaluate(problem, input.language, input.code);
    const id = await this.execution.record({
      questionId: question.id,
      userId: user.id,
      context: 'practice',
      language: input.language,
      code: input.code,
      evaluation,
    });
    this.events.emit('execution.completed', {
      runId: id,
      questionId: question.id,
      userId: user.id,
      verdict: evaluation.verdict,
    });
    return {
      submission: {
        id,
        language: input.language,
        verdict: evaluation.verdict,
        trust: evaluation.trust,
        driver: evaluation.driver,
        passed: evaluation.passed,
        total: evaluation.total,
        durationMs: evaluation.durationMs ?? 0,
        submittedAt: new Date().toISOString(),
      },
      compileOutput: evaluation.compileOutput,
      cases: this.execution.outcomes(evaluation, { revealHidden: false }),
      newlySolved:
        evaluation.verdict === 'passed' && evaluation.trust === 'trusted' && solvedBefore === 0,
    };
  }

  async submissions(slug: string, user: AuthUser): Promise<PracticeSubmissionRecord[]> {
    const problem = await this.findBySlug(slug);
    const rows = await this.prisma.executionRun.findMany({
      where: { questionId: problem.id, userId: user.id, context: 'practice' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((row) => ({
      id: row.id,
      language: row.language as ExecutionLanguage,
      verdict: row.verdict as ExecutionVerdict,
      trust: row.trust as TrustLevel,
      driver: row.driver,
      passed: row.passedCount,
      total: row.totalCount,
      durationMs: row.durationMs,
      submittedAt: row.createdAt.toISOString(),
    }));
  }

  // ───────────────────────── internals ─────────────────────────

  private async findBySlug(slug: string) {
    const org = await this.tenant.getOrganization();
    const problem = await this.prisma.question.findFirst({
      where: {
        slug,
        organizationId: org.id,
        deletedAt: null,
        inPractice: true,
        status: 'published',
        type: { in: ['coding', 'sql'] },
      },
    });
    if (!problem) throw new NotFoundError('Problem');
    return problem;
  }

  /**
   * How many submissions this learner made on each problem, and how many were accepted. Accepted
   * means run in the sandbox against every case and passed; a claim a browser once made does not
   * count.
   */
  private async runsFor(
    userId: string,
    questionIds: string[],
  ): Promise<Map<string, { attempts: number; accepted: number }>> {
    if (questionIds.length === 0) return new Map();
    const [attempts, accepted] = await Promise.all([
      this.prisma.executionRun.groupBy({
        by: ['questionId'],
        where: { userId, context: 'practice', questionId: { in: questionIds } },
        _count: { _all: true },
      }),
      this.prisma.executionRun.groupBy({
        by: ['questionId'],
        where: { userId, ...ACCEPTED_PRACTICE_RUN, questionId: { in: questionIds } },
        _count: { _all: true },
      }),
    ]);
    const acceptedBy = new Map(accepted.map((row) => [row.questionId, row._count._all]));
    const out = new Map<string, { attempts: number; accepted: number }>();
    for (const row of attempts) {
      if (!row.questionId) continue;
      out.set(row.questionId, {
        attempts: row._count._all,
        accepted: acceptedBy.get(row.questionId) ?? 0,
      });
    }
    return out;
  }

  private toCard(
    row: {
      id: string;
      slug: string;
      title: string;
      topic: string;
      difficulty: string;
      practicePoints: number;
      coding?: { languages: string[] } | null;
    },
    stats: { attempts: number; accepted: number } | undefined,
  ): PracticeProblemCard {
    return {
      questionId: row.id,
      slug: row.slug,
      title: row.title,
      topic: row.topic,
      difficulty: row.difficulty as QuestionDifficulty,
      languages: (row.coding?.languages ?? []) as ExecutionLanguage[],
      points: row.practicePoints,
      status: !stats ? 'not_attempted' : stats.accepted > 0 ? 'solved' : 'attempted',
      attempts: stats?.attempts ?? 0,
      acceptedCount: stats?.accepted ?? 0,
    };
  }
}
