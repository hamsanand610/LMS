import { describe, expect, it } from 'vitest';
import { humaniseKey } from './labels.js';

describe('humaniseKey', () => {
  it('writes keys the way people write them', () => {
    expect(humaniseKey('mock_test')).toBe('Mock test');
    expect(humaniseKey('data-structures')).toBe('Data structures');
    expect(humaniseKey('core-java')).toBe('Core Java');
    expect(humaniseKey('sql')).toBe('SQL');
    expect(humaniseKey('html-css')).toBe('HTML/CSS');
    expect(humaniseKey('javascript')).toBe('JavaScript');
    expect(humaniseKey('problem-solving')).toBe('Problem solving');
  });
});
