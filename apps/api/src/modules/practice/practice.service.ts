import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type ExecutionLanguage,
  type Paginated,
  type PracticeProblemCard,
  type PracticeProblemDetail,
  type PracticeStatus,
  type PracticeSubmissionRecord,
  type PracticeSubmitInput,
  type PracticeSummary,
  type QuestionDifficulty,
  type TrustLevel,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { DomainRuleError, NotFoundError } from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { ExecutionService } from '../execution/index.js';

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
 * The practice catalogue is a view over the question bank: a problem is a published coding
 * question whose author put it in the catalogue. Nothing is authored twice, so a problem used in
 * an assignment and offered for practice is the same question with the same test cases.
 */
@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly events: EventEmitter2,
    private readonly execution: ExecutionService,
  ) {}

  /** What the workspace needs to know about how code will be run. */
  driverInfo(): { driver: string; trust: TrustLevel; clientRuns: boolean; languages: string[] } {
    return {
      driver: this.execution.driverName,
      trust: this.execution.trust,
      clientRuns: this.execution.clientRuns,
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
      select: { id: true, practicePoints: true },
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
    return { solved, attempted, total: problems.length, points };
  }

  async get(slug: string, user: AuthUser): Promise<PracticeProblemDetail> {
    const problem = await this.findBySlug(slug);
    const coding = await this.prisma.codingProblem.findUnique({
      where: { questionId: problem.id },
      include: { testCases: { orderBy: { position: 'asc' } } },
    });
    if (!coding) throw new NotFoundError('Problem');
    const runs = await this.runsFor(user.id, [problem.id]);

    return {
      ...this.toCard({ ...problem, coding: { languages: coding.languages } }, runs.get(problem.id)),
      body: problem.body,
      starterCode: coding.starterCode as Record<string, string>,
      timeLimitMs: coding.timeLimitMs,
      memoryLimitMb: coding.memoryLimitMb,
      samples: coding.testCases
        .filter((c) => c.isSample)
        .map((c) => ({ id: c.id, input: c.input, expectedOutput: c.expectedOutput })),
      hiddenTestCount: coding.testCases.filter((c) => !c.isSample).length,
    };
  }

  /** The sample cases, so the workspace can run something before a real submission. */
  async samples(slug: string): Promise<{ id: string; input: string; expectedOutput: string }[]> {
    const problem = await this.findBySlug(slug);
    const cases = await this.execution.casesFor(problem.id);
    return cases
      .filter((c) => c.isSample)
      .map((c) => ({ id: c.id, input: c.input, expectedOutput: c.expectedOutput }));
  }

  /**
   * Every case a submission is marked against, hidden ones included.
   *
   * A driver that runs in the learner's browser cannot keep a secret from it: to run the hidden
   * cases it has to be given them. That is the honest cost of the demo driver, and the reason its
   * verdicts are recorded as untrusted. With a Judge0 host the server runs the code instead and
   * this endpoint hands back only the samples.
   */
  async gradingCases(
    slug: string,
  ): Promise<{
    clientRuns: boolean;
    cases: { id: string; input: string; expectedOutput: string }[];
  }> {
    const problem = await this.findBySlug(slug);
    const cases = await this.execution.casesFor(problem.id);
    const usable = this.execution.clientRuns ? cases : cases.filter((c) => c.isSample);
    return {
      clientRuns: this.execution.clientRuns,
      cases: usable.map((c) => ({ id: c.id, input: c.input, expectedOutput: c.expectedOutput })),
    };
  }

  /** A run against the samples only. Recorded so the history is honest about what was tried. */
  async run(
    slug: string,
    input: PracticeSubmitInput,
    user: AuthUser,
  ): Promise<PracticeSubmissionRecord> {
    const problem = await this.findBySlug(slug);
    const cases = (await this.execution.casesFor(problem.id)).filter((c) => c.isSample);
    const grade = this.execution.grade(
      cases,
      input.result.results.map((r) => ({
        testCaseId: r.testCaseId,
        passed: r.passed,
        actualOutput: r.actualOutput,
        stderr: r.stderr,
        durationMs: r.durationMs,
      })),
      this.execution.driverName,
      this.execution.trust,
      input.result.durationMs,
    );
    const id = await this.execution.record({
      questionId: problem.id,
      userId: user.id,
      context: 'practice',
      language: input.language,
      code: input.code,
      grade,
    });
    return {
      id,
      language: input.language,
      verdict: grade.verdict,
      trust: grade.trust,
      driver: grade.driver,
      passed: grade.passed,
      total: grade.total,
      durationMs: grade.durationMs,
      submittedAt: new Date().toISOString(),
    };
  }

  /** A submission runs every case, hidden ones included, and counts towards the learner's total. */
  async submit(
    slug: string,
    input: PracticeSubmitInput,
    user: AuthUser,
  ): Promise<PracticeSubmissionRecord> {
    const problem = await this.findBySlug(slug);
    const coding = await this.prisma.codingProblem.findUnique({
      where: { questionId: problem.id },
      select: { languages: true },
    });
    if (!coding?.languages.includes(input.language)) {
      throw new DomainRuleError(
        `This problem does not accept ${input.language}`,
        'language_not_accepted',
      );
    }
    const grade = await this.execution.gradeSubmission(
      problem.id,
      input.language,
      input.code,
      input.result,
    );
    const id = await this.execution.record({
      questionId: problem.id,
      userId: user.id,
      context: 'practice',
      language: input.language,
      code: input.code,
      grade,
    });
    this.events.emit('execution.completed', {
      runId: id,
      questionId: problem.id,
      userId: user.id,
      verdict: grade.verdict,
    });
    return {
      id,
      language: input.language,
      verdict: grade.verdict,
      trust: grade.trust,
      driver: grade.driver,
      passed: grade.passed,
      total: grade.total,
      durationMs: grade.durationMs,
      submittedAt: new Date().toISOString(),
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
      verdict: row.verdict,
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
        type: 'coding',
      },
    });
    if (!problem) throw new NotFoundError('Problem');
    return problem;
  }

  /** How many times this learner has run each problem, and whether any run passed everything. */
  private async runsFor(
    userId: string,
    questionIds: string[],
  ): Promise<Map<string, { attempts: number; accepted: number }>> {
    if (questionIds.length === 0) return new Map();
    const rows = await this.prisma.executionRun.groupBy({
      by: ['questionId', 'verdict'],
      where: { userId, context: 'practice', questionId: { in: questionIds } },
      _count: { _all: true },
    });
    const out = new Map<string, { attempts: number; accepted: number }>();
    for (const row of rows) {
      if (!row.questionId) continue;
      const current = out.get(row.questionId) ?? { attempts: 0, accepted: 0 };
      current.attempts += row._count._all;
      if (row.verdict === 'passed') current.accepted += row._count._all;
      out.set(row.questionId, current);
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
