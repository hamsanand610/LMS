import type { SandboxCaseResult } from '@lms/shared';
import { describe, expect, it } from 'vitest';
import { caseVerdict, outputsMatch, tablesMatch } from './compare.js';

describe('comparing printed output', () => {
  it('ignores trailing spaces, trailing blank lines and Windows line endings by default', () => {
    expect(outputsMatch('trim', '1 2 3\n4\n', '1 2 3   \r\n4\r\n\r\n')).toBe(true);
    expect(outputsMatch('trim', '1 2 3', '1  2 3')).toBe(false);
    expect(outputsMatch('trim', 'Yes', 'yes')).toBe(false);
  });

  it('can be exact, spacing-blind, order-blind or numeric', () => {
    expect(outputsMatch('exact', 'a\n', 'a')).toBe(false);
    expect(outputsMatch('tokens', '1 2\n3', ' 1\n2  3 ')).toBe(true);
    expect(outputsMatch('unordered_lines', 'b\na\n', 'a\nb')).toBe(true);
    expect(outputsMatch('float', '3.3333333', '3.33333334')).toBe(true);
    expect(outputsMatch('float', '3.33', '3.34')).toBe(false);
    expect(outputsMatch('float', 'NaN', 'NaN')).toBe(true);
  });
});

describe('comparing result tables', () => {
  const table = (columns: string[], rows: unknown[][]) => JSON.stringify({ columns, rows });

  it('compares values, not column names, and numbers by value', () => {
    expect(
      tablesMatch(
        'rows',
        table(['name', 'total'], [['Asha', 3]]),
        table(['n', 'COUNT(*)'], [['Asha', '3']]),
      ),
    ).toBe(true);
    expect(tablesMatch('rows', table(['a'], [[1.0]]), table(['a'], [[1.0000001]]))).toBe(true);
    expect(tablesMatch('rows', table(['a'], [[null]]), table(['a'], [['null']]))).toBe(false);
  });

  it('checks the order only when the question asks for it', () => {
    const expected = table(['id'], [[1], [2]]);
    const reversed = table(['id'], [[2], [1]]);
    expect(tablesMatch('rows', expected, reversed)).toBe(false);
    expect(tablesMatch('rows_unordered', expected, reversed)).toBe(true);
  });

  it('refuses a different number of columns or rows, and anything that is not a table', () => {
    expect(tablesMatch('rows', table(['a'], [[1]]), table(['a', 'b'], [[1, 2]]))).toBe(false);
    expect(tablesMatch('rows', table(['a'], [[1]]), table(['a'], [[1], [1]]))).toBe(false);
    expect(tablesMatch('rows', table(['a'], [[1]]), 'SQL error: no such table')).toBe(false);
  });
});

describe('a case verdict', () => {
  const raw = (overrides: Partial<SandboxCaseResult> = {}): SandboxCaseResult => ({
    id: 'c1',
    stdout: '5\n',
    stderr: '',
    exitCode: 0,
    signal: null,
    timedOut: false,
    memoryExceeded: false,
    durationMs: 20,
    memoryKb: 9000,
    truncated: false,
    ...overrides,
  });

  it('passes matching output from a clean exit', () => {
    expect(caseVerdict(raw(), 'trim', '5')).toBe('passed');
    expect(caseVerdict(raw({ stdout: '6\n' }), 'trim', '5')).toBe('wrong_answer');
  });

  it('names what stopped the program, even when the output so far matched', () => {
    expect(caseVerdict(raw({ timedOut: true }), 'trim', '5')).toBe('timeout');
    expect(caseVerdict(raw({ signal: 9, exitCode: null }), 'trim', '5')).toBe('memory_limit');
    expect(
      caseVerdict(
        raw({ exitCode: 1, stderr: 'java.lang.OutOfMemoryError: Java heap space' }),
        'trim',
        '5',
      ),
    ).toBe('memory_limit');
    expect(caseVerdict(raw({ truncated: true }), 'trim', '5')).toBe('output_limit');
    expect(caseVerdict(raw({ exitCode: 1, stderr: 'Traceback' }), 'trim', '5')).toBe(
      'runtime_error',
    );
  });
});
