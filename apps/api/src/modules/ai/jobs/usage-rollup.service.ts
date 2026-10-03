import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { addDaysToDateKey, toLocalDateKey } from '@lms/shared';
import { AuditService } from '../../../core/audit/audit.service.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { JobsService } from '../../../core/queue/jobs.service.js';
import { TenantService } from '../../../core/tenant/tenant.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { AI_JOBS } from './ai-jobs.js';

/** The settings row that says which day the roll-up has settled through. */
export const ROLLUP_WATERMARK_KEY = 'ai.usage_rollup';
/**
 * A day is settled once it has been over this long. An answer is counted on the day it closes, and
 * none takes this long, so by then nothing more is counted on it.
 */
export const ROLLUP_GRACE_MS = 15 * 60_000;
/** On its first run the roll-up goes back this many days; later runs go on from where it stopped. */
const FIRST_RUN_DAYS = 7;
/** At most this many days per run, so a long pause is caught up over a few. */
const DAYS_PER_RUN = 31;

/** One person's day as the ledger has it. */
export interface DayFigures {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedRequests: number;
  estimatedCostMicros: number;
}

export interface AiRollupReport {
  /** Days settled by this run, `YYYY-MM-DD`. */
  days: string[];
  /** Person-days the ledger has calls for. */
  people: number;
  /** Person-days whose totals did not match the ledger, and were set to it. */
  repaired: number;
}

/**
 * The days that have closed in the institute's time zone and are not settled yet, oldest first:
 * from the day after `through` to the day before the current one, once that has been over for
 * `ROLLUP_GRACE_MS`, and at most `DAYS_PER_RUN` of them.
 */
export function daysToSettle(now: Date, timeZone: string, through: string): string[] {
  const lastClosed = addDaysToDateKey(
    toLocalDateKey(new Date(now.getTime() - ROLLUP_GRACE_MS), timeZone),
    -1,
  );
  const days: string[] = [];
  for (let day = addDaysToDateKey(through, 1); day <= lastClosed; day = addDaysToDateKey(day, 1)) {
    days.push(day);
    if (days.length === DAYS_PER_RUN) break;
  }
  return days;
}

/** Whether a person's day agrees with the ledger. */
export function sameFigures(a: DayFigures, b: DayFigures): boolean {
  return (
    a.requests === b.requests &&
    a.inputTokens === b.inputTokens &&
    a.outputTokens === b.outputTokens &&
    a.totalTokens === b.totalTokens &&
    a.estimatedRequests === b.estimatedRequests &&
    a.estimatedCostMicros === b.estimatedCostMicros
  );
}

/**
 * The usage roll-up (Phase 7D; ADR-0029), every hour. The ledger (`ai_requests`) is the source of
 * truth; each person's daily totals (`ai_usage_daily`) are its roll-up, written as each answer
 * closes, which the quotas read. This job settles each day once it has closed: it adds up the
 * ledger's calls counted on that day, person by person — questions (`countsAsQuestion`), tokens in
 * and out, calls with estimated counts, estimated cost — and sets any day whose totals disagree.
 *
 * - **Exactly once.** Each day is taken by moving the watermark from the day before to it, in the
 *   same transaction as its totals: of two runs at once, or a retry, one settles the day and the
 *   other finds it settled. Totals are set, never added to: running it again changes nothing.
 * - **Time zone.** Days are the institute's. Each call keeps the day it was counted on, so a later
 *   change of time zone never moves a call to another day.
 * - **History.** Only closed days are touched, never today, which the quotas read live; only days
 *   the ledger still holds in full (it is kept 90 days or more); never the anonymous totals of an
 *   erased person; and a day the ledger has no calls for is left as it is.
 * - **Estimates** stay estimates: the calls with estimated counts are counted, and their tokens
 *   are what was recorded for them.
 */
@Injectable()
export class AiUsageRollupService implements OnModuleInit {
  private readonly logger = new Logger(AiUsageRollupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(
      AI_JOBS.usageRollup,
      async () => {
        await this.run();
      },
      { cron: '10 * * * *' },
    );
  }

