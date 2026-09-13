import { describe, expect, it } from 'vitest';
import { formatStudentCode, nextSequence, parseStudentCode } from './student-code.js';

describe('student codes', () => {
  it('pads the sequence to four digits and keeps growing beyond it', () => {
    expect(formatStudentCode(2026, 1)).toBe('STU-2026-0001');
    expect(formatStudentCode(2026, 42)).toBe('STU-2026-0042');
    expect(formatStudentCode(2026, 12345)).toBe('STU-2026-12345');
  });

  it('reads a code back, and refuses one of another shape', () => {
    expect(parseStudentCode('STU-2026-0042')).toEqual({ year: 2026, sequence: 42 });
    expect(parseStudentCode('STU-2026-12345')).toEqual({ year: 2026, sequence: 12345 });
    expect(parseStudentCode('EMP-2026-0042')).toBeNull();
    expect(parseStudentCode('STU-2026-7')).toBeNull();
  });

  it('continues after the highest code of that year and ignores other years', () => {
    expect(nextSequence([], 2026)).toBe(1);
    expect(nextSequence(['STU-2026-0001', 'STU-2026-0007', 'STU-2026-0003'], 2026)).toBe(8);
    expect(nextSequence(['STU-2025-0099'], 2026), 'a new year starts again at one').toBe(1);
    expect(nextSequence(['legacy-code', 'STU-2026-0002'], 2026)).toBe(3);
  });
});
