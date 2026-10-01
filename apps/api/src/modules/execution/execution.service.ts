import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SANDBOX_LIMITS,
  type CaseOutcome,
  type CompareMode,
  type ExecutionLanguage,
  type ExecutionVerdict,
  type QuestionValidation,
  type RunOutcome,
  type SandboxCaseResult,
  type SandboxJob,
  type TrustLevel,
  VERDICT_LABELS,
} from '@lms/shared';
import { DomainRuleError } from '../../core/http/errors.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { caseVerdict } from './compare.js';
import {
  EXECUTION_DRIVER,
  ExecutionUnavailableError,
  type ExecutionDriver,
} from './execution.driver.js';

/** One test case as the evaluation needs it. Expected outputs never leave this process. */
export interface ProblemCase {
  id: string;
  position: number;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  weight: number;
  label: string;
  explanation: string;
  enabled: boolean;
  timeLimitMs: number | null;
  memoryLimitMb: number | null;
}

/** A coding or SQL question's executable part. */
export interface Problem {
  questionId: string;
  type: 'coding' | 'sql';
  languages: ExecutionLanguage[];
  timeLimitMs: number;
  memoryLimitMb: number;
  compareMode: CompareMode;
  setupSql: string;
  sqlCheck: string;
  referenceSolution: Record<string, string>;
  cases: ProblemCase[];
}

/** One case after it ran. */
export interface EvaluatedCase {
  case: ProblemCase;
  verdict: ExecutionVerdict;
  passed: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  memoryKb: number;
}

/** A whole answer after it ran against every enabled case. */
export interface Evaluation {
  verdict: ExecutionVerdict;
  compileOutput: string;
  cases: EvaluatedCase[];
  passed: number;
  total: number;
  /** Share of the case weight that passed, 0 to 1. */
  ratio: number;
  durationMs: number | null;
  memoryKb: number | null;
  driver: string;
  trust: TrustLevel;
}

/** What a program may print per case before it is cut off. */
const OUTPUT_BYTES = 65_536;
/** What a learner is shown of a visible case's output or error stream. */
const SHOWN_CHARS = 8_000;
/** Cases per sandbox job are grouped so each job stays inside the runner's time budget. */
const JOB_TIME_BUDGET_MS = SANDBOX_LIMITS.maxTotalTimeMs - 10_000;

/**
 * The one place code is run and judged. The API never executes learner code itself (ADR-0007):
 * it builds a job of code and inputs, hands it to the configured driver, and compares the printed
 * output with the expected output it keeps to itself (ADR-0016). Marks come from the weights stored
 * against the cases, never from anything a client says.
 */
