import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EMPTY_WEB_FILES,
  LAB_TYPES,
  decodeWebFiles,
  webCheckViews,
  type CompareMode,
  type ExecutionLanguage,
  type ExecutionVerdict,
  type LabInProgress,
  type LabType,
  type Paginated,
  type PracticeProblemCard,
  type PracticeProblemDetail,
  type PracticeStatus,
  type PracticeSubmissionDetail,
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
import { htmlToText } from '../../core/html/text.js';
import { DomainRuleError, NotFoundError } from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { ACCEPTED_PRACTICE_RUN, ExecutionService } from '../execution/index.js';
import { ExecutionGate, LIVE_LAB } from '../execution/index.js';

interface ListQuery {
  page: number;
  pageSize: number;
  q?: string;
  type?: LabType;
  topic?: string;
  difficulty?: QuestionDifficulty;
  language?: ExecutionLanguage;
  status?: PracticeStatus;
}

/** The question columns a lab is read with. */
interface LabQuestion {
  id: string;
  slug: string;
  title: string;
  body: string;
  type: string;
  topic: string;
  difficulty: string;
  hints: string[];
  status: string;
  inPractice: boolean;
  practicePoints: number;
}

/** Kept here as well: the catalogue's own filter, shared through the execution module. */
export { LIVE_LAB };

/**
 * A lab as SI Academy AI may be told of it for a hint (Phase 7E; ADR-0031): what the learner's own
 * workspace shows them, and their own latest attempt. Never a hidden case, an expected output
 * behind one, a reference solution, the grader, a staff note, or anybody else's work.
 */
export interface AiLabBrief {
  questionId: string;
  title: string;
  type: string;
  /** The statement as plain words. */
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  /** The visible examples only, as the workspace shows them. */
  examples: { input: string; expectedOutput: string }[];
  /** The learner's own submissions that were not accepted. */
  failedAttempts: number;
  /** The learner's most recent submission: their code, and how its visible cases went. */
  latest: {
    runId: string;
    language: string;
    code: string;
    verdict: string;
    passed: number;
    total: number;
    visible: { label: string; verdict: string }[];
  } | null;
}

/**
 * The Labs area (ADR-0018): coding, SQL, debugging and web exercises from the question bank, in the
 * catalogue their authors put them in. Nothing is authored twice: a lab used in a course lesson and
 * offered in the catalogue is the same question with the same cases.
 *
 * Runs and submissions execute in the sandbox (ADR-0016), one at a time per person (ADR-0021). A run
 * tries the visible cases or the learner's own input and records nothing. A submission runs every
 * case, hidden ones included, and is recorded; only a trusted submission that passes every case
 * counts as solved.
 */
@Injectable()
export class PracticeService {
  private readonly logger = new Logger(PracticeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly events: EventEmitter2,
    private readonly execution: ExecutionService,
    private readonly gate: ExecutionGate,
  ) {}

