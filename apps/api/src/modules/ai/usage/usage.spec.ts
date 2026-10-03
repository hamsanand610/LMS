import { describe, expect, it } from 'vitest';
import { titleFrom } from '../conversations/conversations.service.js';
import { estimateCostUsd, estimateTokens, toMicros } from './cost.js';
import { quotaVerdict } from './quota.js';

const limits = { requestsPerDay: 50, tokensPerDay: 100_000, monthlyBudgetMicros: null };
const fresh = { requestsToday: 0, tokensToday: 0, spentThisMonthMicros: 0 };

describe('quotas (ADR-0029, Phase 7C)', () => {
  it('lets a question through below every allowance', () => {
    expect(quotaVerdict(fresh, limits)).toBeNull();
    expect(quotaVerdict({ ...fresh, requestsToday: 49, tokensToday: 99_999 }, limits)).toBeNull();
  });

  it('refuses at the daily question or token allowance', () => {
    expect(quotaVerdict({ ...fresh, requestsToday: 50 }, limits)).toBe('requests');
    expect(quotaVerdict({ ...fresh, tokensToday: 100_000 }, limits)).toBe('tokens');
  });

  it('refuses once the institute’s monthly budget is spent, when there is one', () => {
    const budget = { ...limits, monthlyBudgetMicros: 25_000_000 };
    expect(quotaVerdict({ ...fresh, spentThisMonthMicros: 24_999_999 }, budget)).toBeNull();
    expect(quotaVerdict({ ...fresh, spentThisMonthMicros: 25_000_000 }, budget)).toBe('budget');
    expect(quotaVerdict({ ...fresh, spentThisMonthMicros: 10 ** 12 }, limits)).toBeNull();
  });
});

describe('cost estimates', () => {
  it('come from the configured price only, and are unknown without one', () => {
    const price = { inputUsdPerMillion: 0.5, outputUsdPerMillion: 3 };
    expect(estimateCostUsd({ inputTokens: 1000, outputTokens: 200 }, price)).toBeCloseTo(
      (1000 * 0.5 + 200 * 3) / 1_000_000,
      12,
    );
    expect(estimateCostUsd({ inputTokens: 1000, outputTokens: 200 }, null)).toBeNull();
    expect(toMicros(0.0011)).toBe(1100);
    expect(toMicros(null)).toBeNull();
  });

  it('estimate tokens at about four characters each', () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(9)).toBe(3);
  });
});

describe('conversation titles', () => {
  it('come from the first line of the first question, shortened', () => {
    expect(titleFrom('  What is   a class?\nMore detail')).toBe('What is a class?');
    const long = titleFrom('x'.repeat(100));
    expect(long).toHaveLength(60);
    expect(long.endsWith('…')).toBe(true);
  });
});
