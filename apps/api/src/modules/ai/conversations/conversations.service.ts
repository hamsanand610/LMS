import { Inject, Injectable } from '@nestjs/common';
import {
  type AiAnswerEnding,
  type AiConversationCreate,
  type AiConversationDetail,
  type AiConversationSummary,
  type Paginated,
  aiConversationDetailSchema,
  aiConversationSummarySchema,
} from '@lms/shared';
import { AuditService } from '../../../core/audit/audit.service.js';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { APP_CONFIG, type AppConfig } from '../../../core/config/env.js';
import { NotFoundError } from '../../../core/http/errors.js';
import { paginate, skipTake } from '../../../core/http/pagination.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { AiGenerationBusyError } from '../ai-errors.js';
import { AiSubjectsService } from '../context/subjects.service.js';
import {
  CONTEXT_MAX_MESSAGES,
  type ContextSummary,
  type ContextTurn,
  SUMMARY_BATCH_MESSAGES,
} from '../context/context-assembler.js';
import type { AiClassification } from '../policy/data-class.js';
import { PROMPT_VERSION } from '../policy/prompts.js';
import { type AiLedgerTurn, AiUsageService } from '../usage/usage.service.js';

/** How long past the deadline an answer may still be `streaming` before it counts as abandoned. */
const ABANDONED_AFTER_DEADLINE_MS = 30_000;
/** The most recent messages a conversation shows; older ones stay stored. */
const DETAIL_MESSAGES = 200;
/** The most recent completed messages read to cut a context window from. */
const HISTORY_MESSAGES = 40;

export type ConversationRow = Awaited<
  ReturnType<PrismaService['aiConversation']['findFirstOrThrow']>
>;

export interface AiTurn {
  questionId: string;
  answerId: string;
}

/** What a question is answered from, besides itself: the recent messages and the notes (7D). */
export interface ConversationMemory {
  history: ContextTurn[];
  summary: ContextSummary | null;
}

/** How an answer ended, and what it cost: everything written when the turn closes. */
export interface AiTurnClosing {
  answerId: string;
  conversationId: string;
  ending: AiAnswerEnding;
  /** The answer, when it completed; an answer that did not complete keeps no text. */
  content: string;
  provider: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  tokensEstimated: boolean;
  latencyMs: number;
  finishReason: string | null;
  errorCode: string | null;
  /** The cached answer that served it (Phase 7D), when no model was called. */
  cacheEntryId?: string | null;
  ledger: AiLedgerTurn;
}

/**
 * Conversations and messages (ADR-0030; Phase 7C).
 *
 * - **Owner only.** Every read and change is scoped to the person's own, undeleted conversations;
 *   anybody else's — a trainer's, an administrator's, the Super Admin's included — is not found.
 *   There is no staff view: one would need its own ADR.
 * - **Append-only.** A question is written once. An answer is written once, when it ends; until
 *   then it is a `streaming` placeholder. Nothing completed is ever rewritten: a regeneration would
 *   be a new message.
 * - **One answer at a time per person.** The placeholder is the generation gate: the database
 *   allows one `streaming` message per person (`ai_messages_one_generation_per_user_key`), so two
 *   tabs or API instances cannot both open one. Closing the answer, whichever way it ends, opens
 *   the gate; one left behind by a stopped process is closed as `failed` once it is past the
 *   longest an answer can take.
 */
