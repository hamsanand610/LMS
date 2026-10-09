import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  KNOWLEDGE_ERROR_CODES,
  type KnowledgeDocumentView,
  type KnowledgeProcessingSummary,
  type KnowledgeUpload,
  type KnowledgeVersionUpload,
  knowledgeFormatOfFileName,
  knowledgeProcessingSummarySchema,
  knowledgeVersionJobSchema,
} from '@lms/shared';
import { AuditService } from '../../../core/audit/audit.service.js';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import { ConflictError, ValidationError } from '../../../core/http/errors.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { JobsService } from '../../../core/queue/jobs.service.js';
import { TenantService } from '../../../core/tenant/tenant.service.js';
import { FlagsService } from '../../settings/flags.service.js';
import { KnowledgeEmbeddingService } from './embedding/embedding.service.js';
import {
  KnowledgeIngestionService,
  type KnowledgeIngestionOutcome,
} from './ingestion/ingestion.service.js';
import { KNOWLEDGE_INGESTION_LIMITS } from './ingestion/pipeline.js';
import { KNOWLEDGE_JOBS } from './knowledge-jobs.js';
import { KnowledgeService } from './knowledge.service.js';

/** What one run of the processing job did. */
export type KnowledgeProcessingOutcome =
  | KnowledgeIngestionOutcome
  | { status: 'processed'; embedding: string }
  | { status: 'skipped'; reason: 'not_current' | 'no_requester' };

/** Why a version cannot be indexed now, in the words the page shows. */
const NOT_INDEXABLE: Record<string, string> = {
  not_published: 'Publish the source first: a draft is not indexed.',
  source_archived: 'This source is archived: nothing in it is indexed again.',
  document_archived: 'This document is archived.',
  not_current: 'A newer version of this document is current.',
  not_chunked: 'This version has not been read yet.',
  data_class_held_back: 'Personal knowledge is not indexed.',
  data_class_not_approved: 'SI Academy AI is not approved for this kind of data.',
};

/**
 * The Knowledge base page's processing (Roadmap Phase 10): what an upload, a publication or
 * "process again" asks for, done by the queue on its own — the version read and chunked (Phase 8B,
 * `KnowledgeIngestionService`), then, while its source is published, embedded (Phase 8C,
 * `KnowledgeEmbeddingService`) — through the same claims, checks, limits and records as when each
 * step is asked for by hand. The routes that ask for one step at a time keep doing only that.
 *
 * The job `ai.knowledge.process` carries a version id alone; the database's state makes it safe to
 * repeat or to run twice at once. The embedding is counted to whoever added the version.
 */