@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EXECUTION_DRIVER) private readonly driver: ExecutionDriver,
  ) {}

  get available(): boolean {
    return this.driver.available;
  }

  get driverName(): string {
    return this.driver.name;
  }

  get trust(): TrustLevel {
    return this.driver.trust;
  }

  languages(): readonly ExecutionLanguage[] {
    return this.driver.languages();
  }

  health(): Promise<{ ok: boolean; detail?: string }> {
    return this.driver.healthCheck();
  }

  /** The executable part of a question, or null when it has none. */
  async loadProblem(questionId: string): Promise<Problem | null> {
    const row = await this.prisma.codingProblem.findUnique({
      where: { questionId },
      include: {
        question: { select: { type: true } },
        testCases: { orderBy: { position: 'asc' } },
      },
    });
    if (!row || (row.question.type !== 'coding' && row.question.type !== 'sql')) return null;
    return {
      questionId,
      type: row.question.type,
      languages: row.languages as ExecutionLanguage[],
      timeLimitMs: row.timeLimitMs,
      memoryLimitMb: row.memoryLimitMb,
      compareMode: row.compareMode as CompareMode,
      setupSql: row.setupSql,
      sqlCheck: row.sqlCheck,
      referenceSolution: row.referenceSolution as Record<string, string>,
      cases: row.testCases.map((c) => ({
        id: c.id,
        position: c.position,
        input: c.input,
        expectedOutput: c.expectedOutput,
        isSample: c.isSample,
        weight: c.weight,
        label: c.label,
        explanation: c.explanation,
        enabled: c.enabled,
        timeLimitMs: c.timeLimitMs,
        memoryLimitMb: c.memoryLimitMb,
      })),
    };
  }

  /**
   * A Run: the visible cases, or the learner's own input once. Nothing is recorded and nothing is
   * marked; it is for trying things before submitting.
   */
  async run(
    problem: Problem,
    language: ExecutionLanguage,
    code: string,
    customInput: string | null,
    caseIds?: string[],
  ): Promise<RunOutcome> {
    this.requireLanguage(problem, language);
    if (customInput !== null) {
      const custom: ProblemCase = {
        id: 'custom',
        position: 0,
        input: customInput,
        expectedOutput: '',
        isSample: true,
        weight: 1,
        label: 'Your input',
        explanation: '',
        enabled: true,
        timeLimitMs: null,
        memoryLimitMb: null,
      };
      const result = await this.execute(problem, language, code, [custom]);
      const raw = result.cases[0];
      const verdict: ExecutionVerdict = !result.compile.ok
        ? 'compile_error'
        : !raw
          ? 'error'
          : this.withoutComparison(raw);
      return {
        verdict,
        compileOutput: result.compile.output,
        cases: [],
        passed: 0,
        total: 0,
        durationMs: raw?.durationMs ?? null,
        memoryKb: raw?.memoryKb ?? null,
        output: raw
          ? {
              stdout: raw.stdout.slice(0, SHOWN_CHARS),
              stderr: raw.stderr.slice(0, SHOWN_CHARS),
              exitCode: raw.exitCode,
            }
          : { stdout: '', stderr: '', exitCode: null },
      };
    }

    // Only visible cases are ever run here; an id of a hidden case simply matches nothing.
    const visible = problem.cases.filter(
      (c) =>
        c.enabled && c.isSample && (!caseIds || caseIds.length === 0 || caseIds.includes(c.id)),
    );
    if (visible.length === 0) {
      throw new DomainRuleError(
        'This question has no visible examples; run it on your own input instead',
        'no_visible_cases',
      );
    }
    const evaluation = await this.evaluateCases(problem, language, code, visible);
    return {
      verdict: evaluation.verdict,
      compileOutput: evaluation.compileOutput,
      cases: this.outcomes(evaluation, { revealHidden: false }),
      passed: evaluation.passed,
      total: evaluation.total,
      durationMs: evaluation.durationMs,
      memoryKb: evaluation.memoryKb,
    };
  }

  /** A Submit: every enabled case, hidden ones included, judged here. */
  evaluate(problem: Problem, language: ExecutionLanguage, code: string): Promise<Evaluation> {
    this.requireLanguage(problem, language);
    const cases = problem.cases.filter((c) => c.enabled);
    if (cases.length === 0) {
      throw new DomainRuleError('This question has no test cases', 'question_has_no_test_cases');
    }
    return this.evaluateCases(problem, language, code, cases);
  }

  /**
   * Cases as a person may see them. A learner sees input, expected and actual output only for
   * visible cases; a hidden case shows its verdict and cost and nothing else. Staff who review the
   * answer see everything.
   */
  outcomes(evaluation: Evaluation, options: { revealHidden: boolean }): CaseOutcome[] {
    return evaluation.cases.map((c, index) => toOutcome(c, index + 1, options.revealHidden));
  }

  /**
   * Runs a question's reference solutions against its cases, and for SQL first works out the
   * expected result tables that were left blank. A coding question cannot be published until this
   * passes, which is what stops a broken question reaching a learner. Null when nothing can run.
   */
  async validateReferenceSolution(questionId: string): Promise<QuestionValidation | null> {
    if (!this.driver.available) return null;
    let problem = await this.loadProblem(questionId);
    if (!problem) return null;

    if (problem.type === 'sql') {
      problem = await this.fillSqlExpectations(problem);
    }

    const languages: QuestionValidation['languages'] = [];
    for (const language of problem.languages) {
      const source = problem.referenceSolution[language];
      const total = problem.cases.filter((c) => c.enabled).length;
      if (!source?.trim()) {
        languages.push({
          language,
          ok: false,
          passed: 0,
          total,
          message: 'No reference solution for this language',
        });
        continue;
      }
      try {
        const evaluation = await this.evaluate(problem, language, source);
        languages.push({
          language,
          ok: evaluation.passed === evaluation.total,
          passed: evaluation.passed,
          total: evaluation.total,
          message:
            evaluation.verdict === 'compile_error'
              ? 'The reference solution does not compile'
              : evaluation.passed === evaluation.total
                ? 'The reference solution passes every case'
                : failureMessage(evaluation.cases.filter((c) => !c.passed)),
        });
      } catch (error) {
        if (!(error instanceof ExecutionUnavailableError)) throw error;
        return null;
      }
    }
    return {
      ok: languages.length > 0 && languages.every((l) => l.ok),
      driver: this.driver.name,
      trust: this.driver.trust,
      languages,
      validatedAt: new Date().toISOString(),
    };
  }

  /** Records a run for the learner's history and for staff: what ran, and how it went. */
  async record(entry: {
    questionId: string | null;
    userId: string | null;
    context: 'practice' | 'assignment' | 'test' | 'validation';
    language: string;
    code: string;
    evaluation: Evaluation;
  }): Promise<string> {
    const run = await this.prisma.executionRun.create({
      data: {
        questionId: entry.questionId,
        userId: entry.userId,
        context: entry.context,
        language: entry.language,
        code: entry.code.slice(0, SANDBOX_LIMITS.maxCodeChars),
        driver: entry.evaluation.driver,
        trust: entry.evaluation.trust,
        verdict: entry.evaluation.verdict,
        passedCount: entry.evaluation.passed,
        totalCount: entry.evaluation.total,
        durationMs: entry.evaluation.durationMs ?? 0,
        // Verdicts and costs only; outputs are not kept for runs.
        detail: asJson({
          cases: entry.evaluation.cases.map((c) => ({
            testCaseId: c.case.id,
            verdict: c.verdict,
            durationMs: c.durationMs,
            memoryKb: c.memoryKb,
          })),
        }),
      },
    });
    return run.id;
  }

  // ───────────────────────── internals ─────────────────────────

  private requireLanguage(problem: Problem, language: ExecutionLanguage): void {
    if (!problem.languages.includes(language)) {
      throw new DomainRuleError(
        `This question is answered in ${problem.languages.join(', ')}`,
        'language_not_offered',
      );
    }
  }

  private async evaluateCases(
    problem: Problem,
    language: ExecutionLanguage,
    code: string,
    cases: ProblemCase[],
  ): Promise<Evaluation> {
    const result = await this.execute(problem, language, code, cases);
    if (!result.compile.ok) {
      return {
        verdict: 'compile_error',
        compileOutput: result.compile.output,
        cases: cases.map((c) => ({
          case: c,
          verdict: 'compile_error' as const,
          passed: false,
          stdout: '',
          stderr: '',
          exitCode: null,
          durationMs: 0,
          memoryKb: 0,
        })),
        passed: 0,
        total: cases.length,
        ratio: 0,
        durationMs: null,
        memoryKb: null,
        driver: this.driver.name,
        trust: this.driver.trust,
      };
    }
    const byId = new Map(result.cases.map((raw) => [raw.id, raw]));
    const evaluated: EvaluatedCase[] = cases.map((c) => {
      const raw = byId.get(c.id);
      // A case the sandbox did not report is a failure, never a pass.
      if (!raw) {
        return {
          case: c,
          verdict: 'error',
          passed: false,
          stdout: '',
          stderr: '',
          exitCode: null,
          durationMs: 0,
          memoryKb: 0,
        };
      }
      const verdict = caseVerdict(raw, problem.compareMode, c.expectedOutput);
      return {
        case: c,
        verdict,
        passed: verdict === 'passed',
        stdout: raw.stdout,
        stderr: raw.stderr,
        exitCode: raw.exitCode,
        durationMs: raw.durationMs,
        memoryKb: raw.memoryKb,
      };
    });
    const totalWeight = evaluated.reduce((n, c) => n + c.case.weight, 0);
    const passedWeight = evaluated.reduce((n, c) => n + (c.passed ? c.case.weight : 0), 0);
    const firstFailure = evaluated.find((c) => !c.passed);
    return {
      verdict: firstFailure ? firstFailure.verdict : 'passed',
      compileOutput: result.compile.output,
      cases: evaluated,
      passed: evaluated.filter((c) => c.passed).length,
      total: evaluated.length,
      ratio: totalWeight === 0 ? 0 : passedWeight / totalWeight,
      durationMs: Math.max(0, ...evaluated.map((c) => c.durationMs)),
      memoryKb: Math.max(0, ...evaluated.map((c) => c.memoryKb)),
      driver: this.driver.name,
      trust: this.driver.trust,
    };
  }

  /** Sends the cases in as few jobs as the sandbox's time budget allows, and merges the answers. */
  private async execute(
    problem: Problem,
    language: ExecutionLanguage,
    code: string,
    cases: ProblemCase[],
  ): Promise<{ compile: { ok: boolean; output: string }; cases: SandboxCaseResult[] }> {
    if (!this.driver.available) {
      throw new ExecutionUnavailableError('Code execution is not set up on this installation.');
    }
    const chunks: ProblemCase[][] = [];
    let current: ProblemCase[] = [];
    let spent = 0;
    for (const c of cases) {
      const time = c.timeLimitMs ?? problem.timeLimitMs;
      if (
        current.length > 0 &&
        (spent + time > JOB_TIME_BUDGET_MS || current.length >= SANDBOX_LIMITS.maxCases)
      ) {
        chunks.push(current);
        current = [];
        spent = 0;
      }
      current.push(c);
      spent += time;
    }
    if (current.length > 0) chunks.push(current);

    const merged: SandboxCaseResult[] = [];
    for (const chunk of chunks) {
      const job: SandboxJob = {
        language,
        code,
        cases: chunk.map((c) => ({
          id: c.id,
          stdin: c.input,
          ...(c.timeLimitMs ? { timeMs: c.timeLimitMs } : {}),
          ...(c.memoryLimitMb ? { memoryMb: c.memoryLimitMb } : {}),
        })),
        limits: {
          timeMs: problem.timeLimitMs,
          memoryMb: problem.memoryLimitMb,
          outputBytes: OUTPUT_BYTES,
        },
        ...(language === 'sql'
          ? { sql: { setup: problem.setupSql, check: problem.sqlCheck } }
          : {}),
      };
      const result = await this.driver.execute(job);
      if (!result.compile.ok) return { compile: result.compile, cases: [] };
      merged.push(...result.cases);
    }
    return { compile: { ok: true, output: '' }, cases: merged };
  }

  /** A run on the learner's own input has nothing to compare with; only how it ended matters. */
  private withoutComparison(raw: SandboxCaseResult): ExecutionVerdict {
    const verdict = caseVerdict(raw, 'exact', raw.stdout);
    return verdict === 'passed' ? 'passed' : verdict;
  }

  /** SQL cases left without an expected table get the one the reference query produces. */
  private async fillSqlExpectations(problem: Problem): Promise<Problem> {
    const reference = problem.referenceSolution['sql'];
    const missing = problem.cases.filter((c) => c.enabled && !c.expectedOutput.trim());
    if (!reference?.trim() || missing.length === 0) return problem;
    const result = await this.execute(problem, 'sql', reference, missing);
    if (!result.compile.ok) return problem;
    const filled = new Map<string, string>();
    for (const raw of result.cases) {
      if (raw.exitCode === 0 && !raw.timedOut && raw.stdout.trim())
        filled.set(raw.id, raw.stdout.trim());
    }
    for (const [id, table] of filled) {
      await this.prisma.testCase.update({ where: { id }, data: { expectedOutput: table } });
    }
    this.logger.log(
      { questionId: problem.questionId, filled: filled.size },
      'Filled SQL expected results',
    );
    return {
      ...problem,
      cases: problem.cases.map((c) =>
        filled.has(c.id) ? { ...c, expectedOutput: filled.get(c.id)! } : c,
      ),
    };
  }
}

