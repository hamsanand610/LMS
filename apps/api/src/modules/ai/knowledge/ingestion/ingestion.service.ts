import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  KNOWLEDGE_ERROR_CODES,
  type KnowledgeIngestionFailure,
  type KnowledgeVersionView,
  knowledgeVersionJobSchema,
} from '@lms/shared';
import { AuditService } from '../../../../core/audit/audit.service.js';
import type { AuthUser } from '../../../../core/auth/auth-user.js';
import { AppError, ConflictError, NotFoundError } from '../../../../core/http/errors.js';
import { PrismaService } from '../../../../core/prisma/prisma.service.js';
import { JobsService } from '../../../../core/queue/jobs.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../../../core/storage/storage.driver.js';
import { TenantService } from '../../../../core/tenant/tenant.service.js';
import { FlagsService } from '../../../settings/flags.service.js';
import { knowledgeContentHash } from '../content-hash.js';
import { KNOWLEDGE_JOBS, type KnowledgeEmbeddingInput } from '../knowledge-jobs.js';
import { RETRIEVABLE_DATA_CLASSES } from '../knowledge-reach.service.js';
import {
  KNOWLEDGE_FILE_OWNER,
  KnowledgeService,
  knowledgeFileFolder,
} from '../knowledge.service.js';
import { KnowledgeIngestionError, TRANSIENT_INGESTION_FAILURES } from './errors.js';
import { decodeKnowledgeText } from './normalize.js';
import { KNOWLEDGE_INGESTION_LIMITS, extractKnowledge, formatOfMime } from './pipeline.js';

/** What one run of the ingestion job did. */
export type KnowledgeIngestionOutcome =
  | { status: 'chunked'; chunks: number; current: boolean }
  | { status: 'failed'; code: KnowledgeIngestionFailure }
  | {
      status: 'skipped';
      reason: 'switched_off' | 'not_found' | 'already_chunked' | 'in_progress' | 'claim_lost';
    };

type Stage = 'checking' | 'reading' | 'verifying' | 'parsing' | 'recording';

/**
 * The knowledge base's ingestion (Roadmap Phase 8B; ADR-0034): a version's stored content to its
 * chunks, on the platform's queue (`ai.knowledge.ingest`, ADR-0006).
 *
 * 1. **Claim.** The version is taken in the database, by one ingestion only, and only if it is this
 *    institute's. The claim's time is a lease: an ingestion that stops half-way is taken over once
 *    it lapses, and every write checks it.
 * 2. **Check.** The source and document are not archived; a document about a lesson is about a
 *    lesson of its source's course; no newer version is current; the file is this version's own —
 *    its owner, institute, folder, privacy and type — and within the size limit.
 * 3. **Read and verify.** The content is read through the storage driver, never more than the limit,
 *    decoded as strict UTF-8, and its hash must be the version's.
 * 4. **Extract.** Normalised, read into its structure, chunked (`extractKnowledge`).
 * 5. **Record.** Every chunk and the chunked state in one transaction (`recordChunks`).
 *
 * Anything that stops it is recorded on the version as a code, never the content, and audited.
 * Ingestion grants nothing: a draft stays a draft and its chunks reach nobody (`KnowledgeReachService`).
 * Nothing here calls a model provider or embeds anything.
 */
