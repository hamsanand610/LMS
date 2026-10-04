import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  type AiDataClass,
  KNOWLEDGE_ERROR_CODES,
  type KnowledgeEmbeddingFailure,
  type KnowledgeVersionView,
  knowledgeVersionJobSchema,
} from '@lms/shared';
import { Prisma } from '../../../../generated/prisma/client.js';
import { AuditService } from '../../../../core/audit/audit.service.js';
import type { AuthUser } from '../../../../core/auth/auth-user.js';
import { AppError, ConflictError, NotFoundError } from '../../../../core/http/errors.js';
import { PrismaService } from '../../../../core/prisma/prisma.service.js';
import { JobsService } from '../../../../core/queue/jobs.service.js';
import { TenantService } from '../../../../core/tenant/tenant.service.js';
import { FlagsService } from '../../../settings/flags.service.js';
import { AiProviderError, AiUnavailableError } from '../../providers/ai-provider.js';
import { vectorLiteral } from '../../providers/vectors.js';
import { type AiAttempt, ModelRouter } from '../../routing/model-router.js';
import { AiSettingsService } from '../../settings/ai-settings.service.js';
import { toMicros } from '../../usage/cost.js';
import {
  AI_KNOWLEDGE_EMBED_TASK,
  AI_KNOWLEDGE_USAGE_FEATURE,
  AiUsageService,
} from '../../usage/usage.service.js';
import { KnowledgeIngestionService } from '../ingestion/ingestion.service.js';
import { KNOWLEDGE_JOBS, type KnowledgeEmbeddingInput } from '../knowledge-jobs.js';
import { RETRIEVABLE_DATA_CLASSES } from '../knowledge-reach.service.js';
import { KnowledgeService } from '../knowledge.service.js';
import {
  type KnowledgeEmbeddingContract,
  activeEmbeddingContract,
  contractWhere,
} from './contract.js';

/** The limits that keep one embedding run bounded (Phase 8C; ADR-0035). */
export const KNOWLEDGE_EMBEDDING_LIMITS = {
  /** How long one run may take before it stops; what it embedded stays, and a retry goes on. */
  deadlineMs: 120_000,
  /** How long a claim holds before another run may take the version over. */
  leaseMs: 10 * 60_000,
  /** Retries the queue makes for a failure that may pass, a minute apart and growing. */
  retries: 3,
} as const;

/** Failures that may pass: the queue tries again, and the run goes on from what it embedded. */
const TRANSIENT: ReadonlySet<KnowledgeEmbeddingFailure> = new Set([
  'provider_unavailable',
  'provider_rate_limited',
  'provider_timeout',
  'persist_failed',
  'processing_timeout',
]);

/** What one run of the embedding job did. */
export type KnowledgeEmbeddingOutcome =
  | { status: 'embedded'; embedded: number; total: number; batches: number }
  | { status: 'failed'; code: KnowledgeEmbeddingFailure; transient: boolean }
  | {
      status: 'skipped';
      reason:
        | 'switched_off'
        | 'not_configured'
        | 'not_found'
        | 'already_embedded'
        | 'in_progress'
        | 'claim_lost';
    };

/** Where a run was when it stopped: the audit records it with the failure. */
export type EmbeddingStage = 'checking' | 'embedding' | 'recording' | 'finishing';

/** A run that must stop, with the code it records. */
class EmbeddingStop extends Error {
  constructor(readonly code: KnowledgeEmbeddingFailure) {
    super(code);
  }
}

/** Another run took the version over once this one's lease had lapsed. */
class ClaimLost extends Error {}

interface VersionForEmbedding {
  id: string;
  status: string;
  isCurrent: boolean;
  document: { status: string; source: { status: string; dataClass: string } };
}