@Injectable()
export class AiConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly subjects: AiSubjectsService,
    private readonly usage: AiUsageService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async create(user: AuthUser, input: AiConversationCreate): Promise<AiConversationSummary> {
    const subject = await this.subjects.resolve(user, input);
    const row = await this.prisma.aiConversation.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        purpose: input.purpose,
        ...subject,
        title: input.title ?? '',
        // A title the owner gave is theirs: no other is ever written over it (Phase 7D).
        titleSource: input.title ? 'user' : 'question',
      },
    });
    await this.audit.record({
      action: 'ai.conversation.created',
      resourceType: 'ai_conversation',
      resourceId: row.id,
      summary: `An SI Academy AI conversation was started (${input.purpose})`,
      after: { purpose: input.purpose, lab: subject.questionId !== null },
    });
    return toSummary(row);
  }

  async list(
    user: AuthUser,
    query: { page: number; pageSize: number },
  ): Promise<Paginated<AiConversationSummary>> {
    const where = { userId: user.id, deletedAt: null };
    const [rows, total] = await Promise.all([
      this.prisma.aiConversation.findMany({
        where,
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        ...skipTake(query),
      }),
      this.prisma.aiConversation.count({ where }),
    ]);
    return paginate(rows.map(toSummary), total, query);
  }

  async detail(user: AuthUser, id: string): Promise<AiConversationDetail> {
    const conversation = await this.owned(user, id);
    await this.closeAbandoned(user.id);
    const messages = (
      await this.prisma.aiMessage.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'desc' },
        take: DETAIL_MESSAGES,
      })
    ).reverse();
    return aiConversationDetailSchema.parse({
      ...toSummary(conversation),
      context: {
        courseId: conversation.courseId,
        lessonId: conversation.lessonId,
        questionId: conversation.questionId,
      },
      messages: messages.map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        role: message.role,
        content: message.content,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
      })),
    });
  }

  /**
   * Hidden at once, and purged by the next retention sweep (Phase 7D) with its messages, its notes
   * and any answer kept for its owner alone from it.
   */
  async remove(user: AuthUser, id: string): Promise<void> {
    await this.owned(user, id);
    await this.prisma.aiConversation.updateMany({
      where: { id, userId: user.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      action: 'ai.conversation.deleted',
      resourceType: 'ai_conversation',
      resourceId: id,
      summary: 'An SI Academy AI conversation was deleted by its owner',
    });
  }

  /** The person's own undeleted conversation; anybody else's is not found. */
  async owned(user: AuthUser, id: string): Promise<ConversationRow> {
    const row = await this.prisma.aiConversation.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });
    if (!row) throw new NotFoundError('Conversation');
    return row;
  }

  /**
   * What a question in the conversation is answered from, besides itself: its completed messages
   * the notes do not cover yet, oldest first — what a context window is cut from — and the notes
   * (Phase 7D). The notes are the owner's own conversation, condensed; nothing else is read.
   */
  async memoryOf(conversation: ConversationRow): Promise<ConversationMemory> {
    const through = conversation.summary ? conversation.summarizedThroughAt : null;
    const rows = await this.prisma.aiMessage.findMany({
      where: {
        conversationId: conversation.id,
        status: 'complete',
        ...(through ? { createdAt: { gt: through } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_MESSAGES,
      select: { id: true, role: true, content: true },
    });
    return {
      history: rows.reverse(),
      summary: through ? { text: conversation.summary, through } : null,
    };
  }

  /**
   * Whether the conversation's notes should be brought up to date (Phase 7D): enough completed
   * messages have left the context window that the notes do not cover yet.
   */
  async needsSummary(conversationId: string): Promise<boolean> {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
      select: { summary: true, summarizedThroughAt: true, deletedAt: true },
    });
    if (!conversation || conversation.deletedAt) return false;
    const through = conversation.summary ? conversation.summarizedThroughAt : null;
    const unsummarised = await this.prisma.aiMessage.count({
      where: {
        conversationId,
        status: 'complete',
        ...(through ? { createdAt: { gt: through } } : {}),
      },
    });
    return unsummarised >= CONTEXT_MAX_MESSAGES + SUMMARY_BATCH_MESSAGES;
  }

  /**
   * Opens a turn: the question and the answer's placeholder, together, in one transaction. The
   * placeholder is the generation gate; a second turn of the same person's is refused while one is
   * open, and no question is stored for it.
   */
  async beginTurn(
    user: AuthUser,
    conversation: ConversationRow,
    question: string,
    classification: AiClassification,
    contextRefs: readonly string[],
  ): Promise<AiTurn> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const now = new Date();
          const asked = await tx.aiMessage.create({
            data: {
              conversationId: conversation.id,
              userId: user.id,
              role: 'user',
              content: question,
              status: 'complete',
              dataClass: classification.dataClass,
              completedAt: now,
            },
          });
          const answer = await tx.aiMessage.create({
            data: {
              conversationId: conversation.id,
              userId: user.id,
              role: 'assistant',
              status: 'streaming',
              dataClass: classification.dataClass,
              policyFlags: classification.reasons,
              promptVersion: PROMPT_VERSION,
              contextRefs: [...contextRefs],
            },
          });
          await tx.aiConversation.update({
            where: { id: conversation.id },
            data: {
              lastMessageAt: now,
              ...(conversation.title ? {} : { title: titleFrom(question) }),
            },
          });
          return { questionId: asked.id, answerId: answer.id };
        });
      } catch (error) {
        // Purged by the retention sweep a moment ago (Phase 7D): it is gone.
        if ((error as { code?: unknown }).code === 'P2003') throw new NotFoundError('Conversation');
        if ((error as { code?: unknown }).code !== 'P2002') throw error;
        // The gate is held. If by an answer a stopped process left behind, close it and try once more.
        if (attempt === 0 && (await this.closeAbandoned(user.id)) > 0) continue;
        throw new AiGenerationBusyError();
      }
    }
    throw new AiGenerationBusyError();
  }

  /**
   * Closes a turn, once: the answer's final state, its calls in the ledger and the day's usage, in
   * one transaction. Only an answer still `streaming` is closed, so a turn is never counted twice.
   * Returns whether this call closed it.
   */
  async finishTurn(closing: AiTurnClosing): Promise<boolean> {
    const { day } = await this.usage.today();
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const closed = await tx.aiMessage.updateMany({
        where: { id: closing.answerId, status: 'streaming' },
        data: {
          status: closing.ending,
          content: closing.ending === 'complete' ? closing.content : '',
          provider: closing.provider,
          model: closing.model,
          inputTokens: closing.inputTokens,
          outputTokens: closing.outputTokens,
          tokensEstimated: closing.tokensEstimated,
          latencyMs: closing.latencyMs,
          finishReason: closing.finishReason,
          errorCode: closing.errorCode,
          cacheEntryId: closing.cacheEntryId ?? null,
          completedAt: now,
        },
      });
      if (closed.count === 0) return false;
      await this.usage.recordTurn(tx, closing.ledger, day);
      await tx.aiConversation.update({
        where: { id: closing.conversationId },
        data: { lastMessageAt: now },
      });
      return true;
    });
  }

  /**
   * Closes, as `failed`, the person's answers still `streaming` past the longest an answer can take
   * — left behind by a process that stopped mid-answer. Returns how many.
   */
  async closeAbandoned(userId: string): Promise<number> {
    const { count } = await this.prisma.aiMessage.updateMany({
      where: { userId, status: 'streaming', createdAt: { lt: this.abandonedBefore() } },
      data: { status: 'failed', errorCode: 'interrupted', completedAt: new Date() },
    });
    return count;
  }

  /**
   * The same for everybody (Phase 7D): the retention sweep closes what stopped processes left, so
   * no conversation is held back from it by an answer that will never finish.
   */
  async closeAbandonedEverywhere(now = new Date()): Promise<number> {
    const { count } = await this.prisma.aiMessage.updateMany({
      where: { status: 'streaming', createdAt: { lt: this.abandonedBefore(now) } },
      data: { status: 'failed', errorCode: 'interrupted', completedAt: now },
    });
    return count;
  }

  private abandonedBefore(now = new Date()): Date {
    return new Date(now.getTime() - this.config.AI_TIMEOUT_MS - ABANDONED_AFTER_DEADLINE_MS);
  }
}

function toSummary(row: ConversationRow): AiConversationSummary {
  return aiConversationSummarySchema.parse({
    id: row.id,
    purpose: row.purpose,
    title: row.title,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
  });
}

/** A conversation's title from its first question: its first line, shortened. */
export function titleFrom(question: string): string {
  const line = question.split('\n').find((l) => l.trim() !== '') ?? question;
  const text = line.replace(/\s+/g, ' ').trim();
  return text.length <= 60 ? text : `${text.slice(0, 59).trimEnd()}…`;
}
