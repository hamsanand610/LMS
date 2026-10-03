import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { JobsService } from '../../../core/queue/jobs.service.js';
import { cleanTitle, titleMessages } from '../policy/prompts.js';
import { AiUsageService } from '../usage/usage.service.js';
import { AI_JOBS, AI_JOB_LEASE_MS, type AiConversationJob } from './ai-jobs.js';
import { AiBackgroundCalls, mostSensitive } from './background-calls.js';

/** A title is tried after the conversation's first answers only, and never again once written. */
export const TITLE_AFTER_ANSWERS_AT_MOST = 3;
/** Enough for six words, a thinking model's reasoning included. */
const TITLE_MAX_OUTPUT_TOKENS = 256;
/** The first question is sent as far as this: a title needs no more. */
const TITLE_QUESTION_CHARACTERS = 1000;

export type AiTitleOutcome = 'written' | 'skipped' | 'failed';

/**
 * Conversation titles (Phase 7D). After a conversation's first answer the gateway queues a title;
 * the model writes one from the first question alone, in the background — the answer never waits
 * for it, and a title that cannot be written leaves the one taken from the question. Written once:
 * a title the owner gave, or one the model already wrote, is never replaced, and the conversation
 * is claimed in the database while a title is written, so two jobs never write one twice.
 */
@Injectable()
export class AiTitlesService implements OnModuleInit {
  private readonly logger = new Logger(AiTitlesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly calls: AiBackgroundCalls,
    private readonly usage: AiUsageService,
  ) {}

  onModuleInit(): void {
    this.jobs.register<AiConversationJob>(
      AI_JOBS.title,
      async (payload, meta) => {
        await this.generate(payload.conversationId, meta.final);
      },
      { concurrency: 2 },
    );
  }

  async queue(conversationId: string): Promise<void> {
    await this.jobs.enqueue<AiConversationJob>(
      AI_JOBS.title,
      { conversationId },
      { singletonKey: `ai-title:${conversationId}`, retryLimit: 2, retryDelaySeconds: 60 },
    );
  }

  /**
   * The title job. A failure the model service may get over is tried again by the queue while it
   * has retries left; any other leaves the title as it is.
   */
  async generate(conversationId: string, final = true): Promise<AiTitleOutcome> {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || conversation.deletedAt || conversation.titleSource !== 'question') {
      return 'skipped';
    }
    const answers = await this.prisma.aiMessage.count({
      where: { conversationId, role: 'assistant', status: 'complete' },
    });
    if (answers === 0 || answers > TITLE_AFTER_ANSWERS_AT_MOST) return 'skipped';
    const owner = await this.calls.ownerOf(conversation);
    if (!owner) return 'skipped';

    const claimedAt = new Date();
    const claim = await this.prisma.aiConversation.updateMany({
      where: {
        id: conversationId,
        deletedAt: null,
        titleSource: 'question',
        OR: [
          { titleClaimedAt: null },
          { titleClaimedAt: { lt: new Date(claimedAt.getTime() - AI_JOB_LEASE_MS) } },
        ],
      },
      data: { titleClaimedAt: claimedAt },
    });
    if (claim.count === 0) return 'skipped';
    const release = () =>
      this.prisma.aiConversation.updateMany({
        where: { id: conversationId, titleClaimedAt: claimedAt },
        data: { titleClaimedAt: null },
      });

    try {
      const first = await this.prisma.aiMessage.findFirst({
        where: { conversationId, role: 'user', status: 'complete' },
        orderBy: [{ createdAt: 'asc' }, { role: 'asc' }],
      });
      if (!first) {
        await release();
        return 'skipped';
      }
      const outcome = await this.calls.call(owner, {
        task: 'title',
        conversation,
        dataClass: mostSensitive([first.dataClass]),
        messages: titleMessages(first.content.slice(0, TITLE_QUESTION_CHARACTERS)),
        maxOutputTokens: TITLE_MAX_OUTPUT_TOKENS,
      });
      if (outcome.status === 'skipped') {
        await release();
        this.logger.log(
          { ai: { conversationId, task: 'title', skipped: outcome.reason } },
          'AI title not written',
        );
        return 'skipped';
      }
      const title =
        outcome.status === 'answered' && outcome.result.finishReason === 'stop'
          ? cleanTitle(outcome.result.text)
          : null;
      const { day } = await this.usage.today();
      // The calls are counted and the title written together, once.
      await this.prisma.$transaction(async (tx) => {
        await this.usage.recordTurn(tx, outcome.ledger, day);
        await tx.aiConversation.updateMany({
          where: { id: conversationId, titleClaimedAt: claimedAt, titleSource: 'question' },
          data: title
            ? { title, titleSource: 'model', titleClaimedAt: null }
            : { titleClaimedAt: null },
        });
      });
      if (title) return 'written';
      const reason = outcome.status === 'failed' ? outcome.kind : 'unusable';
      this.logger.warn(
        { ai: { conversationId, task: 'title', outcome: reason } },
        'AI title not written',
      );
      if (outcome.status === 'failed' && outcome.transient && !final) {
        throw new Error(`The title was not written (${reason}); the queue tries again`);
      }
      return 'failed';
    } catch (error) {
      await release();
      throw error;
    }
  }
}
