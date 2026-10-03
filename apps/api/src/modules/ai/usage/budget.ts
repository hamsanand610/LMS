import type { AiBudgetState } from '@lms/shared';

/**
 * Where a month's estimated spend stands against the institute's budget (ADR-0029; Phase 7D):
 * `exceeded` at the budget or over it — no provider is called then — `warning` from the share the
 * AI settings name (80% by default), `ok` below that. Spend and budget in millionths of a dollar.
 */
export function budgetState(
  spentMicros: number,
  budgetMicros: number,
  warningPercent: number,
): AiBudgetState {
  if (spentMicros >= budgetMicros) return 'exceeded';
  if (spentMicros * 100 >= budgetMicros * warningPercent) return 'warning';
  return 'ok';
}
