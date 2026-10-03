import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { JobsService } from '../../../core/queue/jobs.service.js';
import {
  CONTEXT_MAX_CHARACTERS,
  CONTEXT_MAX_MESSAGES,
  SUMMARY_BATCH_MESSAGES,
} from '../context/context-assembler.js';
import { cleanSummary, summaryMessages, type SummaryTurn } from '../policy/prompts.js';
import { AiUsageService } from '../usage/usage.service.js';
import { AI_JOBS, AI_JOB_LEASE_MS, type AiConversationJob } from './ai-jobs.js';
import { AiBackgroundCalls, mostSensitive } from './background-calls.js';

/** Enough for 150 words, a thinking model's reasoning included. */
const SUMMARY_MAX_OUTPUT_TOKENS = 1024;

export type AiSummaryOutcome = 'written' | 'skipped' | 'failed';

/**
 * A conversation's notes on its older turns (Phase 7D): compressed session memory, nothing more.
 *
 * - **When.** Once enough completed messages have left the context window that the notes do not
 *   cover yet (`SUMMARY_BATCH_MESSAGES`) — every few turns, never every message. The gateway queues
 *   the job after an answer; the answer never waits for it.
 * - **From what.** The notes so far and those older messages: the owner's own conversation and
 *   nothing else, so the notes can hold nothing the owner could not already see.
 * - **How used.** After the instructions, as a learner-side message framed as context, before the
 *   recent messages, which stay authoritative (`assembleContext`). The notes are never
 *   instructions, never authority, and never read by any check. They are no long-term memory:
 *   they belong to their conversation, and go with it.
 * - **Safely.** The conversation is claimed while the notes are written; they are kept only if
 *   nothing moved meanwhile (a newer summary, or the retention sweep removing what they were
 *   written from). A failure leaves the conversation as it was, and usable.
 */
@Injectable()
export class AiSummariesService implements OnModuleInit {
  private readonly logger = new Logger(AiSummariesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly calls: AiBackgroundCalls,
    private readonly usage: AiUsageService,
  ) {}

  onModuleInit(): void {
    this.jobs.register<AiConversationJob>(
      AI_JOBS.summarize,
      async (payload, meta) => {
        await this.summarize(payload.conversationId, meta.final);
      },
      { concurrency: 1 },
    );
  }

  async queue(conversationId: string): Promise<void> {
    await this.jobs.enqueue<AiConversationJob>(
      AI_JOBS.summarize,
      { conversationId },
      { singletonKey: `ai-summary:${conversationId}`, retryLimit: 2, retryDelaySeconds: 60 },
    );
  }

  /** The summary job. */
  async summarize(conversationId: string, final = true): Promise<AiSummaryOutcome> {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || conversation.deletedAt) return 'skipped';
    const owner = await this.calls.ownerOf(conversation);
    if (!owner) return 'skipped';

    const claimedAt = new Date();
    const claim = await this.prisma.aiConversation.updateMany({
      where: {
        id: conversationId,
        deletedAt: null,
        OR: [
          { summaryClaimedAt: null },
          { summaryClaimedAt: { lt: new Date(claimedAt.getTime() - AI_JOB_LEASE_MS) } },
        ],
      },
      data: { summaryClaimedAt: claimedAt },
    });
    if (claim.count === 0) return 'skipped';
    const release = () =>
      this.prisma.aiConversation.updateMany({
        where: { id: conversationId, summaryClaimedAt: claimedAt },
        data: { summaryClaimedAt: null },
      });

    try {
      // Read again under the claim: what the notes cover now.
      const current = await this.prisma.aiConversation.findUniqueOrThrow({
        where: { id: conversationId },
        select: { summary: true, summarizedThroughAt: true },
      });
      const through = current.summary ? current.summarizedThroughAt : null;
      const pending = await this.prisma.aiMessage.findMany({
        where: {
          conversationId,
          status: 'complete',
          ...(through ? { createdAt: { gt: through } } : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { role: 'asc' }],
        select: { role: true, content: true, dataClass: true, createdAt: true },
      });
      // The most recent messages stay out: the context window carries them as they are.
      const fold = pending.slice(0, Math.max(0, pending.length - CONTEXT_MAX_MESSAGES));
      if (fold.length < SUMMARY_BATCH_MESSAGES) {
        await release();
        return 'skipped';
      }
      const turns = newestWithin(fold, CONTEXT_MAX_CHARACTERS - current.summary.length);
      const outcome = await this.calls.call(owner, {
        task: 'summarize',
        conversation,
        dataClass: mostSensitive(fold.map((message) => message.dataClass)),
        messages: summaryMessages(current.summary, turns),
        maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
      });
      if (outcome.status === 'skipped') {
        await release();
        this.logger.log(
          { ai: { conversationId, task: 'summarize', skipped: outcome.reason } },
          'AI summary not written',
        );
        return 'skipped';
      }
      const summary =
        outcome.status === 'answered' && outcome.result.finishReason !== 'blocked'
          ? cleanSummary(outcome.result.text)
          : null;
      const { day } = await this.usage.today();
      let written = false;
      await this.prisma.$transaction(async (tx) => {
        await this.usage.recordTurn(tx, outcome.ledger, day);
        const kept = await tx.aiConversation.updateMany({
          where: {
            id: conversationId,
            deletedAt: null,
            summaryClaimedAt: claimedAt,
            summarizedThroughAt: current.summarizedThroughAt,
          },
          data: summary
            ? {
                summary,
                summarizedThroughAt: fold.at(-1)!.createdAt,
                summaryClaimedAt: null,
              }
            : { summaryClaimedAt: null },
        });
        written = Boolean(summary) && kept.count > 0;
      });
      if (written) return 'written';
      const reason = outcome.status === 'failed' ? outcome.kind : summary ? 'moved' : 'unusable';
      this.logger.warn(
        { ai: { conversationId, task: 'summarize', outcome: reason } },
        'AI summary not written',
      );
      if (outcome.status === 'failed' && outcome.transient && !final) {
        throw new Error(`The summary was not written (${reason}); the queue tries again`);
      }
      return 'failed';
    } catch (error) {
      await release();
      throw error;
    }
  }
}

/** The newest of the messages that fit together in this many characters, oldest first. */
function newestWithin(
  messages: readonly { role: 'user' | 'assistant'; content: string }[],
  characters: number,
): SummaryTurn[] {
  const kept: SummaryTurn[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (used + message.content.length > characters && kept.length > 0) break;
    used += message.content.length;
    kept.unshift({ role: message.role, content: message.content.slice(0, characters) });
  }
  return kept;
}
