import { Inject, Injectable } from '@nestjs/common';
import { toLocalDateKey } from '@lms/shared';
import { AuditService } from '../../../core/audit/audit.service.js';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { APP_CONFIG, type AppConfig } from '../../../core/config/env.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { TenantService } from '../../../core/tenant/tenant.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { AiQuotaExceededError } from '../ai-errors.js';
import { type AiQuotaLimits, quotaVerdict } from './quota.js';

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
  conversationId: string;
  messageId: string;
  feature: string;
  task: string;
  dataClass: string;
  requestId: string | null;
  calls: readonly AiLedgerCall[];
}

export interface AiAllowance {
  requestsLeft: number;
  tokensLeft: number;
}

/**
 * Usage and quotas (ADR-0029; Phase 7C). Each person's questions and tokens are counted per day in
 * the institute's time zone; the institute's spend per month against its budget. The check runs
 * before any call and fails closed: if usage cannot be read, the error stops the question. The
 * record is written once, inside the transaction that closes the answer.
 */
@Injectable()
export class AiUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Today's date (for the usage table) and the first day of this month, in the institute's zone. */
  async today(now = new Date()): Promise<{ day: Date; monthStart: Date }> {
    const { timezone } = await this.tenant.getOrganization();
    const key = toLocalDateKey(now, timezone);
    return {
      day: new Date(`${key}T00:00:00.000Z`),
      monthStart: new Date(`${key.slice(0, 7)}-01T00:00:00.000Z`),
    };
  }

  /**
   * Refuses a question that would go over an allowance, before any provider is called, and records
   * the refusal. Returns what is left today.
   */
  async assertWithinQuota(user: AuthUser, conversationId: string): Promise<AiAllowance> {
    const limits = this.limits();
    const { day, monthStart } = await this.today();
    const usage = await this.prisma.aiUsageDaily.findUnique({
      where: { userId_day: { userId: user.id, day } },
      select: { requests: true, totalTokens: true },
    });
    const spent =
      limits.monthlyBudgetMicros === null
        ? 0
        : ((
            await this.prisma.aiUsageDaily.aggregate({
              where: { organizationId: user.organizationId, day: { gte: monthStart } },
              _sum: { estimatedCostMicros: true },
            })
          )._sum.estimatedCostMicros ?? 0);
    const used = {
      requestsToday: usage?.requests ?? 0,
      tokensToday: usage?.totalTokens ?? 0,
      spentThisMonthMicros: spent,
    };
    const over = quotaVerdict(used, limits);
    if (over) {
      await this.audit.record({
        action: 'ai.quota.exceeded',
        resourceType: 'ai_conversation',
        resourceId: conversationId,
        summary: `An SI Academy AI question was refused: the ${over} allowance is used`,
        after: { limit: over },
      });
      throw new AiQuotaExceededError(over);
    }
    return this.left(limits, used.requestsToday, used.tokensToday);
  }

  /** What is left of today's allowance. */
  async allowance(userId: string): Promise<AiAllowance> {
    const { day } = await this.today();
    const usage = await this.prisma.aiUsageDaily.findUnique({
      where: { userId_day: { userId, day } },
      select: { requests: true, totalTokens: true },
    });
    return this.left(this.limits(), usage?.requests ?? 0, usage?.totalTokens ?? 0);
  }

  /**
   * Records a turn's calls: one ledger row per call, and the day's totals — one question, however
   * many calls it took. Runs inside the transaction that closes the answer, so it happens once.
   */
  async recordTurn(tx: Prisma.TransactionClient, turn: AiLedgerTurn, day: Date): Promise<void> {
    if (turn.calls.length === 0) return;
    await tx.aiRequest.createMany({
      data: turn.calls.map((call) => ({
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
      })),
    });
    const inputTokens = turn.calls.reduce((sum, call) => sum + call.inputTokens, 0);
    const outputTokens = turn.calls.reduce((sum, call) => sum + call.outputTokens, 0);
    const costMicros = turn.calls.reduce((sum, call) => sum + (call.costMicros ?? 0), 0);
    const estimated = turn.calls.some((call) => call.estimated) ? 1 : 0;
    await tx.aiUsageDaily.upsert({
      where: { userId_day: { userId: turn.userId, day } },
      create: {
        organizationId: turn.organizationId,
        userId: turn.userId,
        day,
        requests: 1,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedRequests: estimated,
        estimatedCostMicros: costMicros,
      },
      update: {
        requests: { increment: 1 },
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        totalTokens: { increment: inputTokens + outputTokens },
        estimatedRequests: { increment: estimated },
        estimatedCostMicros: { increment: costMicros },
      },
    });
  }

  private limits(): AiQuotaLimits {
    return {
      requestsPerDay: this.config.AI_USER_DAILY_REQUESTS,
      tokensPerDay: this.config.AI_USER_DAILY_TOKENS,
      monthlyBudgetMicros:
        this.config.AI_ORG_MONTHLY_BUDGET_USD === null
          ? null
          : Math.round(this.config.AI_ORG_MONTHLY_BUDGET_USD * 1_000_000),
    };
  }

  private left(limits: AiQuotaLimits, requests: number, tokens: number): AiAllowance {
    return {
      requestsLeft: Math.max(0, limits.requestsPerDay - requests),
      tokensLeft: Math.max(0, limits.tokensPerDay - tokens),
    };
  }
}