function toOutcome(c: EvaluatedCase, number: number, revealHidden: boolean): CaseOutcome {
  const hidden = !c.case.isSample;
  const show = !hidden || revealHidden;
  return {
    testCaseId: c.case.id,
    number,
    label: c.case.label || `Test ${number}`,
    hidden,
    verdict: c.verdict,
    passed: c.passed,
    durationMs: c.verdict === 'compile_error' ? null : c.durationMs,
    memoryKb: c.verdict === 'compile_error' ? null : c.memoryKb,
    ...(show
      ? {
          input: c.case.input,
          expectedOutput: c.case.expectedOutput,
          actualOutput: c.stdout.slice(0, SHOWN_CHARS),
          stderr: c.stderr.slice(0, SHOWN_CHARS),
          explanation: c.case.explanation,
        }
      : {}),
  };
}

/**
 * Why a reference solution failed, in words an author can act on: how many cases and what went
 * wrong. A solution that only ran out of time may simply have met a busy sandbox, so the author
 * is told that running the check again is worth a try.
 */
function failureMessage(failed: EvaluatedCase[]): string {
  const reasons = [...new Set(failed.map((c) => VERDICT_LABELS[c.verdict].toLowerCase()))];
  const count = failed.length === 1 ? '1 case failed' : `${failed.length} cases failed`;
  const onlyTime = failed.every((c) => c.verdict === 'timeout');
  return `${count}: ${reasons.join(', ')}${onlyTime ? '. If the solution is right, run the check again' : ''}`;
}
