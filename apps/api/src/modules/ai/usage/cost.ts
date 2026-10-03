import type { AiModelCost } from '../../../core/config/env.js';
import type { AiUsage } from '../providers/ai-provider.js';

/**
 * What a call is estimated to cost (ADR-0029), from the prices configured in AI_MODEL_COSTS — the
 * only place prices come from. Null when the model has no configured price: unknown, never zero.
 * An estimate for the institute's own budget, not a bill.
 */
export function estimateCostUsd(
  usage: Pick<AiUsage, 'inputTokens' | 'outputTokens'>,
  cost: AiModelCost | null | undefined,
): number | null {
  if (!cost) return null;
  return (
    (usage.inputTokens * cost.inputUsdPerMillion + usage.outputTokens * cost.outputUsdPerMillion) /
    1_000_000
  );
}

/** US dollars as millionths, the unit the usage tables store (whole numbers add up exactly). */
export function toMicros(usd: number | null): number | null {
  return usd === null ? null : Math.round(usd * 1_000_000);
}

/** A rough token count for text a provider did not count for us: about four characters a token. */
export function estimateTokens(characters: number): number {
  return Math.ceil(characters / 4);
}
