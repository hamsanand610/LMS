import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  ExecutionLanguage,
  ExecutionResultInput,
  ExecutionVerdict,
  QuestionValidation,
  TrustLevel,
} from '@lms/shared';
import { DomainRuleError } from '../../core/http/errors.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import {
  EXECUTION_DRIVER,
  type ExecutionCase,
  type ExecutionCaseResult,
  type ExecutionDriver,
} from './execution.driver.js';

/** What a graded coding answer is worth, and how it got there. */
export interface CodingGrade {
  verdict: ExecutionVerdict;
  trust: TrustLevel;
  driver: string;
  passed: number;
  total: number;
  /** Share of the weighted cases that passed, 0 to 1. */
  ratio: number;
  results: ExecutionCaseResult[];
  durationMs: number;
}

/**
 * The one place code execution is turned into marks.
 *
 * The API never runs learner code (ADR-0007). With the browser driver the learner's own machine
 * runs it and posts back a claim, which is recorded as untrusted; with a Judge0 host the service
 * runs it and the verdict is trusted. Either way the *marks* are computed here, from the weights
 * stored against the question, never from anything the client sends about what a case is worth.
 */
@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EXECUTION_DRIVER) private readonly driver: ExecutionDriver,
  ) {}

  get driverName(): string {
    return this.driver.name;
  }

  get trust(): TrustLevel {
    return this.driver.trust;
  }

  /** True when the configured driver expects the client to run the code and report back. */
  get clientRuns(): boolean {
    return !this.driver.runsOnServer;
  }

  languages(): readonly ExecutionLanguage[] {
    return this.driver.languages();
  }

  health(): Promise<{ ok: boolean; detail?: string }> {
    return this.driver.healthCheck();
  }

  /** The cases a question carries, with their weights. */
  async casesFor(questionId: string): Promise<ExecutionCase[]> {
    const problem = await this.prisma.codingProblem.findUnique({
      where: { questionId },
      include: { testCases: { orderBy: { position: 'asc' } } },
    });
    if (!problem) return [];
    return problem.testCases.map((c) => ({
      id: c.id,
      input: c.input,
      expectedOutput: c.expectedOutput,
      weight: c.weight,
      isSample: c.isSample,
    }));
  }

  /**
   * Turns a set of case outcomes into a grade. Outcomes for cases the question does not have are
   * dropped, and a case nobody reported counts as failed, so a short result list cannot inflate
   * a score.
   */
  grade(
    cases: ExecutionCase[],
    reported: ExecutionCaseResult[],
    driver: string,
    trust: TrustLevel,
    durationMs = 0,
  ): CodingGrade {
    const byId = new Map(reported.map((r) => [r.testCaseId, r]));
    const results: ExecutionCaseResult[] = cases.map((testCase) => {
      const outcome = byId.get(testCase.id);
      return {
        testCaseId: testCase.id,
        passed: outcome?.passed === true,
        actualOutput: outcome?.actualOutput ?? '',
        stderr: outcome?.stderr ?? '',
        durationMs: outcome?.durationMs ?? 0,
      };
    });
    const totalWeight = cases.reduce((n, c) => n + c.weight, 0);
    const passedWeight = cases.reduce(
      (n, c) => n + (byId.get(c.id)?.passed === true ? c.weight : 0),
      0,
    );
    const passed = results.filter((r) => r.passed).length;
    return {
      verdict: passed === cases.length && cases.length > 0 ? 'passed' : 'failed',
      trust,
      driver,
      passed,
      total: cases.length,
      ratio: totalWeight === 0 ? 0 : passedWeight / totalWeight,
      results,
      durationMs,
    };
  }

  /**
   * Grades an answer. A client-side driver's report is taken as the claim it is; a server-side
   * driver is asked to run the code here and its answer is used instead of anything the client said.
   */
  async gradeSubmission(
    questionId: string,
    language: ExecutionLanguage,
    code: string,
    reported: ExecutionResultInput | null,
  ): Promise<CodingGrade> {
    const cases = await this.casesFor(questionId);
    if (cases.length === 0) {
      throw new DomainRuleError('That question has no test cases', 'question_has_no_test_cases');
    }
    if (this.driver.runsOnServer) {
      const problem = await this.prisma.codingProblem.findUniqueOrThrow({ where: { questionId } });
      const outcome = await this.driver.run({
        language,
        code,
        cases,
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
      });
      return this.grade(cases, outcome.results, outcome.driver, outcome.trust, outcome.durationMs);
    }
    if (!reported) {
      throw new DomainRuleError(
        'This driver runs in your browser, so the run results must come with the submission',
        'execution_results_required',
      );
    }
    return this.grade(
      cases,
      reported.results.map((r) => ({
        testCaseId: r.testCaseId,
        passed: r.passed,
        actualOutput: r.actualOutput,
        stderr: r.stderr,
        durationMs: r.durationMs,
      })),
      this.driver.name,
      this.driver.trust,
      reported.durationMs,
    );
  }

  /** Records a run so a learner can see their history and staff can see what was claimed. */
  async record(entry: {
    questionId: string | null;
    userId: string | null;
    context: 'practice' | 'assignment' | 'test' | 'validation';
    language: string;
    code: string;
    grade: CodingGrade;
  }): Promise<string> {
    const run = await this.prisma.executionRun.create({
      data: {
        questionId: entry.questionId,
        userId: entry.userId,
        context: entry.context,
        language: entry.language,
        code: entry.code.slice(0, 100_000),
        driver: entry.grade.driver,
        trust: entry.grade.trust,
        verdict: entry.grade.verdict,
        passedCount: entry.grade.passed,
        totalCount: entry.grade.total,
        durationMs: entry.grade.durationMs,
        detail: asJson({ results: entry.grade.results }),
      },
    });
    return run.id;
  }

  /**
   * Runs a question's own reference solution against its cases. A coding question cannot be
   * published until this passes, which is what stops a broken question reaching a learner.
   *
   * With the browser driver there is nothing the server can run, so the validation has to be
   * performed by an author's browser and posted back; `recordValidation` stores what it said.
   */
  async validateReferenceSolution(questionId: string): Promise<QuestionValidation | null> {
    if (!this.driver.runsOnServer) return null;
    const problem = await this.prisma.codingProblem.findUnique({ where: { questionId } });
    if (!problem) return null;
    const cases = await this.casesFor(questionId);
    const solutions = problem.referenceSolution as Record<string, string>;
    const languages: QuestionValidation['languages'] = [];

    for (const language of problem.languages as ExecutionLanguage[]) {
      const source = solutions[language];
      if (!source) {
        languages.push({
          language,
          ok: false,
          passed: 0,
          total: cases.length,
          message: 'No reference solution for this language',
        });
        continue;
      }
      const outcome = await this.driver.run({
        language,
        code: source,
        cases,
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
      });
      const grade = this.grade(cases, outcome.results, outcome.driver, outcome.trust);
      languages.push({
        language,
        ok: grade.passed === grade.total,
        passed: grade.passed,
        total: grade.total,
        message:
          grade.passed === grade.total
            ? 'The reference solution passes every case'
            : `${grade.total - grade.passed} case(s) failed`,
      });
    }

    return {
      ok: languages.length > 0 && languages.every((l) => l.ok),
      driver: this.driver.name,
      trust: this.driver.trust,
      languages,
      validatedAt: new Date().toISOString(),
    };
  }
}
