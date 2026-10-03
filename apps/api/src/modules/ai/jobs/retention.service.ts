import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { AuditService } from '../../../core/audit/audit.service.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { JobsService } from '../../../core/queue/jobs.service.js';
import { TenantService } from '../../../core/tenant/tenant.service.js';
import { AiConversationsService } from '../conversations/conversations.service.js';
import { PROMPT_VERSION } from '../policy/prompts.js';
import { AiSettingsService } from '../settings/ai-settings.service.js';
import { AI_JOBS } from './ai-jobs.js';

const DAY_MS = 86_400_000;
/** Rows taken per statement; a night's sweep stops after this many rounds and the next goes on. */
const BATCH = 500;
const ROUNDS = 40;

/** What one sweep removed. */
export interface AiRetentionReport {
  /** Answers a stopped process left `streaming`, closed as failed so nothing is held back. */
  abandonedAnswers: number;
  /** Conversations their owners deleted. */
  deletedConversations: number;
  /** Messages older than the retention period. */
  messages: number;
  /** Conversations whose notes were dropped because messages they were written from went. */
  summariesCleared: number;
  /** Conversations left with no message, last used before the retention period. */
  idleConversations: number;
  /** Ledger rows older than the usage detail period; the daily totals stay. */
  ledgerRows: number;
  /** Cached answers that can never be reused: expired, invalidated, or for another prompt. */
  cacheEntries: number;
}

/**
 * SI Academy AI's retention (Phase 7D; ADR-0030), a nightly job beside the platform's own
 * `retention.sweep`, with its periods from the institute's AI settings:
 *
 * - a conversation its owner deleted goes at the next sweep, with its messages, its notes and any
 *   answer kept for its owner from it (they hang off it in the database);
 * - a message goes once it is older than `conversationRetentionDays` (90 by default, the
 *   requirements' schedule for AI conversations); a conversation goes once it has no message left
 *   and was last used before that; notes written from a message that went are dropped with it;
 * - a ledger row goes after `usageDetailRetentionDays` (730: two years of raw events); the daily
 *   totals are the aggregates, and are kept;
 * - a cached answer goes once it can never be reused.
 *
 * Nothing being written is touched: an answer still `streaming` keeps its conversation, and one a
 * stopped process left behind is first closed as failed. Each step deletes by a condition it checks
 * again as it deletes, so a sweep run twice, retried, or run by two workers at once removes each
 * row once. It runs whether or not `module.ai` is on: switching AI off does not keep its data. A
 * sweep that removed anything is audited with its counts, as `retention.swept` is.
 */
@Injectable()
export class AiRetentionService implements OnModuleInit {
  private readonly logger = new Logger(AiRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
    private readonly settings: AiSettingsService,
    private readonly conversations: AiConversationsService,
  ) {}

  onModuleInit(): void {
    // After the platform's own sweep (02:30), in the queue's time zone.
    this.jobs.register(
      AI_JOBS.retentionSweep,
      async () => {
        await this.sweep();
      },
      { cron: '45 2 * * *' },
    );
  }

