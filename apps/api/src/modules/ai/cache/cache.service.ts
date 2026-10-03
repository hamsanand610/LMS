import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { AiPurpose } from '@lms/shared';
import { AuditService } from '../../../core/audit/audit.service.js';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { JobsService } from '../../../core/queue/jobs.service.js';
import { TenantService } from '../../../core/tenant/tenant.service.js';
import type { ConversationRow } from '../conversations/conversations.service.js';
import { AI_JOBS, type AiCacheWriteJob } from '../jobs/ai-jobs.js';
import { PROMPT_VERSION } from '../policy/prompts.js';
import { ModelRouter } from '../routing/model-router.js';
import { AiSettingsService } from '../settings/ai-settings.service.js';
import {
  AI_CACHE_KNOWLEDGE_VERSION,
  type AiCacheKeyParts,
  type AiCacheScopeName,
  cacheKeyHash,
} from './cache-key.js';
import { normaliseQuestion } from './normalize.js';
import { type AiCacheSource, AiSourceReach } from './source-reach.js';

/** The surfaces whose answers may be kept: general questions, with no course, lesson or lab. */
const CACHEABLE_PURPOSES: readonly AiPurpose[] = ['workspace', 'assistant'];

/** Everything about a question the cache keys on, but the scope and the person. */
export type AiCacheCandidate = Omit<AiCacheKeyParts, 'scope' | 'userId'> & {
  /** The exact model that would answer now: an entry from another is stale. */
  model: string;
  /** It may be looked up, and kept, for everyone; otherwise for the asker alone. */
  shareable: boolean;
};

export type AiCacheEntryRow = Awaited<
  ReturnType<PrismaService['aiCacheEntry']['findFirstOrThrow']>
>;

/**
 * The Phase 7 answer cache (ADR-0032): normalised exact keys in PostgreSQL. Similarity matching,
 * embeddings and pgvector are Phase 8's, and none of them is here.
 *
 * - **What is kept.** Only a complete answer (`stop`), to a general question (`public`) asked on
 *   its own — no earlier messages, no notes — in the workspace or the assistant without a course,
 *   lesson or lab. Never a lab hint, a course's or a person's own material, anything restricted, a
 *   failed, cancelled, withheld, cut-short or partial answer. It is written after the answer has
 *   closed, by a job, from what the database holds — never from what the request said.
 * - **Scopes.** A question with nothing of the asker in it is kept for everyone (`shared`): the
 *   entry names no person, conversation or message. Any other is kept for the asker alone (`user`),
 *   goes with the conversation it was answered in, and is erased with them.
 * - **Every hit** is the policy's to allow first — flags, permission, timed tests, data class,
 *   quotas all run before the lookup — and then checks the entry: in date, not invalidated, from
 *   the model that routes now, and every source it drew on still within the asker's reach.
 * - **Invalidation.** Expiry (`cacheTtlHours`); another model version of the family (stale on the
 *   next lookup, replaced on the next write); a new prompt version or knowledge version (part of
 *   the key: the old entries are never found again, and the retention sweep removes them); the
 *   Super Admin's purge; `invalidate()` for Phase 8's knowledge events.
 */
@Injectable()
export class AiCacheService implements OnModuleInit {
  private readonly logger = new Logger(AiCacheService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
    private readonly router: ModelRouter,
    private readonly settings: AiSettingsService,
    private readonly reach: AiSourceReach,
  ) {}

  onModuleInit(): void {
    this.jobs.register<AiCacheWriteJob>(
      AI_JOBS.cacheWrite,
      async (payload) => {
        await this.write(payload.messageId, payload.scope);
      },
      { concurrency: 2 },
    );
  }

  /**
   * Whether a question may be answered from the cache and its answer kept, and under what key; null
   * when it may not. `cacheOn` is the person's `ai.semantic_cache` flag, with `module.ai`.
   */
  async candidate(input: {
    cacheOn: boolean;
    conversation: ConversationRow;
    dataClass: string;
    refs: readonly string[];
    question: string;
  }): Promise<AiCacheCandidate | null> {
    const { conversation } = input;
    if (!input.cacheOn || !CACHEABLE_PURPOSES.includes(conversation.purpose)) return null;
    if (conversation.courseId || conversation.lessonId || conversation.questionId) return null;
    if (input.dataClass !== 'public' || input.refs.length > 0) return null;
    const normalised = normaliseQuestion(input.question);
    const model = this.router.modelFor('chat');
    if (!normalised.key || !model) return null;
    const org = await this.tenant.getOrganization();
    return {
      organizationId: org.id,
      purpose: conversation.purpose,
      dataClass: input.dataClass,
      language: languageOf(org.locale),
      modelFamily: model.family,
      promptVersion: PROMPT_VERSION,
      knowledgeVersion: AI_CACHE_KNOWLEDGE_VERSION,
      question: normalised.key,
      model: model.id,
      shareable: normalised.shareable,
    };
  }

