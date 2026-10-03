import { Injectable } from '@nestjs/common';
import {
  type AiUsageQuery,
  type AiUsageReport,
  addDaysToDateKey,
  aiUsageReportSchema,
  toLocalDateKey,
} from '@lms/shared';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { ValidationError } from '../../../core/http/errors.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { ScopeService } from '../../../core/scope/scope.service.js';
import { TenantService } from '../../../core/tenant/tenant.service.js';
import { AiSettingsService } from '../settings/ai-settings.service.js';
import { budgetState } from './budget.js';
import { AiUsageService, usageDayOf } from './usage.service.js';

/** The longest period one report covers. */
const MAX_DAYS = 92;
/** What erased people's usage is shown as: it belongs to nobody. */
const ERASED = 'Erased learner';

/** Figures as they are added up: cost in millionths of a dollar, whole numbers that add exactly. */
interface Figures {
  questions: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCalls: number;
  estimatedCostMicros: number;
}

const empty = (): Figures => ({
  questions: 0,
  inputTokens: 0,
  outputTokens: 0,
  estimatedCalls: 0,
  estimatedCostMicros: 0,
});

/** Figures as the report gives them: cost in dollars. */
function shown({ estimatedCostMicros, ...figures }: Figures) {
  return { ...figures, estimatedCostUsd: estimatedCostMicros / 1_000_000 };
}

/**
 * AI usage for a period (Phase 7D; ADR-0029), read from the daily totals: per day and per person,
 * for `ai:usage_read` — everyone for an administrator, the learners of a trainer's batches for a
 * trainer. Figures only, never a question or an answer, and costs said to be estimates. Those who
 * see the whole institute also see where this month stands against its budget.
 */
@Injectable()
export class AiUsageReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageService,
  ) {}

  async report(user: AuthUser, query: AiUsageQuery): Promise<AiUsageReport> {
    const org = await this.tenant.getOrganization();
    const today = toLocalDateKey(new Date(), org.timezone);
    const to = query.to ?? today;
    const from =
      query.from ?? (query.to ? addDaysToDateKey(to, -(MAX_DAYS - 1)) : `${today.slice(0, 8)}01`);
    if (from > to || addDaysToDateKey(from, MAX_DAYS - 1) < to) {
      throw new ValidationError([{ path: 'from', message: `At most ${MAX_DAYS} days at a time` }]);
    }

    // A trainer sees the learners of the batches they teach; an administrator, everyone.
    const batchIds = await this.scope.visibleBatchIds(user, 'ai:usage_read');
    const learnerIds =
      batchIds === null
        ? null
        : (
            await this.prisma.batchMember.findMany({
              where: { batchId: { in: batchIds }, isActive: true },
              select: { student: { select: { userId: true } } },
              distinct: ['studentId'],
            })
          ).map((member) => member.student.userId);

    const rows = await this.prisma.aiUsageDaily.findMany({
      where: {
        organizationId: org.id,
        day: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) },
        ...(learnerIds ? { userId: { in: learnerIds } } : {}),
      },
      orderBy: { day: 'asc' },
    });

    const totals = empty();
    const days = new Map<string, Figures>();
    const people = new Map<string | null, Figures>();
    for (const row of rows) {
      const figures: Figures = {
        questions: row.requests,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        estimatedCalls: row.estimatedRequests,
        estimatedCostMicros: row.estimatedCostMicros,
      };
      const day = row.day.toISOString().slice(0, 10);
      add(totals, figures);
      add(days.get(day) ?? days.set(day, empty()).get(day)!, figures);
      add(people.get(row.userId) ?? people.set(row.userId, empty()).get(row.userId)!, figures);
    }
    const ids = [...people.keys()].filter((id): id is string => id !== null);
    const names = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      ).map((person) => [person.id, person.name]),
    );

    return aiUsageReportSchema.parse({
      from,
      to,
      costsAreEstimates: true,
      totals: shown(totals),
      days: [...days].map(([day, figures]) => ({ day, ...shown(figures) })),
      people: [...people]
        .sort(
          ([, a], [, b]) =>
            b.estimatedCostMicros - a.estimatedCostMicros || b.questions - a.questions,
        )
        .map(([userId, figures]) => ({
          userId,
          name: userId ? (names.get(userId) ?? ERASED) : ERASED,
          ...shown(figures),
        })),
      budget: batchIds === null ? await this.budget(org.id, org.timezone) : null,
    });
  }

  private async budget(organizationId: string, timeZone: string): Promise<AiUsageReport['budget']> {
    const { monthlyBudgetMicros, budgetWarningPercent } = await this.settings.current();
    if (monthlyBudgetMicros === null) return null;
    const { key, monthStart } = usageDayOf(new Date(), timeZone);
    const spent = await this.usage.spentSince(organizationId, monthStart);
    return {
      month: key.slice(0, 7),
      budgetUsd: monthlyBudgetMicros / 1_000_000,
      spentUsd: spent / 1_000_000,
      percent: Math.round((spent * 10_000) / monthlyBudgetMicros) / 100,
      state: budgetState(spent, monthlyBudgetMicros, budgetWarningPercent),
    };
  }
}

function add(into: Figures, figures: Figures): void {
  into.questions += figures.questions;
  into.inputTokens += figures.inputTokens;
  into.outputTokens += figures.outputTokens;
  into.estimatedCalls += figures.estimatedCalls;
  into.estimatedCostMicros += figures.estimatedCostMicros;
}