  /** Whether code can be run on this installation, and in which runtimes. */
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
    // The learner's status is a property of their runs, so it is turned into a set of question ids
    // before the page is cut; filtering a page afterwards would lose rows and miscount the total.
    const byStatus = query.status ? await this.statusFilter(user.id, query.status) : {};
    const where = {
      organizationId: org.id,
      inPractice: true,
      ...LIVE_LAB,
      ...(query.type ? { type: query.type } : {}),
      ...(query.topic ? { topic: query.topic } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.language ? { coding: { languages: { has: query.language } } } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
      ...byStatus,
    };
    const [rows, total] = await Promise.all([
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
    return paginate(
      rows.map((row) => this.toCard(row, runs.get(row.id))),
      total,
      query,
    );
  }

  async summary(user: AuthUser): Promise<PracticeSummary> {
    const org = await this.tenant.getOrganization();
    const problems = await this.prisma.question.findMany({
      where: { organizationId: org.id, inPractice: true, ...LIVE_LAB },
      select: { id: true, practicePoints: true, topic: true, type: true },
    });
    const runs = await this.runsFor(
      user.id,
      problems.map((p) => p.id),
    );
    let solved = 0;
    let attempted = 0;
    let points = 0;
    const byType = Object.fromEntries(LAB_TYPES.map((t) => [t, 0])) as Record<LabType, number>;
    for (const problem of problems) {
      byType[problem.type as LabType] += 1;
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
    return { solved, attempted, total: problems.length, points, topics, byType };
  }

  async get(slug: string, user: AuthUser): Promise<PracticeProblemDetail> {
    return this.detail(await this.findBySlug(slug), user);
  }

  /** Tries the code on the visible cases, or once on the learner's own input. Nothing is recorded. */
  async run(slug: string, input: RunInput, user: AuthUser): Promise<RunOutcome> {
    const question = await this.findBySlug(slug);
    return this.runQuestion(question.id, input, user);
  }

  /** Runs every case, hidden ones included, records the result and says whether it is solved. */
  async submit(
    slug: string,
    input: PracticeSubmitInput,
    user: AuthUser,
  ): Promise<PracticeSubmitOutcome> {
    const question = await this.findBySlug(slug);
    return this.submitQuestion(question.id, input, user);
  }

  async submissions(slug: string, user: AuthUser): Promise<PracticeSubmissionRecord[]> {
    const question = await this.findBySlug(slug);
    return this.historyFor(question.id, user);
  }

  async submission(slug: string, runId: string, user: AuthUser): Promise<PracticeSubmissionDetail> {
    const question = await this.findBySlug(slug);
    return this.submissionFor(question.id, runId, user);
  }

  /**
   * Catalogue labs the learner started and has not solved — a draft kept, or a submission that did
   * not pass — most recent first, for "continue where you left off".
   */
  async inProgress(user: AuthUser): Promise<LabInProgress[]> {
    const org = await this.tenant.getOrganization();
    const [drafts, runs] = await Promise.all([
      this.prisma.labDraft.findMany({
        where: { userId: user.id, questionId: { not: null } },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: { questionId: true, updatedAt: true },
      }),
      this.prisma.executionRun.groupBy({
        by: ['questionId'],
        where: { userId: user.id, context: 'practice', questionId: { not: null } },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: 'desc' } },
        take: 30,
      }),
    ]);
    const latest = new Map<string, Date>();
    for (const draft of drafts) {
      if (draft.questionId) latest.set(draft.questionId, draft.updatedAt);
    }
    for (const run of runs) {
      if (!run.questionId || !run._max.createdAt) continue;
      const known = latest.get(run.questionId);
      if (!known || known < run._max.createdAt) latest.set(run.questionId, run._max.createdAt);
    }
    if (latest.size === 0) return [];
    const ids = [...latest.keys()];
    const [questions, stats] = await Promise.all([
      this.prisma.question.findMany({
        where: { id: { in: ids }, organizationId: org.id, inPractice: true, ...LIVE_LAB },
        select: { id: true, slug: true, title: true, type: true },
      }),
      this.runsFor(user.id, ids),
    ]);
    return questions
      .map((q) => {
        const s = stats.get(q.id);
        const status: PracticeStatus = !s
          ? 'not_attempted'
          : s.accepted > 0
            ? 'solved'
            : 'attempted';
        return {
          questionId: q.id,
          slug: q.slug,
          title: q.title,
          type: q.type as LabType,
          status,
          updatedAt: latest.get(q.id)!.toISOString(),
        };
      })
      .filter((lab) => lab.status !== 'solved')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6);
  }

