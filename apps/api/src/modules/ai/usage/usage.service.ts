import { Injectable, Logger } from '@nestjs/common';
import { toLocalDateKey } from '@lms/shared';
import { AuditService } from '../../../core/audit/audit.service.js';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { TenantService } from '../../../core/tenant/tenant.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { AiQuotaExceededError } from '../ai-errors.js';
import { AiUnavailableError } from '../providers/ai-provider.js';
import { ModelRouter } from '../routing/model-router.js';
import { AiSettingsService } from '../settings/ai-settings.service.js';
import { type AiQuotaLimit, type AiQuotaLimits, quotaVerdict } from './quota.js';

/**
 * The ledger's feature for the knowledge base (Phases 8C and 8D), with a task for each use: `embed`,
 * the institute's work — recorded under the person who asked for it, counted in the budget, never
 * in that person's own allowance (ADR-0035) — and `retrieve`, a person's own question to the
 * knowledge base, counted in their allowance like any call they make (ADR-0036).
 */
export const AI_KNOWLEDGE_USAGE_FEATURE = 'knowledge';
export const AI_KNOWLEDGE_EMBED_TASK = 'embed';
export const AI_KNOWLEDGE_RETRIEVE_TASK = 'retrieve';
/** A grounded answer from the knowledge base (Phase 8E): a question, counted as the person's. */
export const AI_KNOWLEDGE_ANSWER_TASK = 'rag_answer';

/** One call to a provider, as the ledger records it. */
export interface AiLedgerCall {
  provider: string;
  model: string;
  fallback: boolean;
  outcome: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  /** The counts are estimates: the provider reported none, or the answer stopped early. */
  estimated: boolean;
  costMicros: number | null;
}

/** What a turn's calls were for, and for whom (ADR-0029: attribution). */
export interface AiLedgerTurn {
  organizationId: string;
  userId: string;
  /** The conversation the calls were for; none for knowledge embedded for the institute (8C). */
  conversationId: string | null;
  /** The answer the calls wrote; none for a title or a summary (Phase 7D). */
  messageId: string | null;
  feature: string;
  task: string;
  dataClass: string;
  requestId: string | null;
  /**
   * The calls carried the person's question, so the day counts one question for them, however
   * many calls it took (Phase 7C). A title or a summary, written in the background, carries none:
   * its tokens and cost count, its calls are no question (Phase 7D).
   */
  question: boolean;
  calls: readonly AiLedgerCall[];
}

export interface AiAllowance {
  requestsLeft: number;
  tokensLeft: number;
}

/** A day of the institute's calendar, as the usage tables store it, and its month's first day. */
export interface AiUsageDay {
  /** `YYYY-MM-DD`, in the institute's time zone. */
  key: string;
  day: Date;
  monthStart: Date;
}

