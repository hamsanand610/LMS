/** The allowance a question would go over (ADR-0029). */
export type AiQuotaLimit = 'requests' | 'tokens' | 'budget';

export interface AiQuotaLimits {
  requestsPerDay: number;
  tokensPerDay: number;
  /** Millionths of a US dollar; null: no monthly budget. */
  monthlyBudgetMicros: number | null;
}

export interface AiQuotaUsed {
  requestsToday: number;
  tokensToday: number;
  spentThisMonthMicros: number;
}

/**
 * Whether a new question would go over an allowance (ADR-0029): the person's questions or tokens
 * today, or the institute's budget this month. Checked before any call. A question's own size is
 * not known in advance, so the last one of a day may finish a little over the token allowance; the
 * output limit (AI_MAX_OUTPUT_TOKENS) and the context window bound by how much.
 */
export function quotaVerdict(used: AiQuotaUsed, limits: AiQuotaLimits): AiQuotaLimit | null {
  if (used.requestsToday >= limits.requestsPerDay) return 'requests';
  if (used.tokensToday >= limits.tokensPerDay) return 'tokens';
  if (
    limits.monthlyBudgetMicros !== null &&
    used.spentThisMonthMicros >= limits.monthlyBudgetMicros
  ) {
    return 'budget';
  }
  return null;
}