  /**
   * A lab the learner may work on: in the catalogue, or opened by a lab lesson of a course they are
   * enrolled in. Anything else is not found. Shared by the lab drafts and SI Academy AI's lab hints
   * (Phase 7C), so both follow one rule.
   */
  async requireReachableLab(questionId: string, user: AuthUser): Promise<void> {
    const org = await this.tenant.getOrganization();
    const lab = await this.prisma.question.findFirst({
      where: { id: questionId, organizationId: org.id, ...LIVE_LAB },
      select: { id: true, inPractice: true },
    });
    if (!lab) throw new NotFoundError('Lab');
    if (lab.inPractice) return;
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        type: 'lab',
        content: { path: ['questionId'], equals: questionId },
        module: { course: { enrollments: { some: { student: { userId: user.id } } } } },
      },
      select: { id: true },
    });
    if (!lesson) throw new NotFoundError('Lab');
  }

  /**
   * What a lab hint is written from (Phase 7E): the lab's statement and visible examples, and the
   * learner's own submissions — how many were not accepted, and the latest one's code with its
   * visible cases' verdicts. The lab must be one they may work on (`requireReachableLab`); hidden
   * cases are not read at all, and a hidden case's verdict is not passed on.
   */
  async labHintBrief(questionId: string, user: AuthUser): Promise<AiLabBrief> {
    await this.requireReachableLab(questionId, user);
    const org = await this.tenant.getOrganization();
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, organizationId: org.id, ...LIVE_LAB },
      select: { title: true, type: true, body: true },
    });
    const coding = await this.prisma.codingProblem.findUnique({
      where: { questionId },
      select: {
        inputFormat: true,
        outputFormat: true,
        constraints: true,
        testCases: {
          where: { enabled: true, isSample: true },
          orderBy: { position: 'asc' },
          select: { input: true, expectedOutput: true },
        },
      },
    });
    if (!question || !coding) throw new NotFoundError('Lab');
    const runs = await this.prisma.executionRun.findMany({
      where: { questionId, userId: user.id, context: 'practice' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        language: true,
        code: true,
        verdict: true,
        passedCount: true,
        totalCount: true,
        detail: true,
      },
    });
    const latest = runs[0];
    return {
      questionId,
      title: question.title,
      type: question.type,
      statement: htmlToText(question.body),
      inputFormat: coding.inputFormat,
      outputFormat: coding.outputFormat,
      constraints: coding.constraints,
      // A web lab's checks are its own kind of case: none are passed on as examples.
      examples: question.type === 'web' ? [] : coding.testCases,
      failedAttempts: runs.filter((run) => run.verdict !== 'passed' && run.verdict !== 'pending')
        .length,
      latest: latest
        ? {
            runId: latest.id,
            language: latest.language,
            code: latest.code,
            verdict: latest.verdict,
            passed: latest.passedCount,
            total: latest.totalCount,
            visible: (await this.caseSummary(questionId, latest.detail))
              .filter((testCase) => !testCase.hidden)
              .map((testCase) => ({ label: testCase.label, verdict: testCase.verdict })),
          }
        : null,
    };
  }

  // ───────────────────────── shared with lesson labs and staff preview ─────────────────────────

  /** A lab as the workspace shows it: statement, starting code, visible cases or checks. */
  async detail(
    question: LabQuestion,
    user: AuthUser,
    preview = false,
  ): Promise<PracticeProblemDetail> {
    const coding = await this.prisma.codingProblem.findUnique({
      where: { questionId: question.id },
      include: { testCases: { where: { enabled: true }, orderBy: { position: 'asc' } } },
    });
    if (!coding) throw new NotFoundError('Lab');
    const runs = await this.runsFor(user.id, [question.id]);
    const type = question.type as LabType;
    const starterCode = coding.starterCode as Record<string, string>;
    const visible = coding.testCases.filter((c) => c.isSample);

    return {
      ...this.toCard(
        { ...question, coding: { languages: coding.languages } },
        runs.get(question.id),
      ),
      body: question.body,
      inputFormat: coding.inputFormat,
      outputFormat: coding.outputFormat,
      constraints: coding.constraints,
      expectedBehaviour: coding.expectedBehaviour,
      compareMode: coding.compareMode as CompareMode,
      // The tables and rows an SQL answer runs against are part of the question (ADR-0020).
      schemaSql: type === 'sql' ? coding.setupSql : '',
      sqlSchema: type === 'sql' ? await this.execution.sqlSchemaFor(question.id) : null,
      hints: question.hints,
      starterCode,
      starterFiles:
        type === 'web' ? (decodeWebFiles(starterCode['web'] ?? '') ?? EMPTY_WEB_FILES) : null,
      timeLimitMs: coding.timeLimitMs,
      memoryLimitMb: coding.memoryLimitMb,
      // Only the visible cases; hidden ones are counted, never shown. A web check is shown in words.
      samples:
        type === 'web'
          ? []
          : visible.map((c) => ({
              id: c.id,
              label: c.label,
              input: c.input,
              expectedOutput: c.expectedOutput,
              explanation: c.explanation,
            })),
      checks: type === 'web' ? webCheckViews(visible) : [],
      hiddenTestCount: coding.testCases.filter((c) => !c.isSample).length,
      ...(preview
        ? {
            preview: {
              status: question.status as 'draft' | 'published' | 'retired',
              inCatalogue: question.inPractice,
            },
          }
        : {}),
    };
  }

  /** A run of one lab, through the per-person gate. Nothing is recorded. */
  async runQuestion(questionId: string, input: RunInput, user: AuthUser): Promise<RunOutcome> {
    const problem = await this.execution.loadProblem(questionId);
    if (!problem) throw new NotFoundError('Lab');
    if (problem.type === 'web' && input.customInput !== null) {
      throw new DomainRuleError(
        'A web page is checked, not run on input; run the checks instead',
        'custom_input_not_offered',
      );
    }
    const started = Date.now();
    const outcome = await this.gate.run(user.id, () =>
      this.execution.run(problem, input.language, input.code, input.customInput, input.caseIds),
    );
    this.logger.debug(
      {
        event: 'lab.run',
        userId: user.id,
        questionId,
        language: input.language,
        verdict: outcome.verdict,
        ms: Date.now() - started,
      },
      'Lab run',
    );
    return outcome;
  }

  /** A submission of one lab: every case, recorded, through the per-person gate. */
  async submitQuestion(
    questionId: string,
    input: PracticeSubmitInput,
    user: AuthUser,
  ): Promise<PracticeSubmitOutcome> {
    const problem = await this.execution.loadProblem(questionId);
    if (!problem) throw new NotFoundError('Lab');
    const solvedBefore = (await this.runsFor(user.id, [questionId])).get(questionId)?.accepted ?? 0;

    const started = Date.now();
    const evaluation = await this.gate.run(user.id, () =>
      this.execution.evaluate(problem, input.language, input.code),
    );
    const id = await this.execution.record({
      questionId,
      userId: user.id,
      context: 'practice',
      language: input.language,
      code: input.code,
      evaluation,
    });
    // Lab lessons that open this lab complete when it is passed, wherever it was passed.
    this.events.emit('execution.completed', {
      runId: id,
      questionId,
      userId: user.id,
      context: 'practice',
      verdict: evaluation.verdict,
      trust: evaluation.trust,
    });
    this.logger.log(
      {
        event: 'lab.submitted',
        userId: user.id,
        questionId,
        language: input.language,
        verdict: evaluation.verdict,
        passed: evaluation.passed,
        total: evaluation.total,
        ms: Date.now() - started,
      },
      'Lab submitted',
    );
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

  /** The learner's own submissions to one lab, newest first. */
  async historyFor(questionId: string, user: AuthUser): Promise<PracticeSubmissionRecord[]> {
    const rows = await this.prisma.executionRun.findMany({
      where: { questionId, userId: user.id, context: 'practice' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map(toRecord);
  }

  /** One of the learner's own submissions, with its code; somebody else's is not found. */
  async submissionFor(
    questionId: string,
    runId: string,
    user: AuthUser,
  ): Promise<PracticeSubmissionDetail> {
    const run = await this.prisma.executionRun.findFirst({
      where: { id: runId, questionId, userId: user.id, context: 'practice' },
    });
    if (!run) throw new NotFoundError('Submission');
    return {
      ...toRecord(run),
      code: run.code,
      cases: await this.caseSummary(questionId, run.detail),
    };
  }

  /**
   * How each case of a recorded run went, named the way the workspace names them; a hidden case
   * carries its verdict only. Shared with the staff view, which shows the same list.
   */
  async caseSummary(
    questionId: string,
    detail: unknown,
  ): Promise<PracticeSubmissionDetail['cases']> {
    const recorded = ((detail as { cases?: unknown })?.cases ?? []) as {
      testCaseId: string;
      verdict: ExecutionVerdict;
    }[];
    const problem = await this.prisma.codingProblem.findUnique({
      where: { questionId },
      select: { testCases: { select: { id: true, label: true, isSample: true } } },
    });
    const byId = new Map((problem?.testCases ?? []).map((c) => [c.id, c]));
    return recorded.map((c, index) => {
      const testCase = byId.get(c.testCaseId);
      return {
        number: index + 1,
        label: testCase?.label || `Test ${index + 1}`,
        hidden: testCase ? !testCase.isSample : true,
        verdict: c.verdict,
        passed: c.verdict === 'passed',
      };
    });
  }

  // ───────────────────────── internals ─────────────────────────

  private async findBySlug(slug: string): Promise<LabQuestion> {
    const org = await this.tenant.getOrganization();
    const problem = await this.prisma.question.findFirst({
      where: { slug, organizationId: org.id, inPractice: true, ...LIVE_LAB },
    });
    if (!problem) throw new NotFoundError('Lab');
    return problem;
  }

  /** A Prisma fragment that keeps the labs with this learner's status. */
  private async statusFilter(
    userId: string,
    status: PracticeStatus,
  ): Promise<{ id: { in: string[] } | { notIn: string[] } }> {
    const [attempted, accepted] = await Promise.all([
      this.prisma.executionRun.groupBy({
        by: ['questionId'],
        where: { userId, context: 'practice', questionId: { not: null } },
      }),
      this.prisma.executionRun.groupBy({
        by: ['questionId'],
        where: { userId, ...ACCEPTED_PRACTICE_RUN, questionId: { not: null } },
      }),
    ]);
    const tried = attempted.map((r) => r.questionId!).filter(Boolean);
    const solved = new Set(accepted.map((r) => r.questionId!).filter(Boolean));
    if (status === 'solved') return { id: { in: [...solved] } };
    if (status === 'attempted') return { id: { in: tried.filter((id) => !solved.has(id)) } };
    return { id: { notIn: tried } };
  }

  /**
   * How many submissions this learner made on each lab, and how many were accepted. Accepted means
   * run in the sandbox against every case and passed; a claim a browser once made does not count.
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
      type: string;
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
      type: row.type as LabType,
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

function toRecord(row: {
  id: string;
  language: string;
  verdict: string;
  trust: string;
  driver: string;
  passedCount: number;
  totalCount: number;
  durationMs: number;
  createdAt: Date;
}): PracticeSubmissionRecord {
  return {
    id: row.id,
    language: row.language as ExecutionLanguage,
    verdict: row.verdict as ExecutionVerdict,
    trust: row.trust as TrustLevel,
    driver: row.driver,
    passed: row.passedCount,
    total: row.totalCount,
    durationMs: row.durationMs,
    submittedAt: row.createdAt.toISOString(),
  };
}