/**
 * The knowledge base's embeddings (Roadmap Phase 8C; ADR-0035): each chunk of an eligible version
 * as a vector under the active contract, on the platform's queue (`ai.knowledge.embed`).
 *
 * 1. **Asked for** by the people who manage the knowledge base, for a version that may be embedded:
 *    the current, chunked version of an active document of a published source in their institute,
 *    holding data the provider may be given. Nothing else is ever embedded.
 * 2. **Claimed** in the database, by one run under a lease whose time every write checks.
 * 3. **Embedded in batches** through the model router alone — its data-class approval, deadline,
 *    circuits and records — from what Phase 8B hands over (`chunksForEmbedding`), never the file.
 *    The chunks still without a valid vector go, a batch at a time; each batch's vectors are checked,
 *    then written with its calls' usage in one transaction. A run that stops is taken up from there.
 * 4. **Finished** when every chunk has a valid vector: the version's older versions' vectors, and its
 *    own under any other contract, are removed — none can ever be drawn on again.
 *
 * A vector is valid only under the active contract, for its chunk's current hash. Failures are
 * codes on the run, never content; the ones that may pass are tried again by the queue.
 */
@Injectable()
export class KnowledgeEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeEmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeService,
    private readonly ingestion: KnowledgeIngestionService,
    private readonly jobs: JobsService,
    private readonly flags: FlagsService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly router: ModelRouter,
    private readonly usage: AiUsageService,
    private readonly settings: AiSettingsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(
      KNOWLEDGE_JOBS.embed,
      async (payload, meta) => {
        const job = knowledgeVersionJobSchema.safeParse(payload);
        if (!job.success) {
          this.logger.warn(
            { knowledge: { job: KNOWLEDGE_JOBS.embed } },
            'Knowledge embedding job without a version id dropped',
          );
          return;
        }
        await this.embed(job.data.versionId, { final: meta.final });
      },
      { concurrency: 1 },
    );
  }

  /** The contract new embeddings are made under; none while the AI cannot embed. */
  contract(): KnowledgeEmbeddingContract | null {
    return activeEmbeddingContract(this.router);
  }

  /**
   * Asks for a version's embedding, for the people who manage the knowledge base. Refused when the AI
   * cannot embed, when the version may not be embedded, while a run holds it, and when every chunk
   * already has a valid vector. The queue runs it.
   */
  async request(user: AuthUser, versionId: string): Promise<KnowledgeVersionView> {
    await this.knowledge.assertOn(user);
    // The institute's settings first: they narrow the data the provider may be given.
    await this.settings.current();
    const contract = this.contract();
    if (!contract) {
      throw new ConflictError(
        'SI Academy AI cannot embed knowledge on this installation.',
        KNOWLEDGE_ERROR_CODES.EMBEDDINGS_UNAVAILABLE,
      );
    }
    const version = await this.prisma.knowledgeDocumentVersion.findFirst({
      where: { id: versionId, organizationId: user.organizationId },
      include: {
        document: { include: { source: true } },
        embeddings: { where: contractWhere(contract) },
      },
    });
    if (!version) throw new NotFoundError('Knowledge version');
    const refused = this.ineligibility(version);
    if (refused) {
      throw new ConflictError(
        `This version cannot be embedded (${refused}).`,
        KNOWLEDGE_ERROR_CODES.NOT_EMBEDDABLE,
      );
    }
    const run = version.embeddings[0];
    if (run?.status === 'embedding' && !leaseLapsed(run.claimedAt)) {
      throw new ConflictError(
        'An embedding run holds this version now.',
        KNOWLEDGE_ERROR_CODES.EMBEDDING_RUNNING,
      );
    }
    if (run?.status === 'embedded' && (await this.complete(version.id, contract))) {
      throw new ConflictError(
        'Every chunk of this version is embedded.',
        KNOWLEDGE_ERROR_CODES.VERSION_EMBEDDED,
      );
    }
    await this.prisma.knowledgeVersionEmbedding.upsert({
      where: {
        versionId_provider_model_dimension_embeddingVersion: {
          versionId: version.id,
          ...contractWhere(contract),
        },
      },
      create: {
        organizationId: version.organizationId,
        sourceId: version.sourceId,
        documentId: version.documentId,
        versionId: version.id,
        ...contractWhere(contract),
        requestedById: user.id,
      },
      // An embedded run whose vectors are gone (the version was ingested again) is taken again.
      update: {
        requestedById: user.id,
        ...(run?.status === 'embedded' ? { status: 'pending' } : {}),
      },
    });
    await this.audit.record({
      action: 'ai.knowledge.embedding.requested',
      resourceType: 'knowledge_version',
      resourceId: version.id,
      summary: `Embedding of knowledge version ${version.version} was asked for`,
      after: { documentId: version.documentId, ...contractWhere(contract) },
    });
    await this.jobs.enqueue(
      KNOWLEDGE_JOBS.embed,
      { versionId: version.id },
      {
        singletonKey: `${KNOWLEDGE_JOBS.embed}:${version.id}`,
        retryLimit: KNOWLEDGE_EMBEDDING_LIMITS.retries,
        retryDelaySeconds: 60,
      },
    );
    return this.knowledge.version(user, version.id);
  }

  /**
   * The embedding job. A failure that may pass is thrown back to the queue while it has retries left
   * (`final` false); the next attempt goes on from what this one wrote. Every other ends here,
   * recorded on the run.
   */
  async embed(
    versionId: string,
    options: { final?: boolean } = {},
  ): Promise<KnowledgeEmbeddingOutcome> {
    const flags = await this.flags.list();
    const on = (key: string) => flags.some((flag) => flag.key === key && flag.enabled);
    if (!on(AI_MODULE_FLAG) || !on(AI_KNOWLEDGE_FLAG)) {
      return { status: 'skipped', reason: 'switched_off' };
    }
    await this.settings.current();
    const contract = this.contract();
    if (!contract) return { status: 'skipped', reason: 'not_configured' };
    const org = await this.tenant.getOrganization();
    const started = Date.now();
    const claimedAt = new Date(started);
    const leaseEnded = new Date(started - KNOWLEDGE_EMBEDDING_LIMITS.leaseMs);
    const claimed = await this.prisma.knowledgeVersionEmbedding.updateMany({
      where: {
        versionId,
        organizationId: org.id,
        ...contractWhere(contract),
        requestedById: { not: null },
        OR: [
          { status: { in: ['pending', 'failed'] } },
          { status: 'embedding', claimedAt: { lt: leaseEnded } },
        ],
      },
      data: { status: 'embedding', claimedAt, failureCode: null, attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      return { status: 'skipped', reason: await this.whyNotClaimed(versionId, org.id, contract) };
    }
    const run = await this.prisma.knowledgeVersionEmbedding.findUniqueOrThrow({
      where: {
        versionId_provider_model_dimension_embeddingVersion: {
          versionId,
          ...contractWhere(contract),
        },
      },
    });
    await this.recordState(versionId, 'embedding', {
      attempt: run.attempts,
      ...contractWhere(contract),
    });

    let stage: EmbeddingStage = 'checking';
    let batches = 0;
    try {
      const version = await this.prisma.knowledgeDocumentVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: { document: { include: { source: true } } },
      });
      const refused = this.ineligibility(version);
      if (refused) throw new EmbeddingStop(refused);
      // Eligible, so public or course data, which the provider is approved for.
      const dataClass = version.document.source.dataClass as AiDataClass;
      const items = await this.ingestion.chunksForEmbedding(versionId);
      if (items.length === 0) throw new EmbeddingStop('not_chunked');
      await this.fenced(run.id, claimedAt, { chunkCount: items.length });

      const routing = this.router.embeddingRouting();
      if (!routing) throw new EmbeddingStop('embeddings_unavailable');
      stage = 'embedding';
      for (;;) {
        if (Date.now() - started > KNOWLEDGE_EMBEDDING_LIMITS.deadlineMs) {
          throw new EmbeddingStop('processing_timeout');
        }
        const blocked = await this.usage.embeddingBlockedBy(org.id, contract.model);
        if (blocked) {
          throw new EmbeddingStop(blocked === 'budget' ? 'budget_exceeded' : 'unpriced_model');
        }
        const valid = await this.validChunkIds(versionId, contract, items);
        const batch = items.filter((item) => !valid.has(item.chunkId)).slice(0, routing.batchSize);
        if (batch.length === 0) break;
        const calls: AiAttempt[] = [];
        const remaining = KNOWLEDGE_EMBEDDING_LIMITS.deadlineMs - (Date.now() - started);
        let vectors: number[][];
        try {
          const embedded = await this.router.embed(
            {
              feature: 'knowledge',
              dataClass,
              userId: run.requestedById!,
              organizationId: org.id,
              purpose: 'document',
              texts: batch.map((item) => item.content),
              onAttempt: (attempt) => calls.push(attempt),
            },
            AbortSignal.timeout(Math.max(1, remaining)),
          );
          vectors = embedded.vectors;
        } catch (error) {
          await this.recordUsage(run.requestedById!, org.id, dataClass, calls).catch(
            () => undefined,
          );
          throw error;
        }
        stage = 'recording';
        try {
          await this.persist(
            run.id,
            claimedAt,
            contract,
            batch,
            vectors,
            run.requestedById!,
            dataClass,
            calls,
          );
        } catch (error) {
          // The calls were made, so they count, though their vectors were not kept.
          await this.recordUsage(run.requestedById!, org.id, dataClass, calls).catch(
            () => undefined,
          );
          throw error;
        }
        batches += 1;
        stage = 'embedding';
      }

      stage = 'finishing';
      const outcome = await this.finish(run.id, claimedAt, version, contract, items.length);
      const durationMs = Date.now() - started;
      await this.recordState(versionId, 'embedded', {
        embedded: outcome.embedded,
        total: items.length,
        batches,
        attempt: run.attempts,
        purged: outcome.purged,
        durationMs,
        ...contractWhere(contract),
      });
      this.logger.log(
        { knowledge: { versionId, embedded: outcome.embedded, batches, ms: durationMs } },
        'Knowledge version embedded',
      );
      return { status: 'embedded', embedded: outcome.embedded, total: items.length, batches };
    } catch (error) {
      if (error instanceof ClaimLost) return { status: 'skipped', reason: 'claim_lost' };
      const code = embeddingFailureOf(error, stage);
      const transient = TRANSIENT.has(code);
      const failed = await this.prisma.knowledgeVersionEmbedding
        .updateMany({
          where: { id: run.id, status: 'embedding', claimedAt },
          data: { status: 'failed', failureCode: code },
        })
        .catch(() => ({ count: 0 }));
      if (failed.count === 1) {
        await this.recordState(versionId, 'failed', {
          failureCode: code,
          stage,
          batches,
          attempt: run.attempts,
          transient,
        });
      }
      this.logger.warn(
        { knowledge: { versionId, failure: code, stage, batches, transient } },
        'Knowledge version not embedded',
      );
      if (transient && options.final === false) {
        throw new Error(`Knowledge embedding will be tried again (${code})`);
      }
      return { status: 'failed', code, transient };
    }
  }

  /**
   * Why a version may not be embedded, if it may not: only the current, chunked version of an
   * active document of a published source, holding data the provider may be given, ever is.
   */
  ineligibility(version: VersionForEmbedding): KnowledgeEmbeddingFailure | null {
    const { document } = version;
    const { source } = document;
    if (version.status !== 'chunked') return 'not_chunked';
    if (!version.isCurrent) return 'not_current';
    if (source.status === 'archived') return 'source_archived';
    if (source.status !== 'published') return 'not_published';
    if (document.status !== 'active') return 'document_archived';
    if (!(RETRIEVABLE_DATA_CLASSES as readonly string[]).includes(source.dataClass)) {
      return 'data_class_held_back';
    }
    if (this.router.embeddingRefusal(source.dataClass as AiDataClass)) {
      return 'data_class_not_approved';
    }
    return null;
  }

  /** The chunks of a version with a valid vector under the contract: for their current hash. */
  private async validChunkIds(
    versionId: string,
    contract: KnowledgeEmbeddingContract,
    items: readonly KnowledgeEmbeddingInput[],
  ): Promise<Set<string>> {
    const rows = await this.prisma.knowledgeChunkEmbedding.findMany({
      where: { versionId, ...contractWhere(contract) },
      select: { chunkId: true, contentHash: true },
    });
    const hashes = new Map(items.map((item) => [item.chunkId, item.contentHash]));
    return new Set(
      rows.filter((row) => hashes.get(row.chunkId) === row.contentHash).map((row) => row.chunkId),
    );
  }

  /** Whether every chunk of the version has a valid vector under the contract. */
  private async complete(
    versionId: string,
    contract: KnowledgeEmbeddingContract,
  ): Promise<boolean> {
    const items = await this.ingestion.chunksForEmbedding(versionId);
    if (items.length === 0) return false;
    return (await this.validChunkIds(versionId, contract, items)).size === items.length;
  }

  /**
   * A batch's vectors, written while the run still holds the version, with its calls' usage, in one
   * transaction: the run's row is locked first, so no other run's writes come between. A vector
   * already there for the chunk under the contract is replaced, never duplicated.
   */
  private async persist(
    runId: string,
    claimedAt: Date,
    contract: KnowledgeEmbeddingContract,
    batch: readonly KnowledgeEmbeddingInput[],
    vectors: readonly number[][],
    userId: string,
    dataClass: string,
    calls: readonly AiAttempt[],
  ): Promise<void> {
    const { day } = await this.usage.today();
    await this.prisma.$transaction(async (tx) => {
      const held = await tx.knowledgeVersionEmbedding.updateMany({
        where: { id: runId, status: 'embedding', claimedAt },
        data: { embeddedCount: { increment: batch.length } },
      });
      if (held.count !== 1) throw new ClaimLost();
      const rows = batch.map(
        (item, at) => Prisma.sql`(
          ${randomUUID()}::uuid, ${item.organizationId}::uuid, ${item.sourceId}::uuid,
          ${item.documentId}::uuid, ${item.versionId}::uuid, ${item.chunkId}::uuid,
          ${item.contentHash}, ${contract.provider}, ${contract.model}, ${contract.dimension},
          ${contract.embeddingVersion}, ${vectorLiteral(vectors[at]!)}::vector, now()
        )`,
      );
      await tx.$executeRaw`
        INSERT INTO knowledge_chunk_embeddings (
          id, organization_id, source_id, document_id, version_id, chunk_id, content_hash,
          provider, model, dimension, embedding_version, embedding, created_at
        )
        VALUES ${Prisma.join(rows)}
        ON CONFLICT (chunk_id, provider, model, dimension, embedding_version)
        DO UPDATE SET
          embedding = EXCLUDED.embedding,
          content_hash = EXCLUDED.content_hash,
          created_at = EXCLUDED.created_at`;
      await this.usage.recordTurn(
        tx,
        this.turn(userId, runOrganization(batch), dataClass, calls),
        day,
      );
    });
  }

  /** The calls of a batch that failed, for the ledger: a call made is counted, answered or not. */
  private async recordUsage(
    userId: string,
    organizationId: string,
    dataClass: string,
    calls: readonly AiAttempt[],
  ): Promise<void> {
    if (calls.length === 0) return;
    const { day } = await this.usage.today();
    await this.prisma.$transaction((tx) =>
      this.usage.recordTurn(tx, this.turn(userId, organizationId, dataClass, calls), day),
    );
  }

  private turn(
    userId: string,
    organizationId: string,
    dataClass: string,
    calls: readonly AiAttempt[],
  ) {
    return {
      organizationId,
      userId,
      conversationId: null,
      messageId: null,
      feature: AI_KNOWLEDGE_USAGE_FEATURE,
      task: AI_KNOWLEDGE_EMBED_TASK,
      dataClass,
      requestId: null,
      question: false,
      calls: calls.map((call) => ({
        provider: call.provider,
        model: call.model,
        fallback: call.fallback,
        outcome: call.outcome,
        latencyMs: call.latencyMs,
        inputTokens: call.usage?.inputTokens ?? 0,
        outputTokens: 0,
        estimated: call.usage?.estimated === true,
        costMicros: toMicros(call.estimatedCostUsd),
      })),
    };
  }

  /**
   * The run's end, while it still holds the version: every chunk with a valid vector, or the run is
   * incomplete. Then what can never be drawn on again goes — the vectors of the document's older
   * versions, and the version's own under any other contract.
   */
  private async finish(
    runId: string,
    claimedAt: Date,
    version: { id: string; documentId: string; version: number },
    contract: KnowledgeEmbeddingContract,
    total: number,
  ): Promise<{ embedded: number; purged: number }> {
    const items = await this.ingestion.chunksForEmbedding(version.id);
    const embedded = (await this.validChunkIds(version.id, contract, items)).size;
    if (embedded !== total || items.length !== total) throw new EmbeddingStop('incomplete');
    return this.prisma.$transaction(async (tx) => {
      const held = await tx.knowledgeVersionEmbedding.updateMany({
        where: { id: runId, status: 'embedding', claimedAt },
        data: {
          status: 'embedded',
          embeddedCount: embedded,
          chunkCount: total,
          embeddedAt: new Date(),
          failureCode: null,
        },
      });
      if (held.count !== 1) throw new ClaimLost();
      const older = await tx.knowledgeDocumentVersion.findMany({
        where: { documentId: version.documentId, version: { lt: version.version } },
        select: { id: true },
      });
      const olderIds = older.map((row) => row.id);
      const vectors = await tx.knowledgeChunkEmbedding.deleteMany({
        where: {
          OR: [
            { versionId: { in: olderIds } },
            { versionId: version.id, NOT: contractWhere(contract) },
          ],
        },
      });
      await tx.knowledgeVersionEmbedding.deleteMany({
        where: {
          OR: [
            { versionId: { in: olderIds } },
            { versionId: version.id, NOT: contractWhere(contract) },
          ],
        },
      });
      return { embedded, purged: vectors.count };
    });
  }

  /** Sets the run's fields while it still holds the version. */
  private async fenced(
    runId: string,
    claimedAt: Date,
    data: Prisma.KnowledgeVersionEmbeddingUpdateManyMutationInput,
  ): Promise<void> {
    const held = await this.prisma.knowledgeVersionEmbedding.updateMany({
      where: { id: runId, status: 'embedding', claimedAt },
      data,
    });
    if (held.count !== 1) throw new ClaimLost();
  }

  private async whyNotClaimed(
    versionId: string,
    organizationId: string,
    contract: KnowledgeEmbeddingContract,
  ): Promise<'not_found' | 'already_embedded' | 'in_progress'> {
    const run = await this.prisma.knowledgeVersionEmbedding.findFirst({
      where: { versionId, organizationId, ...contractWhere(contract) },
      select: { status: true },
    });
    if (!run) return 'not_found';
    return run.status === 'embedded' ? 'already_embedded' : 'in_progress';
  }

  /**
   * An embedding state, audited: started (with the attempt), embedded (counts, batches, what was
   * purged, the duration), failed (the code, the stage, whether it may pass). Never content, never
   * a vector, never a key.
   */
  private async recordState(
    versionId: string,
    to: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      action: 'ai.knowledge.embedding',
      resourceType: 'knowledge_version',
      resourceId: versionId,
      summary: `A knowledge version's embedding is now ${to}`,
      after: { status: to, ...details },
    });
  }
}