@Injectable()
export class KnowledgeProcessingService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeService,
    private readonly ingestion: KnowledgeIngestionService,
    private readonly embedding: KnowledgeEmbeddingService,
    private readonly jobs: JobsService,
    private readonly flags: FlagsService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(
      KNOWLEDGE_JOBS.process,
      async (payload, meta) => {
        const job = knowledgeVersionJobSchema.safeParse(payload);
        if (!job.success) {
          this.logger.warn(
            { knowledge: { job: KNOWLEDGE_JOBS.process } },
            'Knowledge processing job without a version id dropped',
          );
          return;
        }
        await this.process(job.data.versionId, { final: meta.final });
      },
      { concurrency: 1 },
    );
  }

  /** A new document from an uploaded file, sent to be processed. */
  async upload(
    user: AuthUser,
    sourceId: string,
    input: KnowledgeUpload,
  ): Promise<KnowledgeDocumentView> {
    const { documentId, versionId } = await this.knowledge.createUploadedDocument(
      user,
      sourceId,
      input,
    );
    await this.enqueue(versionId);
    return this.knowledge.document(user, documentId);
  }

  /** A new version of a document from an uploaded file, sent to be processed. */
  async uploadVersion(
    user: AuthUser,
    documentId: string,
    input: KnowledgeVersionUpload,
  ): Promise<KnowledgeDocumentView> {
    const format = knowledgeFormatOfFileName(input.fileName);
    if (!format) {
      throw new ValidationError([
        { path: 'fileName', message: 'Upload a Markdown, text or HTML file' },
      ]);
    }
    const version = await this.knowledge.createVersion(user, documentId, {
      content: input.content,
      format,
    });
    await this.enqueue(version.id);
    return this.knowledge.document(user, documentId);
  }

  /**
   * A document processed again: its newest version read again when it failed or was never read;
   * otherwise its current version's vectors rebuilt under the active contract. Refused while its
   * processing runs, and when it cannot be indexed now (a draft source, an archived one) — said why.
   */
  async processDocument(user: AuthUser, documentId: string): Promise<KnowledgeDocumentView> {
    const document = await this.knowledge.document(user, documentId);
    const row = await this.prisma.knowledgeDocument.findUniqueOrThrow({
      where: { id: document.id },
      select: { source: { select: { status: true } } },
    });
    if (row.source.status === 'archived' || document.status === 'archived') {
      throw new ConflictError(
        'This knowledge source is archived: nothing in it changes or is drawn on again.',
        KNOWLEDGE_ERROR_CODES.SOURCE_ARCHIVED,
      );
    }
    const newest = document.versions.at(-1);
    if (!newest) {
      throw new ConflictError(
        'This document has no version to process yet: upload one.',
        KNOWLEDGE_ERROR_CODES.NOTHING_TO_PROCESS,
      );
    }
    let step: 'ingest' | 'rebuild';
    if (newest.status !== 'chunked') {
      if (newest.status === 'processing' && !(await this.leaseLapsed(newest.id))) {
        throw running();
      }
      step = 'ingest';
      await this.enqueue(newest.id);
    } else {
      step = 'rebuild';
      const outcome = await this.embedding.ensureRequested(user.id, newest.id, { rebuild: true });
      if (outcome === 'running') throw running();
      if (outcome === 'unavailable') {
        throw new ConflictError(
          'SI Academy AI cannot index knowledge on this installation.',
          KNOWLEDGE_ERROR_CODES.EMBEDDINGS_UNAVAILABLE,
        );
      }
      if (outcome !== 'requested' && outcome !== 'embedded') {
        throw new ConflictError(
          NOT_INDEXABLE[outcome] ?? `This version cannot be indexed (${outcome}).`,
          KNOWLEDGE_ERROR_CODES.NOT_EMBEDDABLE,
        );
      }
    }
    await this.audit.record({
      action: 'ai.knowledge.document.processing_requested',
      resourceType: 'knowledge_document',
      resourceId: document.id,
      summary: `Knowledge document "${document.title}" was sent to be processed again`,
      after: { versionId: newest.id, version: newest.version, step },
    });
    return this.knowledge.document(user, document.id);
  }

  /**
   * Every document of a source processed as far as it can be now — after it is published, above
   * all: a version never read is sent to be read; a current one not yet indexed, to be indexed. A
   * failed version is left for a new one, or for "process again".
   */
  async processSource(user: AuthUser, sourceId: string): Promise<KnowledgeProcessingSummary> {
    const source = await this.knowledge.source(user, sourceId);
    if (source.status === 'archived') {
      throw new ConflictError(
        'This knowledge source is archived: nothing in it changes or is drawn on again.',
        KNOWLEDGE_ERROR_CODES.SOURCE_ARCHIVED,
      );
    }
    const summary: KnowledgeProcessingSummary = { ingesting: 0, indexing: 0, ready: 0, waiting: 0 };
    for (const document of source.documents) {
      const newest = document.versions.at(-1);
      if (document.status !== 'active' || !newest || newest.status === 'failed') {
        summary.waiting += 1;
      } else if (newest.status === 'pending') {
        await this.enqueue(newest.id);
        summary.ingesting += 1;
      } else if (newest.status === 'processing') {
        summary.ingesting += 1;
      } else {
        const outcome = await this.embedding.ensureRequested(user.id, newest.id);
        if (outcome === 'requested' || outcome === 'running') summary.indexing += 1;
        else if (outcome === 'embedded') summary.ready += 1;
        else summary.waiting += 1;
      }
    }
    await this.audit.record({
      action: 'ai.knowledge.source.processing_requested',
      resourceType: 'knowledge_source',
      resourceId: source.id,
      summary: `Knowledge source "${source.name}" was sent to be processed`,
      after: summary,
    });
    return knowledgeProcessingSummarySchema.parse(summary);
  }

  /**
   * The job: the version read and chunked unless it is already, then — once it is its document's
   * current version — embedding asked for, counted to whoever added it. A failure ingestion says may
   * pass goes back to the queue while it has retries; everything else is recorded where it happened.
   */
  async process(
    versionId: string,
    options: { final?: boolean } = {},
  ): Promise<KnowledgeProcessingOutcome> {
    const flags = await this.flags.list();
    const on = (key: string) => flags.some((flag) => flag.key === key && flag.enabled);
    if (!on(AI_MODULE_FLAG) || !on(AI_KNOWLEDGE_FLAG)) {
      return { status: 'skipped', reason: 'switched_off' };
    }
    const org = await this.tenant.getOrganization();
    const version = await this.prisma.knowledgeDocumentVersion.findFirst({
      where: { id: versionId, organizationId: org.id },
      select: { status: true, isCurrent: true, createdById: true },
    });
    if (!version) return { status: 'skipped', reason: 'not_found' };
    if (version.status !== 'chunked') {
      const ingested = await this.ingestion.ingest(versionId, options);
      if (ingested.status !== 'chunked') return ingested;
      if (!ingested.current) return { status: 'skipped', reason: 'not_current' };
    } else if (!version.isCurrent) {
      return { status: 'skipped', reason: 'not_current' };
    }
    if (!version.createdById) return { status: 'skipped', reason: 'no_requester' };
    const embedding = await this.embedding.ensureRequested(version.createdById, versionId);
    return { status: 'processed', embedding };
  }

  private async enqueue(versionId: string): Promise<void> {
    await this.jobs.enqueue(
      KNOWLEDGE_JOBS.process,
      { versionId },
      {
        singletonKey: `${KNOWLEDGE_JOBS.process}:${versionId}`,
        retryLimit: 2,
        retryDelaySeconds: 60,
      },
    );
  }

  /** Whether the ingestion that holds a version has stopped answering: its lease is over. */
  private async leaseLapsed(versionId: string): Promise<boolean> {
    const row = await this.prisma.knowledgeDocumentVersion.findUnique({
      where: { id: versionId },
      select: { ingestionStartedAt: true },
    });
    const startedAt = row?.ingestionStartedAt;
    return !startedAt || startedAt.getTime() < Date.now() - KNOWLEDGE_INGESTION_LIMITS.leaseMs;
  }
}

function running(): ConflictError {
  return new ConflictError(
    'This document is being processed now: wait for it to finish.',
    KNOWLEDGE_ERROR_CODES.PROCESSING_RUNNING,
  );
}
