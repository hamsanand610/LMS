import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { AiBudgetState } from '@lms/shared';
import { AuditService } from '../../../core/audit/audit.service.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { JobsService } from '../../../core/queue/jobs.service.js';
import { TenantService } from '../../../core/tenant/tenant.service.js';
import { AiSettingsService } from '../settings/ai-settings.service.js';
import { budgetState } from '../usage/budget.js';
import { AiUsageService, usageDayOf } from '../usage/usage.service.js';
import { AI_JOBS } from './ai-jobs.js';

/** The settings rows that remember the month each alert was last raised for. */
export const BUDGET_ALERT_KEYS = {
  warning: 'ai.budget_warning',
  exceeded: 'ai.budget_exceeded',
} as const;

type AlertLevel = keyof typeof BUDGET_ALERT_KEYS;

export interface AiBudgetCheck {
  /** `YYYY-MM`, in the institute's time zone. */
  month: string;
  state: AiBudgetState;
  spentMicros: number;
  budgetMicros: number;
  /** The alerts this check raised: each at most once a month. */
  raised: AlertLevel[];
}

/**
 * Budget alerts (Phase 7D; ADR-0029), every quarter of an hour. With a monthly budget set — the
 * institute's or the deployment's — the month's estimated spend is compared with it. Reaching the
 * warning share (80% by default) records `ai.budget.warning`, reaching the budget
 * `ai.budget.exceeded`, each once a month however often the check runs, on however many workers:
 * the alert is claimed by moving its settings row onto the month first, and only the claim that
 * moved it records it. Nothing is sent outside the platform; the audit log and the API log carry
 * the alerts, and the AI settings and usage show where the month stands.
 *
 * The budget itself is enforced elsewhere, on the server, before every call: at the budget no
 * question is answered and no title or summary is written (`AiUsageService`). Costs are estimates
 * from the configured prices, said so in every alert — never a bill.
 */
@Injectable()
export class AiBudgetAlertsService implements OnModuleInit {
  private readonly logger = new Logger(AiBudgetAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(
      AI_JOBS.budgetAlert,
      async () => {
        await this.check();
      },
      { cron: '*/15 * * * *' },
    );
  }

  /** Where the month stands, raising what has not been raised this month; null without a budget. */
  async check(now = new Date()): Promise<AiBudgetCheck | null> {
    const { monthlyBudgetMicros, budgetWarningPercent } = await this.settings.current();
    if (monthlyBudgetMicros === null) return null;
    const org = await this.tenant.getOrganization();
    const { key, monthStart } = usageDayOf(now, org.timezone);
    const month = key.slice(0, 7);
    const spentMicros = await this.usage.spentSince(org.id, monthStart);
    const state = budgetState(spentMicros, monthlyBudgetMicros, budgetWarningPercent);
    const raised: AlertLevel[] = [];
    const levels: AlertLevel[] =
      state === 'exceeded' ? ['warning', 'exceeded'] : state === 'warning' ? ['warning'] : [];
    for (const level of levels) {
      if (!(await this.claim(org.id, level, month))) continue;
      raised.push(level);
      const percent = Math.floor((spentMicros * 100) / monthlyBudgetMicros);
      await this.audit.record({
        action: `ai.budget.${level}`,
        resourceType: 'ai_budget',
        resourceId: null,
        summary:
          level === 'exceeded'
            ? `SI Academy AI reached this month's budget (estimated spend ${percent}%): no further calls this month`
            : `SI Academy AI has used an estimated ${percent}% of this month's budget`,
        after: {
          month,
          estimated: true,
          estimatedSpentUsd: spentMicros / 1_000_000,
          budgetUsd: monthlyBudgetMicros / 1_000_000,
          percent,
          warningPercent: budgetWarningPercent,
        },
        actorId: null,
      });
      this.logger.warn({ ai: { budget: level, month, percent } }, 'AI budget alert');
    }
    return { month, state, spentMicros, budgetMicros: monthlyBudgetMicros, raised };
  }

  /** Claims an alert for the month: true for the one caller that moved its row onto the month. */
  private async claim(organizationId: string, level: AlertLevel, month: string): Promise<boolean> {
    const key = BUDGET_ALERT_KEYS[level];
    // The row exists from the first check on (INSERT … ON CONFLICT DO NOTHING: two first checks
    // at once cannot both create it).
    await this.prisma.setting.createMany({
      data: [{ organizationId, key, value: { month: '' } }],
      skipDuplicates: true,
    });
    const claimed = await this.prisma.setting.updateMany({
      where: { organizationId, key, NOT: { value: { path: ['month'], equals: month } } },
      data: { value: { month } },
    });
    return claimed.count > 0;
  }
}
