import type { CompareMode, ExecutionVerdict, SandboxCaseResult } from '@lms/shared';

/**
 * How a program's output is judged against what a case expects. This runs in the API, which is
 * the only place expected outputs exist (ADR-0016): the sandbox reports what was printed, and
 * this decides whether it was right.
 */

const FLOAT_TOLERANCE = 1e-6;

function lines(text: string): string[] {
  const all = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''));
  while (all.length > 0 && all[all.length - 1] === '') all.pop();
  return all;
}

function tokens(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function sameNumber(a: string, b: string): boolean {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y) || a.trim() === '' || b.trim() === '') {
    return a === b;
  }
  return Math.abs(x - y) <= FLOAT_TOLERANCE * Math.max(1, Math.abs(x), Math.abs(y));
}

/** Whether printed output matches the expected output under a text comparison mode. */
export function outputsMatch(mode: CompareMode, expected: string, actual: string): boolean {
  switch (mode) {
    case 'exact':
      return expected.replace(/\r\n?/g, '\n') === actual.replace(/\r\n?/g, '\n');
    case 'tokens': {
      const e = tokens(expected);
      const a = tokens(actual);
      return e.length === a.length && e.every((t, i) => t === a[i]);
    }
    case 'unordered_lines': {
      const e = lines(expected).sort();
      const a = lines(actual).sort();
      return e.length === a.length && e.every((l, i) => l === a[i]);
    }
    case 'float': {
      const e = tokens(expected);
      const a = tokens(actual);
      return e.length === a.length && e.every((t, i) => sameNumber(t, a[i] ?? ''));
    }
    case 'rows':
    case 'rows_unordered':
      return tablesMatch(mode, expected, actual);
    case 'trim':
    default: {
      const e = lines(expected);
      const a = lines(actual);
      return e.length === a.length && e.every((l, i) => l === a[i]);
    }
  }
}

/** A result table as the SQL harness prints it. */
export interface ResultTable {
  columns: string[];
  rows: unknown[][];
  rowCount?: number;
  truncated?: boolean;
}

export function parseTable(text: string): ResultTable | null {
  try {
    const value = JSON.parse(text) as Partial<ResultTable>;
    if (!Array.isArray(value.columns) || !Array.isArray(value.rows)) return null;
    if (!value.rows.every((row) => Array.isArray(row))) return null;
    return { columns: value.columns.map(String), rows: value.rows as unknown[][] };
  } catch {
    return null;
  }
}

/** One cell as it is compared: numbers by value, text exactly, NULL as NULL. */
function cellKey(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return `n:${Number(value.toFixed(6))}`;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    // SQLite may return a numeric column as text; `42` and 42 are the same answer.
    return `n:${Number(Number(value).toFixed(6))}`;
  }
  return `s:${String(value)}`;
}

/**
 * Whether two result tables hold the same answer. Column names are not compared (an alias is not
 * a mistake); the number of columns and every value are. `rows` also compares the order, which is
 * what a question with an ORDER BY is about.
 */
export function tablesMatch(
  mode: 'rows' | 'rows_unordered',
  expectedJson: string,
  actualJson: string,
): boolean {
  const expected = parseTable(expectedJson);
  const actual = parseTable(actualJson);
  if (!expected || !actual) return false;
  if (expected.columns.length !== actual.columns.length) return false;
  if (expected.rows.length !== actual.rows.length) return false;
  const keys = (table: ResultTable) => table.rows.map((row) => row.map(cellKey).join('\u0001'));
  const e = keys(expected);
  const a = keys(actual);
  if (mode === 'rows_unordered') {
    e.sort();
    a.sort();
  }
  return e.every((row, i) => row === a[i]);
}

/** Stderr fragments that mean the runtime ran out of memory rather than crashed. */
const OUT_OF_MEMORY = /OutOfMemoryError|MemoryError|heap out of memory|Allowed memory size/;

/**
 * What happened to one case. Anything that stopped the program early (time, memory, a crash, too
 * much output) is reported as that, even if what it printed so far happened to match.
 */
export function caseVerdict(
  raw: SandboxCaseResult,
  mode: CompareMode,
  expectedOutput: string,
): ExecutionVerdict {
  if (raw.timedOut) return 'timeout';
  // SIGKILL without a timeout is the container's memory limit stepping in.
  if (raw.memoryExceeded || raw.signal === 9 || OUT_OF_MEMORY.test(raw.stderr)) {
    return 'memory_limit';
  }
  if (raw.truncated) return 'output_limit';
  if (raw.exitCode !== 0 || raw.signal !== null) return 'runtime_error';
  return outputsMatch(mode, expectedOutput, raw.stdout) ? 'passed' : 'wrong_answer';
}