/**
 * Usage and quotas (ADR-0029; Phases 7C–7D). Each person's questions and tokens are counted per day
 * in the institute's time zone; the institute's spend per month against its budget. The allowances
 * are the institute's AI settings, else the deployment's configuration (Phase 7D). The check runs
 * before any call and fails closed: if usage cannot be read, the error stops the question, and
 * while a budget is set no call is made that could not be priced. The record is written once,
 * inside the transaction that closes the answer, or that writes a title or a summary.
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly settings: AiSettingsService,
    private readonly router: ModelRouter,
  ) {}

  /** Today's date (for the usage tables) and the first day of this month, in the institute's zone. */
  async today(now = new Date()): Promise<AiUsageDay> {
    const { timezone } = await this.tenant.getOrganization();
    return usageDayOf(now, timezone);
  }

  /**
   * Refuses a question that would go over an allowance, before any provider is called, and records
   * the refusal. Returns what is left today.
   */
  async assertWithinQuota(
    user: AuthUser,
    conversationId: string | null,
    resourceType = 'ai_conversation',
  ): Promise<AiAllowance> {
    const limits = await this.limits();
    const used = await this.usedNow(user.id, user.organizationId, limits);
    const over = quotaVerdict(used, limits);
    if (over) {
      await this.audit.record({
        action: 'ai.quota.exceeded',
        resourceType,
        resourceId: conversationId,
        summary: `An SI Academy AI question was refused: the ${over} allowance is used`,
        after: { limit: over },
      });
      throw new AiQuotaExceededError(over);
    }
    return this.left(limits, used.requestsToday, used.tokensToday);
  }

  /**
   * Whether a background call for a person — a title, a summary — may be made now (Phase 7D): their
   * tokens today and the institute's budget, as for a question. It asks no question of theirs, so
   * their question count does not stop it. Returns the allowance that stops it, if any.
   */
  async backgroundBlockedBy(userId: string, organizationId: string): Promise<AiQuotaLimit | null> {
    const limits = await this.limits();
    const used = await this.usedNow(userId, organizationId, limits);
    return quotaVerdict({ ...used, requestsToday: 0 }, limits);
  }

  /**
   * Whether the institute's budget lets knowledge be embedded now (Phase 8C; ADR-0035). The
   * embedding is the institute's work, so no person's daily allowance is asked; with a monthly
   * budget set, the embedding model must have a price, and the month's estimated spend must be
   * below the budget (ADR-0029: the check fails closed).
   */
  async embeddingBlockedBy(
    organizationId: string,
    model: string,
  ): Promise<'budget' | 'unpriced' | null> {
    const settings = await this.settings.current();
    if (settings.monthlyBudgetMicros === null) return null;
    if (!this.router.costOf(model)) return 'unpriced';
    const { monthStart } = await this.today();
    const spent = await this.spentSince(organizationId, monthStart);
    return spent >= settings.monthlyBudgetMicros ? 'budget' : null;
  }

  /**
   * Whether a person may question the knowledge base now (Phase 8D; ADR-0036): their tokens today
   * and the institute's budget, as for a background call — a retrieval asks no question of a model,
   * so their question count does not stop it — and, with a budget set, a price for the embedding
   * model (the check fails closed). Returns what stops it, if anything.
   */
  async retrievalBlockedBy(
    userId: string,
    organizationId: string,
    model: string,
  ): Promise<AiQuotaLimit | 'unpriced' | null> {
    const settings = await this.settings.current();
    if (settings.monthlyBudgetMicros !== null && !this.router.costOf(model)) return 'unpriced';
    const limits: AiQuotaLimits = {
      requestsPerDay: settings.dailyQuestions,
      tokensPerDay: settings.dailyTokens,
      monthlyBudgetMicros: settings.monthlyBudgetMicros,
    };
    const used = await this.usedNow(userId, organizationId, limits);
    return quotaVerdict({ ...used, requestsToday: 0 }, limits);
  }

  /** What is left of today's allowance. */
  async allowance(userId: string): Promise<AiAllowance> {
    const limits = await this.limits();
    const { day } = await this.today();
    const usage = await this.prisma.aiUsageDaily.findUnique({
      where: { userId_day: { userId, day } },
      select: { requests: true, totalTokens: true },
    });
    const tokens = await this.ownTokens(userId, day, usage?.totalTokens ?? 0);
    return this.left(limits, usage?.requests ?? 0, tokens);
  }

  /** The institute's estimated spend since the first day of the month, in millionths of a dollar. */
  async spentSince(organizationId: string, monthStart: Date): Promise<number> {
    const sum = await this.prisma.aiUsageDaily.aggregate({
      where: { organizationId, day: { gte: monthStart } },
      _sum: { estimatedCostMicros: true },
    });
    return sum._sum.estimatedCostMicros ?? 0;
  }

  /**
   * Records calls: one ledger row each, marked with the day they are counted on, and the day's
   * totals — one question for a person's question, however many calls it took; none for a title or
   * a summary. Runs inside the transaction that closes the answer, or writes the title or the
   * summary, so it happens once.
   */
  async recordTurn(tx: Prisma.TransactionClient, turn: AiLedgerTurn, day: Date): Promise<void> {
    if (turn.calls.length === 0) return;
    await tx.aiRequest.createMany({
      data: turn.calls.map((call, index) => ({
        organizationId: turn.organizationId,
        userId: turn.userId,
        conversationId: turn.conversationId,
        messageId: turn.messageId,
        feature: turn.feature,
        task: turn.task,
        dataClass: turn.dataClass,
        provider: call.provider,
        model: call.model,
        outcome: call.outcome,
        fallback: call.fallback,
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
        totalTokens: call.inputTokens + call.outputTokens,
        tokensEstimated: call.estimated,
        estimatedCostMicros: call.costMicros,
        latencyMs: call.latencyMs,
        requestId: turn.requestId,
        day,
        countsAsQuestion: turn.question && index === 0,
      })),
    });
    const inputTokens = turn.calls.reduce((sum, call) => sum + call.inputTokens, 0);
    const outputTokens = turn.calls.reduce((sum, call) => sum + call.outputTokens, 0);
    const costMicros = turn.calls.reduce((sum, call) => sum + (call.costMicros ?? 0), 0);
    // At most one call of a question stops while writing, so this counts calls and questions alike.
    const estimated = turn.calls.filter((call) => call.estimated).length;
    const requests = turn.question ? 1 : 0;
    await tx.aiUsageDaily.upsert({
      where: { userId_day: { userId: turn.userId, day } },
      create: {
        organizationId: turn.organizationId,
        userId: turn.userId,
        day,
        requests,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedRequests: estimated,
        estimatedCostMicros: costMicros,
      },
      update: {
        requests: { increment: requests },
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        totalTokens: { increment: inputTokens + outputTokens },
        estimatedRequests: { increment: estimated },
        estimatedCostMicros: { increment: costMicros },
      },
    });
  }

  /**
   * The allowances that apply now: the institute's settings, else the deployment's. While a
   * budget is set, a routed model without a price could not be counted against it, so nothing is
   * called until it has one (ADR-0029: the check fails closed).
   */
  private async limits(): Promise<AiQuotaLimits> {
    const settings = await this.settings.current();
    if (settings.monthlyBudgetMicros !== null) {
      const unpriced = this.router.unpricedModels();
      if (unpriced.length > 0) {
        this.logger.warn(
          { ai: { unpriced } },
          'AI call refused: a monthly budget is set, and a routed model has no price',
        );
        throw new AiUnavailableError();
      }
    }
    return {
      requestsPerDay: settings.dailyQuestions,
      tokensPerDay: settings.dailyTokens,
      monthlyBudgetMicros: settings.monthlyBudgetMicros,
    };
  }

  private async usedNow(userId: string, organizationId: string, limits: AiQuotaLimits) {
    const { day, monthStart } = await this.today();
    const usage = await this.prisma.aiUsageDaily.findUnique({
      where: { userId_day: { userId, day } },
      select: { requests: true, totalTokens: true },
    });
    const spent =
      limits.monthlyBudgetMicros === null ? 0 : await this.spentSince(organizationId, monthStart);
    return {
      requestsToday: usage?.requests ?? 0,
      tokensToday: await this.ownTokens(userId, day, usage?.totalTokens ?? 0),
      spentThisMonthMicros: spent,
    };
  }

  /**
   * A person's tokens today as their allowance counts them. Knowledge they had embedded for the
   * institute (Phase 8C) is in their day's totals, tokens and cost, as the ledger and its roll-up
   * keep it, but it is the institute's work: the budget counts it, their own allowance does not.
   */
  private async ownTokens(userId: string, day: Date, total: number): Promise<number> {
    if (total === 0) return 0;
    const knowledge = await this.prisma.aiRequest.aggregate({
      where: { userId, day, feature: AI_KNOWLEDGE_USAGE_FEATURE, task: AI_KNOWLEDGE_EMBED_TASK },
      _sum: { totalTokens: true },
    });
    return Math.max(0, total - (knowledge._sum.totalTokens ?? 0));
  }

  private left(limits: AiQuotaLimits, requests: number, tokens: number): AiAllowance {
    return {
      requestsLeft: Math.max(0, limits.requestsPerDay - requests),
      tokensLeft: Math.max(0, limits.tokensPerDay - tokens),
    };
  }
}

/** A moment's day in a time zone, as the usage tables store it (a date at midnight UTC). */
export function usageDayOf(now: Date, timeZone: string): AiUsageDay {
  const key = toLocalDateKey(now, timeZone);
  return {
    key,
    day: new Date(`${key}T00:00:00.000Z`),
    monthStart: new Date(`${key.slice(0, 7)}-01T00:00:00.000Z`),
  };
}