  /**
   * A kept answer this person may be given now, or null: theirs first, then a shared one when the
   * question may be shared. The entry grants nothing: it must be in date, not invalidated, from the
   * model that routes now, and the person must still reach everything it drew on.
   */
  async lookup(user: AuthUser, candidate: AiCacheCandidate): Promise<AiCacheEntryRow | null> {
    const now = new Date();
    const scopes: [AiCacheScopeName, string | null][] = [['user', user.id]];
    if (candidate.shareable) scopes.push(['shared', null]);
    for (const [scope, userId] of scopes) {
      const keyHash = cacheKeyHash({ ...keyPartsOf(candidate), scope, userId });
      const entry = await this.prisma.aiCacheEntry.findUnique({
        where: { organizationId_keyHash: { organizationId: candidate.organizationId, keyHash } },
      });
      if (!entry || entry.invalidatedAt || entry.expiresAt <= now) continue;
      if (entry.scope !== scope || (scope === 'user' && entry.userId !== user.id)) continue;
      if (entry.model !== candidate.model) {
        // Another version of the family answers now: this one is not reused again.
        await this.prisma.aiCacheEntry.updateMany({
          where: { id: entry.id, invalidatedAt: null },
          data: { invalidatedAt: now, invalidationReason: 'model' },
        });
        continue;
      }
      if (!(await this.reach.confirm(user, entry.sources))) continue;
      return entry;
    }
    return null;
  }

  /** Counts a reuse. */
  async recordHit(entryId: string): Promise<void> {
    await this.prisma.aiCacheEntry.updateMany({
      where: { id: entryId },
      data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
    });
  }

  /** Queues the keeping of a complete answer, after its stream has ended. */
  async queueWrite(messageId: string, candidate: AiCacheCandidate): Promise<void> {
    await this.jobs.enqueue<AiCacheWriteJob>(
      AI_JOBS.cacheWrite,
      { messageId, scope: candidate.shareable ? 'shared' : 'user' },
      { singletonKey: `ai-cache:${messageId}`, retryLimit: 2, retryDelaySeconds: 30 },
    );
  }

