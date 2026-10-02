/**
 * The shape of SI Academy's question bank as data. Everything here is original writing for this
 * institute. Coding, SQL, debugging and web questions carry reference solutions and cases whose
 * outcomes are proved by running them in the sandbox (`pnpm --filter @lms/api verify:questions`);
 * the seed itself never runs code (ADR-0007).
 */
import type {
  CodeLanguage,
  CompareMode,
  QuestionDifficulty,
  QuestionSpec,
  WebCheck,
  WebFiles,
} from '@lms/shared';

export type Level = QuestionDifficulty;

interface Base {
  /** Stable across re-seeding; the question's key in the bank. */
  slug: string;
  title: string;
  /** Plain text; ``` fences for code, `backticks` for short code. */
  body: string;
  /** A key of the `subject` taxonomy (the technology). */
  technology: string;
  /** A key of the `topic` taxonomy. */
  topic: string;
  level: Level;
  marks: number;
  tags?: string[];
  hints?: string[];
  /** The worked answer, shown when the assignment's rules allow. */
  explanation?: string;
}

export interface ChoiceQuestion extends Base {
  type: 'mcq_single' | 'mcq_multi';
  /** [text, correct, why] */
  options: [string, boolean, string?][];
}

export interface TrueFalseQuestion extends Base {
  type: 'true_false';
  answer: boolean;
}

export interface WrittenQuestion extends Base {
  type: 'descriptive';
  rubric: string;
}

export interface HandInQuestion extends Base {
  type: 'file_upload' | 'practical' | 'project';
  rubric: string;
  spec: QuestionSpec;
}

export interface Case {
  input: string;
  expected: string;
  /** Shown to the learner as an example; hidden otherwise. */
  sample?: boolean;
  label?: string;
  explanation?: string;
  weight?: number;
}

export interface CodingQuestion extends Base {
  type: 'coding';
  languages: CodeLanguage[];
  starter: Partial<Record<CodeLanguage, string>>;
  solution: Partial<Record<CodeLanguage, string>>;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  compareMode?: CompareMode;
  timeLimitMs?: number;
  cases: Case[];
  /** Offered on the Practice page for this many points. */
  practicePoints?: number;
}

export interface SqlQuestion extends Base {
  type: 'sql';
  setupSql: string;
  /** For questions that change data: the query whose result is compared. */
  sqlCheck?: string;
  starter?: string;
  solution: string;
  compareMode: 'rows' | 'rows_unordered';
  /** `input` holds statements that add this case's own rows (may be empty). */
  cases: Case[];
  practicePoints?: number;
}

/**
 * A debugging lab (ADR-0018): a program with a bug in it. The fixed program passes every case and
 * the code with the bug fails at least one, both proved in the sandbox.
 */
export interface DebuggingQuestion extends Base {
  type: 'debugging';
  languages: CodeLanguage[];
  /** The code with the bug, which learners start from. */
  starter: Partial<Record<CodeLanguage, string>>;
  /** The fixed program. */
  solution: Partial<Record<CodeLanguage, string>>;
  /** What the program should do once it is fixed; learners read it beside the code. */
  expectedBehaviour: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  compareMode?: CompareMode;
  timeLimitMs?: number;
  cases: Case[];
  practicePoints?: number;
}

/** One check of a web lab, which becomes one of its cases (ADR-0019). */
export interface WebCheckCase {
  check: WebCheck;
  sample?: boolean;
  label?: string;
  weight?: number;
}

/** A web lab (ADR-0019): a page's starting files, files that pass every check, and the checks. */
export interface WebLabQuestion extends Base {
  type: 'web';
  starter: WebFiles;
  solution: WebFiles;
  checks: WebCheckCase[];
  timeLimitMs?: number;
  practicePoints?: number;
}

/** The questions whose answers run in the sandbox. */
export type RunnableQuestion = CodingQuestion | SqlQuestion | DebuggingQuestion | WebLabQuestion;

export type BankQuestion =
  | ChoiceQuestion
  | TrueFalseQuestion
  | WrittenQuestion
  | HandInQuestion
  | CodingQuestion
  | SqlQuestion
  | DebuggingQuestion
  | WebLabQuestion;

/**
 * An answer a seeded learner submitted, stored as they wrote it. Its outcome is not written by hand:
 * the verification suite runs the code in the sandbox and checks it produces `passed` cases.
 */
export interface SeededAttempt {
  question: string;
  language: CodeLanguage | 'sql';
  code: string;
  /** How many of the question's enabled cases this code passes, as proved in the sandbox. */
  passed: number;
}

/** The standard Java entry point every starter uses. */
export function javaMain(body: string, imports = 'import java.util.*;\n\n'): string {
  const indented = body
    .split('\n')
    .map((line) => (line ? `        ${line}` : ''))
    .join('\n');
  return `${imports}public class Main {\n    public static void main(String[] args) {\n${indented}\n    }\n}\n`;
}