  async sweep(now = new Date()): Promise<AiRetentionReport> {
    const org = await this.tenant.getOrganization();
    const { conversationRetentionDays, usageDetailRetentionDays } = await this.settings.current();
    const messagesBefore = new Date(now.getTime() - conversationRetentionDays * DAY_MS);
    const ledgerBefore = new Date(now.getTime() - usageDetailRetentionDays * DAY_MS);
    const organizationId = org.id;
    const report: AiRetentionReport = {
      abandonedAnswers: await this.conversations.closeAbandonedEverywhere(now),
      deletedConversations: 0,
      messages: 0,
      summariesCleared: 0,
      idleConversations: 0,
      ledgerRows: 0,
      cacheEntries: 0,
    };
    const nothingBeingWritten = { messages: { none: { status: 'streaming' as const } } };

    report.deletedConversations = await rounds(async () => {
      const where = { organizationId, deletedAt: { not: null }, ...nothingBeingWritten };
      const ids = await this.prisma.aiConversation.findMany({
        where,
        select: { id: true },
        take: BATCH,
      });
      if (ids.length === 0) return 0;
      const { count } = await this.prisma.aiConversation.deleteMany({
        where: { ...where, id: { in: ids.map((row) => row.id) } },
      });
      return count;
    });

    report.messages = await rounds(async () => {
      const where = {
        createdAt: { lt: messagesBefore },
        status: { not: 'streaming' as const },
        conversation: { organizationId },
      };
      const rows = await this.prisma.aiMessage.findMany({
        where,
        select: { id: true, conversationId: true },
        take: BATCH,
      });
      if (rows.length === 0) return 0;
      const conversationIds = [...new Set(rows.map((row) => row.conversationId))];
      return this.prisma.$transaction(async (tx) => {
        const { count } = await tx.aiMessage.deleteMany({
          where: { ...where, id: { in: rows.map((row) => row.id) } },
        });
        // Notes written from what just went go too, and any summary under way is not kept.
        const cleared = await tx.aiConversation.updateMany({
          where: {
            id: { in: conversationIds },
            OR: [
              { summary: { not: '' } },
              { summarizedThroughAt: { not: null } },
              { summaryClaimedAt: { not: null } },
            ],
          },
          data: { summary: '', summarizedThroughAt: null, summaryClaimedAt: null },
        });
        report.summariesCleared += cleared.count;
        return count;
      });
    });

    report.idleConversations = await rounds(async () => {
      const where = {
        organizationId,
        messages: { none: {} },
        OR: [
          { lastMessageAt: { lt: messagesBefore } },
          { lastMessageAt: null, createdAt: { lt: messagesBefore } },
        ],
      };
      const ids = await this.prisma.aiConversation.findMany({
        where,
        select: { id: true },
        take: BATCH,
      });
      if (ids.length === 0) return 0;
      const { count } = await this.prisma.aiConversation.deleteMany({
        where: { ...where, id: { in: ids.map((row) => row.id) } },
      });
      return count;
    });

    report.ledgerRows = await rounds(async () => {
      const where = { organizationId, createdAt: { lt: ledgerBefore } };
      const ids = await this.prisma.aiRequest.findMany({
        where,
        select: { id: true },
        take: BATCH,
      });
      if (ids.length === 0) return 0;
      const { count } = await this.prisma.aiRequest.deleteMany({
        where: { ...where, id: { in: ids.map((row) => row.id) } },
      });
      return count;
    });

    report.cacheEntries = await rounds(async () => {
      const where = {
        organizationId,
        OR: [
          { expiresAt: { lte: now } },
          { invalidatedAt: { not: null } },
          { promptVersion: { not: PROMPT_VERSION } },
        ],
      };
      const ids = await this.prisma.aiCacheEntry.findMany({
        where,
        select: { id: true },
        take: BATCH,
      });
      if (ids.length === 0) return 0;
      const { count } = await this.prisma.aiCacheEntry.deleteMany({
        where: { ...where, id: { in: ids.map((row) => row.id) } },
      });
      return count;
    });

    const removed = Object.values(report).reduce((sum, value) => sum + value, 0);
    if (removed > 0) {
      await this.audit.record({
        action: 'ai.retention.swept',
        resourceType: 'retention',
        resourceId: null,
        summary:
          `SI Academy AI retention removed ${report.deletedConversations + report.idleConversations} ` +
          `conversation(s), ${report.messages} message(s), ${report.ledgerRows} ledger row(s) and ` +
          `${report.cacheEntries} cached answer(s)`,
        after: { ...report, conversationRetentionDays, usageDetailRetentionDays },
        actorId: null,
      });
      this.logger.log({ ai: report }, 'AI retention sweep');
    }
    return report;
  }
}

/** Runs a batch step until it finds nothing more, or for at most ROUNDS rounds; the total. */
async function rounds(step: () => Promise<number>): Promise<number> {
  let total = 0;
  for (let round = 0; round < ROUNDS; round += 1) {
    const count = await step();
    total += count;
    if (count < BATCH) break;
  }
  return total;
}
