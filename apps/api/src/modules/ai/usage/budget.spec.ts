import { describe, expect, it } from 'vitest';
import { budgetState } from './budget.js';

describe('the monthly budget’s state (Phase 7D, ADR-0029)', () => {
  const budget = 25_000_000; // $25, in millionths of a dollar

  it('is ok below the warning share, a warning from it, and exceeded at the budget', () => {
    expect(budgetState(0, budget, 80)).toBe('ok');
    expect(budgetState(19_999_999, budget, 80)).toBe('ok');
    expect(budgetState(20_000_000, budget, 80)).toBe('warning');
    expect(budgetState(24_999_999, budget, 80)).toBe('warning');
    expect(budgetState(25_000_000, budget, 80)).toBe('exceeded');
    expect(budgetState(40_000_000, budget, 80)).toBe('exceeded');
  });

  it('warns at the share the settings name', () => {
    expect(budgetState(12_500_000, budget, 50)).toBe('warning');
    expect(budgetState(12_500_000, budget, 95)).toBe('ok');
    expect(budgetState(23_750_000, budget, 95)).toBe('warning');
  });
});
