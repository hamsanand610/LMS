import { describe, expect, it } from 'vitest';
import { ineligibleReasons } from './drives.service.js';

const labels = {
  batches: new Map([
    ['b1', 'JFS-2026-B1'],
    ['b2', 'JFS-2026-B2'],
  ]),
  programs: new Map([['p1', 'Java Full-Stack']]),
};
const learner = { batchIds: ['b1'], programIds: ['p1'], attendancePct: 80 as number | null };
const open = { batchIds: [], programIds: [], minAttendancePct: null };

describe('drive eligibility (ADR-0014)', () => {
  it('lets anybody apply when the drive sets no rule', () => {
    expect(ineligibleReasons(open, learner, labels)).toEqual([]);
  });

  it('names the batches a drive is limited to', () => {
    expect(ineligibleReasons({ ...open, batchIds: ['b2'] }, learner, labels)).toEqual([
      'Open to JFS-2026-B2 only.',
    ]);
    expect(ineligibleReasons({ ...open, batchIds: ['b1', 'b2'] }, learner, labels)).toEqual([]);
  });

  it('checks the programme', () => {
    expect(
      ineligibleReasons({ ...open, programIds: ['p1'] }, { ...learner, programIds: [] }, labels),
    ).toEqual(['Open to the Java Full-Stack programme only.']);
  });

  it('says how far attendance falls short', () => {
    expect(ineligibleReasons({ ...open, minAttendancePct: 85 }, learner, labels)).toEqual([
      'Needs 85% attendance; yours is 80%.',
    ]);
    expect(ineligibleReasons({ ...open, minAttendancePct: 80 }, learner, labels)).toEqual([]);
  });

  it('does not hold an unmeasured attendance against a learner', () => {
    expect(
      ineligibleReasons(
        { ...open, minAttendancePct: 90 },
        { ...learner, attendancePct: null },
        labels,
      ),
    ).toEqual([]);
  });

  it('gives every reason that applies, not just the first', () => {
    expect(
      ineligibleReasons(
        { batchIds: ['b2'], programIds: [], minAttendancePct: 95 },
        learner,
        labels,
      ),
    ).toHaveLength(2);
  });
});
