import { describe, expect, it } from 'vitest';
import { computeCompleteness } from './students.service.js';

const empty = { mobile: null, personal: {}, education: [], summary: '', skills: [] };

describe('computeCompleteness', () => {
  it('is zero for a record with nothing filled in', () => {
    expect(computeCompleteness(empty)).toBe(0);
  });

  it('is one hundred when every section is filled', () => {
    expect(
      computeCompleteness({
        mobile: '+919876543210',
        personal: { dateOfBirth: '2004-01-01', city: 'Chennai', state: 'Tamil Nadu' },
        education: [{ qualification: 'B.E.' }],
        summary: 'A short paragraph that is long enough to count.',
        skills: ['Java', 'SQL', 'HTML'],
      }),
    ).toBe(100);
  });

  it('weights each section it can see', () => {
    expect(computeCompleteness({ ...empty, mobile: '+919876543210' })).toBe(20);
    expect(computeCompleteness({ ...empty, education: [{ qualification: 'B.E.' }] })).toBe(25);
    expect(computeCompleteness({ ...empty, skills: ['Java', 'SQL', 'HTML'] })).toBe(20);
  });

  it('needs two personal fields and three skills before they count', () => {
    expect(computeCompleteness({ ...empty, personal: { city: 'Chennai' } })).toBe(0);
    expect(
      computeCompleteness({
        ...empty,
        personal: { city: 'Chennai', state: '', dateOfBirth: '2004-01-01' },
      }),
    ).toBe(25);
    expect(computeCompleteness({ ...empty, skills: ['Java', 'SQL'] })).toBe(0);
  });

  it('ignores a summary that is too short to be one', () => {
    expect(computeCompleteness({ ...empty, summary: 'Hi' })).toBe(0);
    expect(
      computeCompleteness({ ...empty, summary: 'A sentence long enough to be a summary.' }),
    ).toBe(10);
  });
});