  async run(now = new Date()): Promise<AiRollupReport> {
    const org = await this.tenant.getOrganization();
    const start = addDaysToDateKey(toLocalDateKey(now, org.timezone), -(FIRST_RUN_DAYS + 1));
    // INSERT … ON CONFLICT DO NOTHING: two first runs at once cannot both create the watermark.
    await this.prisma.setting.createMany({
      data: [{ organizationId: org.id, key: ROLLUP_WATERMARK_KEY, value: { through: start } }],
      skipDuplicates: true,
    });
    const watermark = await this.prisma.setting.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: org.id, key: ROLLUP_WATERMARK_KEY } },
    });
    let through = (watermark.value as { through?: string }).through ?? start;
    const report: AiRollupReport = { days: [], people: 0, repaired: 0 };
    for (const day of daysToSettle(now, org.timezone, through)) {
      const settled = await this.settle(org.id, through, day);
      // Another run took it: it goes on from there, and this one stops.
      if (!settled) break;
      report.days.push(day);
      report.people += settled.people;
      report.repaired += settled.repaired;
      through = day;
    }
    if (report.repaired > 0) {
      await this.audit.record({
        action: 'ai.usage.reconciled',
        resourceType: 'ai_usage',
        resourceId: null,
        summary: `SI Academy AI usage roll-up set ${report.repaired} person-day(s) to the ledger`,
        after: report,
        actorId: null,
      });
    }
    if (report.days.length > 0) this.logger.log({ ai: report }, 'AI usage roll-up');
    return report;
  }

  /** Takes one day by moving the watermark onto it, and settles its totals, in one transaction. */
  private async settle(
    organizationId: string,
    previous: string,
    day: string,
  ): Promise<{ people: number; repaired: number } | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.setting.updateMany({
          where: {
            organizationId,
            key: ROLLUP_WATERMARK_KEY,
            value: { path: ['through'], equals: previous },
          },
          data: { value: { through: day } },
        });
        if (claimed.count === 0) return null;
        const date = new Date(`${day}T00:00:00.000Z`);
        const ledger = await ledgerFigures(tx, organizationId, date);
        let repaired = 0;
        for (const [userId, figures] of ledger) {
          const stored = await tx.aiUsageDaily.findUnique({
            where: { userId_day: { userId, day: date } },
          });
          if (stored && sameFigures(stored, figures)) continue;
          await tx.aiUsageDaily.upsert({
            where: { userId_day: { userId, day: date } },
            create: { organizationId, userId, day: date, ...figures },
            update: figures,
          });
          repaired += 1;
        }
        return { people: ledger.size, repaired };
      },
      { timeout: 60_000 },
    );
  }
}

/** Each person's figures for one day, added up from the ledger. */
async function ledgerFigures(
  tx: Prisma.TransactionClient,
  organizationId: string,
  day: Date,
): Promise<Map<string, DayFigures>> {
  const where = { organizationId, day, userId: { not: null } };
  // One at a time: an interactive transaction runs its statements on one connection.
  const sums = await tx.aiRequest.groupBy({
    by: ['userId'],
    where,
    _sum: { inputTokens: true, outputTokens: true, totalTokens: true, estimatedCostMicros: true },
  });
  const questions = await tx.aiRequest.groupBy({
    by: ['userId'],
    where: { ...where, countsAsQuestion: true },
    _count: { _all: true },
  });
  const estimated = await tx.aiRequest.groupBy({
    by: ['userId'],
    where: { ...where, tokensEstimated: true },
    _count: { _all: true },
  });
  const count = (rows: { userId: string | null; _count: { _all: number } }[], userId: string) =>
    rows.find((row) => row.userId === userId)?._count._all ?? 0;
  const figures = new Map<string, DayFigures>();
  for (const row of sums) {
    if (!row.userId) continue;
    figures.set(row.userId, {
      requests: count(questions, row.userId),
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
      totalTokens: row._sum.totalTokens ?? 0,
      estimatedRequests: count(estimated, row.userId),
      estimatedCostMicros: row._sum.estimatedCostMicros ?? 0,
    });
  }
  return figures;
}