  /**
   * The cache-write job: keeps a closed answer, checked again from the database. Safe to run twice
   * or at once: the key is unique, and an entry is replaced only when it can no longer be reused.
   */
  async write(
    messageId: string,
    requested: AiCacheScopeName,
  ): Promise<'written' | 'refreshed' | 'kept' | 'skipped'> {
    const answer = await this.prisma.aiMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (
      !answer ||
      answer.role !== 'assistant' ||
      answer.status !== 'complete' ||
      answer.finishReason !== 'stop' ||
      answer.cacheEntryId !== null ||
      answer.content.trim() === '' ||
      answer.dataClass !== 'public' ||
      !answer.model ||
      !answer.provider ||
      !answer.promptVersion
    ) {
      return 'skipped';
    }
    const conversation = answer.conversation;
    if (
      conversation.deletedAt ||
      !CACHEABLE_PURPOSES.includes(conversation.purpose) ||
      conversation.courseId ||
      conversation.lessonId ||
      conversation.questionId
    ) {
      return 'skipped';
    }
    // Only an answer to a question asked on its own: nothing but the question went into it.
    if (!Array.isArray(answer.contextRefs) || answer.contextRefs.length > 0) return 'skipped';
    const question = await this.prisma.aiMessage.findFirst({
      where: {
        conversationId: conversation.id,
        role: 'user',
        status: 'complete',
        createdAt: { lte: answer.createdAt },
      },
      orderBy: { createdAt: 'desc' },
    });
    const normalised = question ? normaliseQuestion(question.content) : null;
    const spec = this.router.availableModels().find((model) => model.id === answer.model);
    if (!normalised?.key || !spec) return 'skipped';

    const scope: AiCacheScopeName =
      requested === 'shared' && normalised.shareable ? 'shared' : 'user';
    const org = await this.tenant.getOrganization();
    const { cacheTtlHours } = await this.settings.current();
    const now = new Date();
    const parts: AiCacheKeyParts = {
      organizationId: org.id,
      scope,
      userId: scope === 'user' ? conversation.userId : null,
      purpose: conversation.purpose,
      dataClass: answer.dataClass,
      language: languageOf(org.locale),
      modelFamily: spec.family,
      promptVersion: answer.promptVersion,
      knowledgeVersion: AI_CACHE_KNOWLEDGE_VERSION,
      question: normalised.key,
    };
    const keyHash = cacheKeyHash(parts);
    const content = {
      scope,
      userId: parts.userId,
      // A shared entry is tied to nobody: no person, conversation or message.
      conversationId: scope === 'user' ? conversation.id : null,
      normalizedQuestion: normalised.key,
      answer: answer.content,
      purpose: conversation.purpose,
      dataClass: answer.dataClass,
      language: parts.language,
      provider: answer.provider,
      model: answer.model,
      modelFamily: spec.family,
      promptVersion: answer.promptVersion,
      knowledgeVersion: AI_CACHE_KNOWLEDGE_VERSION,
      sources: [] as AiCacheSource[],
      expiresAt: new Date(now.getTime() + cacheTtlHours * 3_600_000),
    };
    // INSERT … ON CONFLICT DO NOTHING: of two writes at once, one keeps the answer.
    const created = await this.prisma.aiCacheEntry.createMany({
      data: [{ organizationId: org.id, keyHash, ...content }],
      skipDuplicates: true,
    });
    if (created.count > 0) return 'written';
    // Kept already: replaced only when it can no longer be reused.
    const replaced = await this.prisma.aiCacheEntry.updateMany({
      where: {
        organizationId: org.id,
        keyHash,
        OR: [
          { expiresAt: { lte: now } },
          { invalidatedAt: { not: null } },
          { model: { not: answer.model } },
        ],
      },
      data: {
        ...content,
        hitCount: 0,
        lastHitAt: null,
        invalidatedAt: null,
        invalidationReason: null,
      },
    });
    return replaced.count > 0 ? 'refreshed' : 'kept';
  }

  /**
   * Phase 8's way in, and the smallest one: answers that drew on any of these sources — or every
   * answer, without sources — may no longer be reused. Returns how many were invalidated.
   */
  async invalidate(
    reason: 'knowledge' | 'model' | 'prompt' | 'admin',
    sources?: readonly AiCacheSource[],
  ): Promise<number> {
    const org = await this.tenant.getOrganization();
    const { count } = await this.prisma.aiCacheEntry.updateMany({
      where: {
        organizationId: org.id,
        invalidatedAt: null,
        ...(sources
          ? { OR: sources.map((source) => ({ sources: { array_contains: [source] } })) }
          : {}),
      },
      data: { invalidatedAt: new Date(), invalidationReason: reason },
    });
    if (count > 0)
      this.logger.log({ ai: { cacheInvalidated: count, reason } }, 'AI cache invalidated');
    return count;
  }

  /** The Super Admin empties the cache: every kept answer goes, at once (audited). */
  async purge(): Promise<number> {
    const org = await this.tenant.getOrganization();
    const { count } = await this.prisma.aiCacheEntry.deleteMany({
      where: { organizationId: org.id },
    });
    await this.audit.record({
      action: 'ai.cache.purged',
      resourceType: 'ai_cache',
      resourceId: null,
      summary: `The SI Academy AI answer cache was emptied (${count} answers)`,
      after: { purged: count },
    });
    return count;
  }
}

function keyPartsOf(candidate: AiCacheCandidate): Omit<AiCacheKeyParts, 'scope' | 'userId'> {
  return {
    organizationId: candidate.organizationId,
    purpose: candidate.purpose,
    dataClass: candidate.dataClass,
    language: candidate.language,
    modelFamily: candidate.modelFamily,
    promptVersion: candidate.promptVersion,
    knowledgeVersion: candidate.knowledgeVersion,
    question: candidate.question,
  };
}

/** The language answers are kept under: the institute's own, from its locale (`en-IN` → `en`). */
export function languageOf(locale: string): string {
  return (locale.split('-')[0] ?? 'en').toLowerCase() || 'en';
}