@Injectable()
export class KnowledgeIngestionService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeService,
    private readonly jobs: JobsService,
    private readonly flags: FlagsService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  onModuleInit(): void {
    this.jobs.register(
      KNOWLEDGE_JOBS.ingest,
      async (payload, meta) => {
        const job = knowledgeVersionJobSchema.safeParse(payload);
        if (!job.success) {
          this.logger.warn(
            { knowledge: { job: KNOWLEDGE_JOBS.ingest } },
            'Knowledge ingestion job without a version id dropped',
          );
          return;
        }
        await this.ingest(job.data.versionId, { final: meta.final });
      },
      { concurrency: 1 },
    );
  }

  /**
   * Asks for a version's ingestion, for the people who manage the knowledge base: the version must
   * be their institute's, its source and document not archived, and it neither chunked, nor held
   * by an ingestion, nor older than the current one. The queue runs it.
   */
  async request(user: AuthUser, versionId: string): Promise<KnowledgeVersionView> {
    await this.knowledge.assertOn(user);
    const version = await this.prisma.knowledgeDocumentVersion.findFirst({
      where: { id: versionId, organizationId: user.organizationId },
      include: { document: { select: { status: true, source: { select: { status: true } } } } },
    });
    if (!version) throw new NotFoundError('Knowledge version');
    if (version.document.source.status === 'archived' || version.document.status === 'archived') {
      throw new ConflictError(
        'This knowledge source is archived: nothing in it changes or is drawn on again.',
        KNOWLEDGE_ERROR_CODES.SOURCE_ARCHIVED,
      );
    }
    if (version.status === 'chunked') {
      throw new ConflictError(
        'This version is already chunked.',
        KNOWLEDGE_ERROR_CODES.VERSION_CHUNKED,
      );
    }
    if (version.status === 'processing' && !leaseLapsed(version.ingestionStartedAt)) {
      throw new ConflictError(
        'An ingestion holds this version now.',
        KNOWLEDGE_ERROR_CODES.INGESTION_RUNNING,
      );
    }
    if (await this.superseded(version.documentId, version.version)) {
      throw new ConflictError(
        'A newer version of this document is already the current one.',
        KNOWLEDGE_ERROR_CODES.VERSION_STALE,
      );
    }
    await this.audit.record({
      action: 'ai.knowledge.ingestion.requested',
      resourceType: 'knowledge_version',
      resourceId: version.id,
      summary: `Ingestion of knowledge version ${version.version} was asked for`,
      after: { documentId: version.documentId, status: version.status },
    });
    await this.jobs.enqueue(
      KNOWLEDGE_JOBS.ingest,
      { versionId: version.id },
      {
        singletonKey: `${KNOWLEDGE_JOBS.ingest}:${version.id}`,
        retryLimit: 2,
        retryDelaySeconds: 60,
      },
    );
    return this.knowledge.version(user, version.id);
  }

  /**
   * The ingestion job. A failure that may pass is thrown back to the queue while it has retries
   * left (`final` false); every other ends here, recorded on the version.
   */
  async ingest(
    versionId: string,
    options: { final?: boolean } = {},
  ): Promise<KnowledgeIngestionOutcome> {
    const flags = await this.flags.list();
    const on = (key: string) => flags.some((flag) => flag.key === key && flag.enabled);
    if (!on(AI_MODULE_FLAG) || !on(AI_KNOWLEDGE_FLAG)) {
      return { status: 'skipped', reason: 'switched_off' };
    }
    const started = Date.now();
    const claimedAt = await this.knowledge.claim(versionId);
    if (!claimedAt) return { status: 'skipped', reason: await this.whyNotClaimed(versionId) };

    let stage: Stage = 'checking';
    try {
      const org = await this.tenant.getOrganization();
      const version = await this.prisma.knowledgeDocumentVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: {
          file: true,
          document: {
            include: {
              source: true,
              lesson: { select: { module: { select: { courseId: true } } } },
            },
          },
        },
      });
      const { document, file } = version;
      const { source } = document;
      if (source.status === 'archived') fail('source_archived', 'The source is archived');
      if (document.status === 'archived') fail('document_archived', 'The document is archived');
      if (
        document.lessonId &&
        (source.audience !== 'course' || document.lesson?.module.courseId !== source.courseId)
      ) {
        fail(
          'document_mismatch',
          'The document is about a lesson outside the course of its source',
        );
      }
      if (await this.superseded(version.documentId, version.version)) {
        fail('stale_version', 'A newer version of the document is current');
      }
      if (
        file.ownerType !== KNOWLEDGE_FILE_OWNER ||
        file.ownerId !== version.id ||
        file.organizationId !== version.organizationId ||
        file.visibility !== 'private' ||
        file.status !== 'ready' ||
        !file.key.startsWith(knowledgeFileFolder(org.key, version.documentId))
      ) {
        fail('file_mismatch', 'The file does not belong to this version');
      }
      const format = formatOfMime(file.mime);
      if (!format)
        fail('unsupported_format', 'The content is stored in a type ingestion does not read');
      if (file.size > KNOWLEDGE_INGESTION_LIMITS.sourceBytes) {
        fail('source_too_large', 'The stored content is larger than ingestion reads');
      }

      stage = 'reading';
      const limit = KNOWLEDGE_INGESTION_LIMITS.sourceBytes;
      const bytes = await this.storage.readHead('private', file.key, limit + 1);
      if (!bytes) fail('missing_file', 'The stored content is missing');
      if (bytes.length > limit)
        fail('source_too_large', 'The stored content is larger than ingestion reads');

      stage = 'verifying';
      const text = decodeKnowledgeText(bytes);
      if (
        knowledgeContentHash(text) !== version.contentHash ||
        file.checksum !== version.contentHash
      ) {
        fail('checksum_mismatch', 'The stored content is not the content the version was given');
      }
      inTime(started);

      stage = 'parsing';
      const extracted = extractKnowledge(text, format);
      inTime(started);

      stage = 'recording';
      const recorded = await this.knowledge.recordChunks(version.id, extracted.chunks, {
        claimedAt,
        parserVersion: extracted.parserVersion,
        chunkerVersion: extracted.chunkerVersion,
        durationMs: Date.now() - started,
      });
      this.logger.log(
        { knowledge: { versionId, chunks: recorded.chunks, ms: Date.now() - started } },
        'Knowledge version ingested',
      );
      return { status: 'chunked', ...recorded };
    } catch (error) {
      if (error instanceof AppError && error.code === 'knowledge_version_not_processing') {
        // Another ingestion took the version over once this one's lease had lapsed.
        return { status: 'skipped', reason: 'claim_lost' };
      }
      const code = failureOf(error, stage);
      await this.knowledge.failIngestion(versionId, code, claimedAt, stage).catch(() => false);
      this.logger.warn(
        { knowledge: { versionId, failure: code, stage } },
        'Knowledge version not ingested',
      );
      if (TRANSIENT_INGESTION_FAILURES.has(code) && options.final === false) {
        throw new Error(`Knowledge ingestion will be tried again (${code})`);
      }
      return { status: 'failed', code };
    }
  }

  /**
   * What Phase 8C embeds (`KnowledgeEmbeddingInput`): a chunked version's chunks with their
   * provenance and visibility, read from the database alone — never the version's file. None for a
   * version not chunked, archived, of another institute, or of data the provider may not be given.
   */
  async chunksForEmbedding(versionId: string): Promise<KnowledgeEmbeddingInput[]> {
    const org = await this.tenant.getOrganization();
    const version = await this.prisma.knowledgeDocumentVersion.findFirst({
      where: { id: versionId, organizationId: org.id, status: 'chunked' },
      include: { document: { include: { source: true } } },
    });
    if (!version) return [];
    const { document } = version;
    const { source } = document;
    const embeddable =
      source.status !== 'archived' &&
      document.status === 'active' &&
      (RETRIEVABLE_DATA_CLASSES as readonly string[]).includes(source.dataClass);
    if (!embeddable) return [];
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { versionId: version.id },
      orderBy: { position: 'asc' },
    });
    return chunks.map((chunk) => ({
      chunkId: chunk.id,
      organizationId: chunk.organizationId,
      sourceId: chunk.sourceId,
      documentId: chunk.documentId,
      versionId: chunk.versionId,
      position: chunk.position,
      heading: chunk.heading,
      content: chunk.content,
      contentHash: chunk.contentHash,
      characterCount: chunk.characterCount,
      tokenEstimate: chunk.tokenEstimate,
      parserVersion: version.parserVersion,
      chunkerVersion: version.chunkerVersion,
      document: {
        title: document.title,
        canonicalRef: document.canonicalRef,
        lessonId: document.lessonId,
      },
      visibility: {
        audience: source.audience,
        courseId: source.courseId,
        dataClass: source.dataClass,
        sourceStatus: source.status,
        isCurrent: version.isCurrent,
      },
    }));
  }

  /** Whether a newer version of the document is already its current one. */
  private async superseded(documentId: string, version: number): Promise<boolean> {
    const newer = await this.prisma.knowledgeDocumentVersion.count({
      where: { documentId, isCurrent: true, version: { gt: version } },
    });
    return newer > 0;
  }

  private async whyNotClaimed(
    versionId: string,
  ): Promise<'not_found' | 'already_chunked' | 'in_progress'> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.knowledgeDocumentVersion.findFirst({
      where: { id: versionId, organizationId: org.id },
      select: { status: true },
    });
    if (!row) return 'not_found';
    return row.status === 'chunked' ? 'already_chunked' : 'in_progress';
  }
}

function fail(code: KnowledgeIngestionFailure, detail: string): never {
  throw new KnowledgeIngestionError(code, detail);
}

function inTime(started: number): void {
  if (Date.now() - started > KNOWLEDGE_INGESTION_LIMITS.deadlineMs) {
    fail('processing_timeout', 'The ingestion took longer than it may');
  }
}

function leaseLapsed(startedAt: Date | null): boolean {
  return !startedAt || startedAt.getTime() < Date.now() - KNOWLEDGE_INGESTION_LIMITS.leaseMs;
}

/** An unforeseen error, by the stage it stopped: storage and the database may pass; a reader not. */
function failureOf(error: unknown, stage: Stage): KnowledgeIngestionFailure {
  if (error instanceof KnowledgeIngestionError) return error.code;
  switch (stage) {
    case 'reading':
      return 'storage_unavailable';
    case 'verifying':
    case 'parsing':
      return 'parser_failed';
    default:
      return 'persist_failed';
  }
}