/** The institute of a batch: every item of it shares one (they are one version's chunks). */
function runOrganization(batch: readonly KnowledgeEmbeddingInput[]): string {
  return batch[0]!.organizationId;
}

function leaseLapsed(claimedAt: Date | null): boolean {
  return !claimedAt || claimedAt.getTime() < Date.now() - KNOWLEDGE_EMBEDDING_LIMITS.leaseMs;
}

/** An error, in the run's own codes: the provider's failures by kind, the rest by stage. */
export function embeddingFailureOf(
  error: unknown,
  stage: EmbeddingStage,
): KnowledgeEmbeddingFailure {
  if (error instanceof EmbeddingStop) return error.code;
  if (error instanceof AiProviderError) {
    switch (error.kind) {
      case 'rate_limited':
        return 'provider_rate_limited';
      case 'unavailable':
      case 'circuit_open':
        return 'provider_unavailable';
      case 'timeout':
        return 'provider_timeout';
      case 'cancelled':
        return 'processing_timeout';
      case 'auth':
        return 'provider_auth';
      case 'configuration':
        return 'provider_configuration';
      case 'bad_request':
        return 'provider_bad_request';
      case 'malformed': {
        const reason = error.diagnostics.reason ?? '';
        if (reason === 'WRONG_DIMENSION' || reason === 'VECTOR_COUNT') return 'wrong_dimension';
        if (reason === 'INVALID_VECTOR_VALUE' || reason === 'ZERO_VECTOR') return 'invalid_vector';
        return 'provider_malformed';
      }
    }
  }
  if (error instanceof AiUnavailableError) return 'embeddings_unavailable';
  if (error instanceof AppError) return 'persist_failed';
  return stage === 'embedding' ? 'provider_unavailable' : 'persist_failed';
}
