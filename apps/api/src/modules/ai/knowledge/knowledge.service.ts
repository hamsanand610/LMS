import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AI_ERROR_CODES,
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  KNOWLEDGE_ERROR_CODES,
  KNOWLEDGE_FORMAT_MIME,
  KNOWLEDGE_SOURCE_STATUSES,
  KNOWLEDGE_VERSION_STATUSES,
  type KnowledgeVersionFormat,
  type KnowledgeChunkPage,
  type KnowledgeChunkQuery,
  type KnowledgeDocumentCreate,
  type KnowledgeDocumentUpdate,
  type KnowledgeDocumentView,
  type KnowledgeSourceCreate,
  type KnowledgeSourceDetail,
  type KnowledgeSourceUpdate,
  type KnowledgeSourceView,
  type KnowledgeStatus,
  type KnowledgeUpload,
  type KnowledgeVersionCreate,
  type KnowledgeVersionView,
  knowledgeChunkPageSchema,
  knowledgeDocumentViewSchema,
  knowledgeFormatOfFileName,
  knowledgeSourceDetailSchema,
  knowledgeSourceViewSchema,
  knowledgeStatusSchema,
  knowledgeVersionViewSchema,
} from '@lms/shared';
import { AuditService } from '../../../core/audit/audit.service.js';
import type { AuthUser } from '../../../core/auth/auth-user.js';
import {
  ConflictError,
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../core/http/errors.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../../core/storage/storage.driver.js';
import { TenantService } from '../../../core/tenant/tenant.service.js';
import { FlagsService } from '../../settings/flags.service.js';
import { AiRestrictedContentError } from '../ai-errors.js';
import { credentialsIn } from '../policy/data-class.js';
import { ModelRouter } from '../routing/model-router.js';
import { estimateTokens } from '../usage/cost.js';
import { knowledgeChunkId, knowledgeContentHash, normaliseKnowledgeText } from './content-hash.js';
import { activeEmbeddingContract, contractWhere } from './embedding/contract.js';
import { KNOWLEDGE_CHUNKING } from './ingestion/chunker.js';
import { KNOWLEDGE_INGESTION_LIMITS, formatOfMime } from './ingestion/pipeline.js';
import { VectorReadinessService } from './vector-readiness.js';

/** What a chunk is made of, as ingestion hands it over (Phase 8B cuts them). */
export interface KnowledgeChunkInput {
  heading?: string;
  content: string;
}

/** What an ingestion tells the version it records (Phase 8B). */
export interface KnowledgeChunksRecording {
  /** The claim the ingestion holds: the chunks are recorded only while it still holds. */
  claimedAt?: Date;
  parserVersion?: string;
  chunkerVersion?: string;
  /** How long the ingestion took, for the audit. */
  durationMs?: number;
}

/** The file owner type of a version's stored content: institution material, no person's upload. */
export const KNOWLEDGE_FILE_OWNER = 'knowledge-version';

/** Where a version's file is kept: under its institute and its document (Phase 8B checks it). */
export function knowledgeFileFolder(organizationKey: string, documentId: string): string {
  return `${organizationKey}/knowledge/${documentId}/`;
}

const EXTENSION: Record<KnowledgeVersionFormat, string> = {
  markdown: 'md',
  text: 'txt',
  html: 'html',
};

const HEADING_MAX = 300;

/**
 * The knowledge base's management and its ingestion states (Roadmap Phase 8A; ADR-0033), for the
 * people who hold `ai:knowledge_manage` while `module.ai` and `ai.knowledge` are on.
 *
 * - **The institute's own.** Every read and write is held to the person's own institute; another
 *   institute's knowledge is not found.
 * - **Sources** are drafts until published, and an archived source is closed for good. Who a source
 *   is for and what it holds are settled while it is a draft.
 * - **Versions** keep their content through the platform's storage driver, as a private file that
 *   belongs to the institute (no person uploaded it, so no erasure ever takes it), and are told
 *   apart by the hash of their normalised content: the same content is never kept twice.
 * - **Ingestion** moves a version pending → processing → chunked (or failed), by claims in the
 *   database; only the newest chunked version is the current one, the one answers may draw on.
 * - **Audit:** every change, by ids, names and counts — never the content.
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
    private readonly flags: FlagsService,
    private readonly vectors: VectorReadinessService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly router: ModelRouter,
  ) {}

  /**
   * What a version's view needs: its file's format, and its embedding run under the active contract
   * (Phase 8C) — none while the AI cannot embed.
   */
  private versionInclude() {
    const contract = activeEmbeddingContract(this.router);
    return {
      file: { select: { mime: true } },
      embeddings: { where: contract ? contractWhere(contract) : { id: { in: [] as string[] } } },
    };
  }

  /** What a document's view needs: its versions, and the lesson it is about with its module. */
  private documentInclude() {
    return {
      versions: { orderBy: { version: 'asc' as const }, include: this.versionInclude() },
      lesson: {
        select: { id: true, title: true, moduleId: true, module: { select: { title: true } } },
      },
    };
  }

  /** The knowledge base is managed only while `module.ai` and `ai.knowledge` are both on. */
  async assertOn(user: AuthUser): Promise<void> {
    const flags = await this.flags.effectiveFor(user);
    if (flags[AI_MODULE_FLAG] !== true || flags[AI_KNOWLEDGE_FLAG] !== true) {
      throw new ForbiddenError(
        'The SI Academy AI knowledge base is switched off.',
        AI_ERROR_CODES.FEATURE_DISABLED,
      );
    }
  }

  // ───────────────────────── sources ─────────────────────────

  async listSources(user: AuthUser): Promise<KnowledgeSourceView[]> {
    await this.assertOn(user);
    const rows = await this.prisma.knowledgeSource.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      include: SOURCE_INCLUDE,
    });
    return rows.map(toSourceView);
  }

  async source(user: AuthUser, id: string): Promise<KnowledgeSourceDetail> {
    await this.assertOn(user);
    const row = await this.prisma.knowledgeSource.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        ...SOURCE_INCLUDE,
        documents: { orderBy: { createdAt: 'asc' }, include: this.documentInclude() },
      },
    });
    if (!row) throw new NotFoundError('Knowledge source');
    return knowledgeSourceDetailSchema.parse({
      ...toSourceView(row),
      documents: row.documents.map(toDocumentView),
    });
  }

  async createSource(user: AuthUser, input: KnowledgeSourceCreate): Promise<KnowledgeSourceView> {
    await this.assertOn(user);
    if (input.courseId) await this.requireCourse(user, input.courseId);
    const row = await this.prisma.knowledgeSource.create({
      data: {
        organizationId: user.organizationId,
        name: input.name,
        description: input.description,
        type: input.type,
        audience: input.audience,
        courseId: input.courseId,
        dataClass: input.dataClass,
        createdById: user.id,
      },
      include: SOURCE_INCLUDE,
    });
    await this.audit.record({
      action: 'ai.knowledge.source.created',
      resourceType: 'knowledge_source',
      resourceId: row.id,
      summary: `Knowledge source "${row.name}" was created`,
      after: { name: row.name, type: row.type, audience: row.audience, dataClass: row.dataClass },
    });
    return toSourceView(row);
  }

  async updateSource(
    user: AuthUser,
    id: string,
    input: KnowledgeSourceUpdate,
  ): Promise<KnowledgeSourceView> {
    const before = await this.findSource(user, id);
    if (before.status === 'archived') throw closedSource();
    const settles = ['audience', 'courseId', 'dataClass'] as const;
    if (before.status !== 'draft' && settles.some((field) => input[field] !== undefined)) {
      throw new ConflictError(
        'Who a source is for, and what it holds, are settled before it is published.',
        KNOWLEDGE_ERROR_CODES.SOURCE_PUBLISHED,
      );
    }
    const audience = input.audience ?? before.audience;
    const courseId = input.courseId !== undefined ? input.courseId : before.courseId;
    if ((audience === 'course') !== (courseId !== null)) {
      throw new ValidationError([
        {
          path: 'courseId',
          message: 'A course audience needs its course; any other audience needs none',
        },
      ]);
    }
    if (courseId !== before.courseId) {
      // A document about a lesson holds its source to that lesson's course (Phase 8B).
      const bound = await this.prisma.knowledgeDocument.count({
        where: { sourceId: before.id, lessonId: { not: null } },
      });
      if (bound > 0) {
        throw new ConflictError(
          'Documents of this source are about lessons of its course, so its course stays.',
          KNOWLEDGE_ERROR_CODES.LESSON_DOCUMENTS,
        );
      }
    }
    if (courseId && courseId !== before.courseId) await this.requireCourse(user, courseId);
    // Written only in the state it was read in: a publication or an archive meanwhile wins (8F).
    const settling = settles.some((field) => input[field] !== undefined);
    const written = await this.prisma.knowledgeSource.updateMany({
      where: { id: before.id, status: settling ? 'draft' : { not: 'archived' } },
      data: { ...input, courseId },
    });
    if (written.count === 0) {
      throw settling
        ? new ConflictError(
            'Who a source is for, and what it holds, are settled before it is published.',
            KNOWLEDGE_ERROR_CODES.SOURCE_PUBLISHED,
          )
        : closedSource();
    }
    const row = await this.prisma.knowledgeSource.findUniqueOrThrow({
      where: { id: before.id },
      include: SOURCE_INCLUDE,
    });
    await this.audit.record({
      action: 'ai.knowledge.source.updated',
      resourceType: 'knowledge_source',
      resourceId: row.id,
      summary: `Knowledge source "${row.name}" was changed`,
      before: { name: before.name, audience: before.audience, dataClass: before.dataClass },
      after: { name: row.name, audience: row.audience, dataClass: row.dataClass },
    });
    return toSourceView(row);
  }

  /** Draft → published. A published source's current versions become what answers may draw on. */
  async publishSource(user: AuthUser, id: string): Promise<KnowledgeSourceView> {
    const source = await this.findSource(user, id);
    if (source.status === 'archived') throw closedSource();
    if (source.status === 'published') {
      throw new ConflictError(
        'This source is already published.',
        KNOWLEDGE_ERROR_CODES.ALREADY_PUBLISHED,
      );
    }
    const updated = await this.prisma.knowledgeSource.updateMany({
      where: { id: source.id, status: 'draft' },
      data: { status: 'published', publishedAt: new Date() },
    });
    if (updated.count === 0) throw new ConflictError('The source changed meanwhile; try again.');
    await this.audit.record({
      action: 'ai.knowledge.source.published',
      resourceType: 'knowledge_source',
      resourceId: source.id,
      summary: `Knowledge source "${source.name}" was published`,
      after: { audience: source.audience, dataClass: source.dataClass },
    });
    return this.sourceView(source.id);
  }

  /** Draft or published → archived, for good: nothing in it is drawn on again. */
  async archiveSource(user: AuthUser, id: string): Promise<KnowledgeSourceView> {
    const source = await this.findSource(user, id);
    if (source.status === 'archived') throw closedSource();
    // Archived knowledge is never drawn on again, so its vectors go with it (Phase 8C).
    const purged = await this.prisma.$transaction(async (tx) => {
      // Once: an archive meanwhile leaves this one nothing to do (8F).
      const archived = await tx.knowledgeSource.updateMany({
        where: { id: source.id, status: { not: 'archived' } },
        data: { status: 'archived', archivedAt: new Date() },
      });
      if (archived.count === 0) throw closedSource();
      const vectors = await tx.knowledgeChunkEmbedding.deleteMany({
        where: { sourceId: source.id },
      });
      await tx.knowledgeVersionEmbedding.deleteMany({ where: { sourceId: source.id } });
      return vectors.count;
    });
    await this.audit.record({
      action: 'ai.knowledge.source.archived',
      resourceType: 'knowledge_source',
      resourceId: source.id,
      summary: `Knowledge source "${source.name}" was archived`,
      before: { status: source.status },
      after: { embeddingsPurged: purged },
    });
    return this.sourceView(source.id);
  }

  // ───────────────────────── documents and versions ─────────────────────────

  async createDocument(
    user: AuthUser,
    sourceId: string,
    input: KnowledgeDocumentCreate,
  ): Promise<KnowledgeDocumentView> {
    const source = await this.findSource(user, sourceId);
    if (source.status === 'archived') throw closedSource();
    if (input.lessonId) await this.requireLessonOf(source, input.lessonId);
    const exists = await this.prisma.knowledgeDocument.findUnique({
      where: { sourceId_canonicalRef: { sourceId: source.id, canonicalRef: input.canonicalRef } },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictError(
        'A document with this reference is already in the source.',
        KNOWLEDGE_ERROR_CODES.DOCUMENT_EXISTS,
      );
    }
    const row = await this.prisma.knowledgeDocument.create({
      data: {
        organizationId: source.organizationId,
        sourceId: source.id,
        title: input.title,
        canonicalRef: input.canonicalRef,
        lessonId: input.lessonId,
        createdById: user.id,
      },
      include: this.documentInclude(),
    });
    await this.audit.record({
      action: 'ai.knowledge.document.created',
      resourceType: 'knowledge_document',
      resourceId: row.id,
      summary: `Knowledge document "${row.title}" was added`,
      after: { sourceId: source.id, canonicalRef: row.canonicalRef, lessonId: row.lessonId },
    });
    return toDocumentView(row);
  }

  /**
   * A new version of a document: its content normalised, hashed, and stored through the storage
   * driver as a private file of the institute's, in its format (Markdown, plain text or HTML; Phase
   * 8B). The same content as an earlier version is refused. Ingestion is asked for separately.
   */
  async createVersion(
    user: AuthUser,
    documentId: string,
    input: KnowledgeVersionCreate,
  ): Promise<KnowledgeVersionView> {
    await this.assertOn(user);
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { id: documentId, organizationId: user.organizationId },
      include: { source: { select: { status: true } } },
    });
    if (!document) throw new NotFoundError('Knowledge document');
    if (document.source.status === 'archived' || document.status === 'archived') {
      throw closedSource();
    }
    return this.storeVersion(user, document, input);
  }

  /**
   * A version's content checked and stored: normalised, refused when it holds a credential or is an
   * earlier version's content, kept as a private file of the institute's, and recorded.
   */
  private async storeVersion(
    user: AuthUser,
    document: {
      id: string;
      organizationId: string;
      sourceId: string;
      title: string;
      canonicalRef: string;
    },
    input: KnowledgeVersionCreate,
  ): Promise<KnowledgeVersionView> {
    const content = normaliseKnowledgeText(input.content);
    // A password, key or token never enters the knowledge base: it would be embedded, retrieved
    // and shown (Phase 8F; ADR-0036's restricted material, for content as well as data class).
    if (credentialsIn(content).length > 0) throw new AiRestrictedContentError();
    const contentHash = knowledgeContentHash(content);
    if (
      await this.prisma.knowledgeDocumentVersion.findUnique({
        where: { documentId_contentHash: { documentId: document.id, contentHash } },
        select: { id: true },
      })
    ) {
      throw duplicateVersion();
    }
    const org = await this.tenant.getOrganization();
    const bytes = Buffer.from(content, 'utf8');
    const mime = KNOWLEDGE_FORMAT_MIME[input.format];
    const extension = EXTENSION[input.format];
    // A key of its own per attempt: two people adding the same content at once never share one.
    const key = `${knowledgeFileFolder(org.key, document.id)}${randomUUID()}.${extension}`;
    // Storage first: should the record fail, this attempt's object is removed again below.
    await this.storage.put('private', key, bytes, mime);
    try {
      const version = await this.prisma.$transaction(async (tx) => {
        const last = await tx.knowledgeDocumentVersion.findFirst({
          where: { documentId: document.id },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const file = await tx.file.create({
          data: {
            organizationId: document.organizationId,
            ownerType: KNOWLEDGE_FILE_OWNER,
            driver: this.storage.name,
            bucket: this.storage.bucketName('private'),
            key,
            originalName: `${document.canonicalRef.replace(/[^\w.-]+/g, '-').slice(0, 200)}.${extension}`,
            mime,
            size: bytes.length,
            checksum: contentHash,
            visibility: 'private',
            status: 'ready',
            // The institute's material, not a person's upload: no erasure ever takes it.
            uploadedById: null,
          },
        });
        const created = await tx.knowledgeDocumentVersion.create({
          data: {
            organizationId: document.organizationId,
            sourceId: document.sourceId,
            documentId: document.id,
            version: (last?.version ?? 0) + 1,
            contentHash,
            fileId: file.id,
            characterCount: content.length,
            createdById: user.id,
          },
        });
        await tx.file.update({ where: { id: file.id }, data: { ownerId: created.id } });
        return created;
      });
      await this.audit.record({
        action: 'ai.knowledge.version.created',
        resourceType: 'knowledge_version',
        resourceId: version.id,
        summary: `Version ${version.version} of knowledge document "${document.title}" was added`,
        after: {
          documentId: document.id,
          version: version.version,
          format: input.format,
          contentHash,
          characters: content.length,
        },
      });
      return toVersionView({ ...version, file: { mime }, embeddings: [] });
    } catch (error) {
      await this.storage.delete('private', key).catch(() => undefined);
      if ((error as { code?: string }).code === 'P2002') throw duplicateVersion();
      throw error;
    }
  }

  // ───────────────────────── the Knowledge base page (Phase 10) ─────────────────────────

  /**
   * A new document from an uploaded file (Phase 10): its first version stored as any version is,
   * read in the format its extension names. Refused before anything is written when the file holds
   * a credential, or its content is already a document of the source; the document is removed again
   * should its version not be stored. Processing is the caller's (`KnowledgeProcessingService`).
   */
  async createUploadedDocument(
    user: AuthUser,
    sourceId: string,
    input: KnowledgeUpload,
  ): Promise<{ documentId: string; versionId: string }> {
    const source = await this.findSource(user, sourceId);
    if (source.status === 'archived') throw closedSource();
    if (input.lessonId) await this.requireLessonOf(source, input.lessonId);
    const format = knowledgeFormatOfFileName(input.fileName);
    if (!format) {
      throw new ValidationError([
        { path: 'fileName', message: 'Upload a Markdown, text or HTML file' },
      ]);
    }
    const content = normaliseKnowledgeText(input.content);
    if (credentialsIn(content).length > 0) throw new AiRestrictedContentError();
    const same = await this.prisma.knowledgeDocumentVersion.findFirst({
      where: { sourceId: source.id, contentHash: knowledgeContentHash(content) },
      select: { document: { select: { title: true } } },
    });
    if (same) {
      throw new ConflictError(
        `This content is already in the source, as "${same.document.title}".`,
        KNOWLEDGE_ERROR_CODES.VERSION_DUPLICATE,
      );
    }
    const document = await this.prisma.knowledgeDocument.create({
      data: {
        organizationId: source.organizationId,
        sourceId: source.id,
        title: input.title,
        canonicalRef: uploadRef(input.fileName),
        lessonId: input.lessonId,
        createdById: user.id,
      },
    });
    await this.audit.record({
      action: 'ai.knowledge.document.created',
      resourceType: 'knowledge_document',
      resourceId: document.id,
      summary: `Knowledge document "${document.title}" was uploaded`,
      after: {
        sourceId: source.id,
        canonicalRef: document.canonicalRef,
        lessonId: document.lessonId,
        format,
        uploaded: true,
      },
    });
    try {
      const version = await this.storeVersion(user, document, { content: input.content, format });
      return { documentId: document.id, versionId: version.id };
    } catch (error) {
      await this.prisma.knowledgeDocument
        .deleteMany({ where: { id: document.id } })
        .catch(() => undefined);
      throw error;
    }
  }

  /** A document of the institute's, with its versions and lesson: metadata only. */
  async document(user: AuthUser, id: string): Promise<KnowledgeDocumentView> {
    await this.assertOn(user);
    const row = await this.prisma.knowledgeDocument.findFirst({
      where: { id, organizationId: user.organizationId },
      include: this.documentInclude(),
    });
    if (!row) throw new NotFoundError('Knowledge document');
    return toDocumentView(row);
  }

  /**
   * A document's title, and the lesson of its source's course it is about. Who may draw on it
   * changes at once: retrieval reads the lesson at every question (`KnowledgeReachService`).
   */
  async updateDocument(
    user: AuthUser,
    id: string,
    input: KnowledgeDocumentUpdate,
  ): Promise<KnowledgeDocumentView> {
    await this.assertOn(user);
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { source: true },
    });
    if (!document) throw new NotFoundError('Knowledge document');
    if (document.source.status === 'archived' || document.status === 'archived') {
      throw closedSource();
    }
    if (input.lessonId) await this.requireLessonOf(document.source, input.lessonId);
    await this.prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.lessonId !== undefined ? { lessonId: input.lessonId } : {}),
      },
    });
    const view = await this.document(user, document.id);
    await this.audit.record({
      action: 'ai.knowledge.document.updated',
      resourceType: 'knowledge_document',
      resourceId: document.id,
      summary: `Knowledge document "${view.title}" was changed`,
      before: { title: document.title, lessonId: document.lessonId },
      after: { title: view.title, lessonId: view.lessonId },
    });
    return view;
  }

  /**
   * A document deleted for good (Phase 10): its versions, chunks and vectors, and its stored files,
   * removed — nothing of it is drawn on again. The audit keeps the record: ids, title and counts.
   */
  async deleteDocument(user: AuthUser, id: string): Promise<void> {
    await this.assertOn(user);
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { id: true, title: true, sourceId: true },
    });
    if (!document) throw new NotFoundError('Knowledge document');
    const purged = await this.purge([document.id], null);
    await this.audit.record({
      action: 'ai.knowledge.document.deleted',
      resourceType: 'knowledge_document',
      resourceId: document.id,
      summary: `Knowledge document "${document.title}" was deleted`,
      before: { sourceId: document.sourceId, title: document.title },
      after: purged,
    });
  }

  /** A source deleted for good, with every document in it (Phase 10), as `deleteDocument`. */
  async deleteSource(user: AuthUser, id: string): Promise<void> {
    const source = await this.findSource(user, id);
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { sourceId: source.id },
      select: { id: true },
    });
    const purged = await this.purge(
      documents.map((document) => document.id),
      source.id,
    );
    await this.audit.record({
      action: 'ai.knowledge.source.deleted',
      resourceType: 'knowledge_source',
      resourceId: source.id,
      summary: `Knowledge source "${source.name}" was deleted`,
      before: { name: source.name, status: source.status, audience: source.audience },
      after: { documents: documents.length, ...purged },
    });
  }

  /** One page of a version's chunks, in order: what the people who manage it inspect. */
  async chunks(
    user: AuthUser,
    versionId: string,
    query: KnowledgeChunkQuery,
  ): Promise<KnowledgeChunkPage> {
    await this.assertOn(user);
    const version = await this.prisma.knowledgeDocumentVersion.findFirst({
      where: { id: versionId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!version) throw new NotFoundError('Knowledge version');
    const [total, rows] = await Promise.all([
      this.prisma.knowledgeChunk.count({ where: { versionId: version.id } }),
      this.prisma.knowledgeChunk.findMany({
        where: { versionId: version.id },
        orderBy: { position: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          position: true,
          heading: true,
          content: true,
          characterCount: true,
          tokenEstimate: true,
        },
      }),
    ]);
    return knowledgeChunkPageSchema.parse({
      versionId: version.id,
      items: rows,
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /**
   * Documents removed with all they hold — and their source, when one is named — in one
   * transaction: the source and each document locked first (ingestion's recording locks the
   * document too), then their versions deleted (their chunks, vectors and embedding runs go with
   * them in the database), their files' records, the documents. The stored objects go once the
   * records are gone: a key without a record is never read again. Should the database end the
   * transaction to break a deadlock with a writer, it is tried again.
   */
  private async purge(
    documentIds: string[],
    sourceId: string | null,
  ): Promise<{ versions: number; chunks: number; vectors: number; files: number }> {
    const ids = [...documentIds].sort();
    const run = () =>
      this.prisma.$transaction(async (tx) => {
        if (sourceId) {
          await tx.$queryRaw`SELECT id FROM knowledge_sources WHERE id = ${sourceId}::uuid FOR UPDATE`;
        }
        if (ids.length > 0) {
          await tx.$queryRaw`SELECT id FROM knowledge_documents WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
        }
        const where = { documentId: { in: ids } };
        const [vectors, chunks, versions] = await Promise.all([
          tx.knowledgeChunkEmbedding.count({ where }),
          tx.knowledgeChunk.count({ where }),
          tx.knowledgeDocumentVersion.findMany({
            where,
            select: { fileId: true, file: { select: { key: true } } },
          }),
        ]);
        await tx.knowledgeDocumentVersion.deleteMany({ where });
        const files = await tx.file.deleteMany({
          where: {
            id: { in: versions.map((version) => version.fileId) },
            ownerType: KNOWLEDGE_FILE_OWNER,
          },
        });
        await tx.knowledgeDocument.deleteMany({ where: { id: { in: ids } } });
        if (sourceId) await tx.knowledgeSource.delete({ where: { id: sourceId } });
        return {
          counts: { versions: versions.length, chunks, vectors, files: files.count },
          keys: versions.map((version) => version.file.key),
        };
      });
    let result: Awaited<ReturnType<typeof run>> | null = null;
    for (let attempt = 1; !result; attempt += 1) {
      try {
        result = await run();
      } catch (error) {
        if (attempt >= 3 || !isDeadlock(error)) throw error;
      }
    }
    let left = 0;
    for (const key of result.keys) {
      await this.storage.delete('private', key).catch(() => {
        left += 1;
      });
    }
    if (left > 0) {
      this.logger.warn(
        { knowledge: { storedObjectsLeft: left } },
        'Deleted knowledge left stored objects behind',
      );
    }
    return result.counts;
  }

  // ───────────────────────── ingestion states (the contract for Phase 8B) ─────────────────────────

  /**
   * Takes a version of this institute for ingestion, by one caller only: pending, failed (to try
   * again), or processing past its lease (an ingestion that stopped half-way) → processing. Gives
   * the claim's time — the token the ingestion's writes check — or null when the version is not
   * this institute's, another ingestion holds it, or it is chunked already.
   */
  async claim(versionId: string): Promise<Date | null> {
    const org = await this.tenant.getOrganization();
    const claimedAt = new Date();
    const leaseEnded = new Date(claimedAt.getTime() - KNOWLEDGE_INGESTION_LIMITS.leaseMs);
    const claimed = await this.prisma.knowledgeDocumentVersion.updateMany({
      where: {
        id: versionId,
        organizationId: org.id,
        OR: [
          { status: { in: ['pending', 'failed'] } },
          { status: 'processing', ingestionStartedAt: { lt: leaseEnded } },
        ],
      },
      data: { status: 'processing', failureCode: null, ingestionStartedAt: claimedAt },
    });
    if (claimed.count !== 1) return null;
    await this.recordState(versionId, 'processing');
    return claimedAt;
  }

  /** `claim`, as Phase 8A asked it: whether the version was taken. */
  async claimForIngestion(versionId: string): Promise<boolean> {
    return (await this.claim(versionId)) !== null;
  }

  /**
   * Records a claimed version's chunks, in order, with their whole provenance, their hashes and
   * their identities (ids that follow from the version, the place and the content), and marks the
   * version chunked — in one transaction, so a version is never chunked with only some of its
   * chunks. Chunks an interrupted ingestion left are replaced, never added to. Given its claim, an
   * ingestion records only while that claim still holds. The newest chunked version of a document
   * becomes its current one.
   */
  async recordChunks(
    versionId: string,
    chunks: readonly KnowledgeChunkInput[],
    recording: KnowledgeChunksRecording = {},
  ): Promise<{ chunks: number; current: boolean }> {
    const max = KNOWLEDGE_CHUNKING.maxCharacters;
    const cleaned = chunks.map((chunk, position) => {
      const content = normaliseKnowledgeText(chunk.content);
      if (!content || content.length > max) {
        throw new ValidationError([
          { path: `chunks.${position}`, message: `A chunk has text, at most ${max} characters` },
        ]);
      }
      const contentHash = knowledgeContentHash(content);
      return {
        id: knowledgeChunkId(versionId, position, contentHash),
        position,
        heading: (chunk.heading ?? '').trim().slice(0, HEADING_MAX),
        content,
        contentHash,
        characterCount: content.length,
        tokenEstimate: estimateTokens(content.length),
      };
    });
    if (cleaned.length === 0 || cleaned.length > KNOWLEDGE_INGESTION_LIMITS.chunks) {
      throw new ValidationError([
        {
          path: 'chunks',
          message: `A version has 1 to ${KNOWLEDGE_INGESTION_LIMITS.chunks} chunks`,
        },
      ]);
    }
    const summary = await this.prisma.$transaction(async (tx) => {
      // Held, and locked until this transaction ends: no claim or other recording comes between.
      const held = await tx.knowledgeDocumentVersion.updateMany({
        where: {
          id: versionId,
          status: 'processing',
          ...(recording.claimedAt ? { ingestionStartedAt: recording.claimedAt } : {}),
        },
        data: { failureCode: null },
      });
      if (held.count !== 1) {
        throw new DomainRuleError(
          'Only a version taken for ingestion, by this ingestion, has its chunks recorded.',
          'knowledge_version_not_processing',
        );
      }
      const version = await tx.knowledgeDocumentVersion.findUniqueOrThrow({
        where: { id: versionId },
      });
      // One recording per document at a time, so its current version is decided once.
      await tx.$queryRaw`SELECT id FROM knowledge_documents WHERE id = ${version.documentId}::uuid FOR UPDATE`;
      await tx.knowledgeChunk.deleteMany({ where: { versionId: version.id } });
      await tx.knowledgeChunk.createMany({
        data: cleaned.map((chunk) => ({
          ...chunk,
          organizationId: version.organizationId,
          sourceId: version.sourceId,
          documentId: version.documentId,
          versionId: version.id,
        })),
      });
      const current = await tx.knowledgeDocumentVersion.findFirst({
        where: { documentId: version.documentId, isCurrent: true },
        select: { id: true, version: true },
      });
      const becomesCurrent = !current || current.version < version.version;
      if (becomesCurrent && current) {
        await tx.knowledgeDocumentVersion.update({
          where: { id: current.id },
          data: { isCurrent: false },
        });
      }
      await tx.knowledgeDocumentVersion.update({
        where: { id: version.id },
        data: {
          status: 'chunked',
          chunkCount: cleaned.length,
          chunkedAt: new Date(),
          isCurrent: becomesCurrent,
          parserVersion: recording.parserVersion ?? null,
          chunkerVersion: recording.chunkerVersion ?? null,
        },
      });
      return { documentId: version.documentId, becomesCurrent };
    });
    await this.audit.record({
      action: 'ai.knowledge.chunks.recorded',
      resourceType: 'knowledge_version',
      resourceId: versionId,
      summary: `${cleaned.length} knowledge chunks were recorded`,
      after: {
        documentId: summary.documentId,
        chunks: cleaned.length,
        characters: cleaned.reduce((sum, chunk) => sum + chunk.characterCount, 0),
        current: summary.becomesCurrent,
        chunkerVersion: recording.chunkerVersion ?? null,
      },
    });
    await this.recordState(versionId, 'chunked', {
      chunks: cleaned.length,
      parserVersion: recording.parserVersion ?? null,
      chunkerVersion: recording.chunkerVersion ?? null,
      ...(recording.durationMs !== undefined ? { durationMs: recording.durationMs } : {}),
    });
    return { chunks: cleaned.length, current: summary.becomesCurrent };
  }

  /**
   * A claimed version that could not be ingested: failed, with a code and the stage it stopped at —
   * never its content. Given its claim, only the ingestion that holds it fails it.
   */
  async failIngestion(
    versionId: string,
    failureCode: string,
    claimedAt?: Date,
    stage?: string,
  ): Promise<boolean> {
    const code = failureCode.slice(0, 60);
    const failed = await this.prisma.knowledgeDocumentVersion.updateMany({
      where: {
        id: versionId,
        status: 'processing',
        ...(claimedAt ? { ingestionStartedAt: claimedAt } : {}),
      },
      data: { status: 'failed', failureCode: code },
    });
    if (failed.count === 1) {
      await this.recordState(versionId, 'failed', {
        failureCode: code,
        ...(stage ? { stage } : {}),
      });
    }
    return failed.count === 1;
  }

  /** One version of the institute's, metadata only: where its ingestion stands (Phase 8B). */
  async version(user: AuthUser, id: string): Promise<KnowledgeVersionView> {
    await this.assertOn(user);
    const row = await this.prisma.knowledgeDocumentVersion.findFirst({
      where: { id, organizationId: user.organizationId },
      include: this.versionInclude(),
    });
    if (!row) throw new NotFoundError('Knowledge version');
    return toVersionView(row);
  }

  // ───────────────────────── status ─────────────────────────

  /** Counts by state, and whether the database can hold vectors yet. Never any content. */
  async status(user: AuthUser): Promise<KnowledgeStatus> {
    await this.assertOn(user);
    const organizationId = user.organizationId;
    const contract = activeEmbeddingContract(this.router);
    const [sources, versions, chunks, embeddings, vector] = await Promise.all([
      this.prisma.knowledgeSource.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.knowledgeDocumentVersion.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.knowledgeChunk.count({ where: { organizationId } }),
      contract
        ? this.prisma.knowledgeChunkEmbedding.count({
            where: { organizationId, ...contractWhere(contract) },
          })
        : Promise.resolve(0),
      this.vectors.check(),
    ]);
    const countsOf = <K extends string>(
      keys: readonly K[],
      rows: { status: K; _count: { _all: number } }[],
    ) =>
      Object.fromEntries(
        keys.map((key) => [key, rows.find((r) => r.status === key)?._count._all ?? 0]),
      );
    return knowledgeStatusSchema.parse({
      sources: countsOf(KNOWLEDGE_SOURCE_STATUSES, sources),
      versions: countsOf(KNOWLEDGE_VERSION_STATUSES, versions),
      chunks,
      embeddings,
      vector,
    });
  }

  // ───────────────────────── internals ─────────────────────────

  private async findSource(user: AuthUser, id: string) {
    await this.assertOn(user);
    const source = await this.prisma.knowledgeSource.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!source) throw new NotFoundError('Knowledge source');
    return source;
  }

  private async sourceView(id: string): Promise<KnowledgeSourceView> {
    const row = await this.prisma.knowledgeSource.findUniqueOrThrow({
      where: { id },
      include: SOURCE_INCLUDE,
    });
    return toSourceView(row);
  }

  /** A lesson of the source's own course: what a document about one lesson must name. */
  private async requireLessonOf(
    source: { courseId: string | null },
    lessonId: string,
  ): Promise<void> {
    // A document about one lesson belongs to a course source, and to a lesson of its course.
    const lesson = source.courseId
      ? await this.prisma.lesson.findFirst({
          where: { id: lessonId, module: { courseId: source.courseId } },
          select: { id: true },
        })
      : null;
    if (!lesson) {
      throw new ValidationError([
        { path: 'lessonId', message: 'Name a lesson of the source’s own course' },
      ]);
    }
  }

  /** A course of the person's own institute, not deleted. */
  private async requireCourse(user: AuthUser, courseId: string): Promise<void> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, organizationId: user.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!course) {
      throw new ValidationError([{ path: 'courseId', message: 'Name a course of this institute' }]);
    }
  }

  /**
   * An ingestion state, audited: started (processing), succeeded (chunked: counts and the parser and
   * chunker), failed (the code and the stage). Ids and counts only, never content.
   */
  private async recordState(
    versionId: string,
    to: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await this.audit.record({
      action: 'ai.knowledge.version.ingestion',
      resourceType: 'knowledge_version',
      resourceId: versionId,
      summary: `A knowledge version is now ${to}`,
      after: { status: to, ...details },
    });
  }
}

/** What a source's view needs: its documents counted, and its course's title. */
const SOURCE_INCLUDE = {
  _count: { select: { documents: true } },
  course: { select: { id: true, title: true } },
} as const;

/** An uploaded document's reference: its file's name and a part of its own, unique in its source. */
function uploadRef(fileName: string): string {
  const name = fileName
    .trim()
    .toLowerCase()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
  return `upload:${name || 'file'}:${randomUUID().slice(0, 8)}`;
}

/** Whether the database ended a transaction to break a deadlock (Prisma's P2034, or 40P01). */
function isDeadlock(error: unknown): boolean {
  const record = error as { code?: unknown; meta?: { code?: unknown }; message?: unknown } | null;
  return (
    record?.code === 'P2034' ||
    record?.meta?.code === '40P01' ||
    (typeof record?.message === 'string' && /deadlock detected/i.test(record.message))
  );
}

function closedSource(): ConflictError {
  return new ConflictError(
    'This knowledge source is archived: nothing in it changes or is drawn on again.',
    KNOWLEDGE_ERROR_CODES.SOURCE_ARCHIVED,
  );
}

function duplicateVersion(): ConflictError {
  return new ConflictError(
    'This content is already a version of the document.',
    KNOWLEDGE_ERROR_CODES.VERSION_DUPLICATE,
  );
}

type SourceRow = {
  id: string;
  name: string;
  description: string;
  type: KnowledgeSourceView['type'];
  audience: KnowledgeSourceView['audience'];
  courseId: string | null;
  dataClass: string;
  status: KnowledgeSourceView['status'];
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  _count: { documents: number };
  course: { id: string; title: string } | null;
};

function toSourceView(row: SourceRow): KnowledgeSourceView {
  return knowledgeSourceViewSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    audience: row.audience,
    courseId: row.courseId,
    course: row.course,
    dataClass: row.dataClass,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    documentCount: row._count.documents,
  });
}

type VersionRow = {
  id: string;
  version: number;
  contentHash: string;
  characterCount: number;
  status: KnowledgeVersionView['status'];
  isCurrent: boolean;
  chunkCount: number;
  failureCode: string | null;
  parserVersion: string | null;
  chunkerVersion: string | null;
  createdAt: Date;
  chunkedAt: Date | null;
  file: { mime: string };
  /** Its embedding run under the active contract, if any (Phase 8C). */
  embeddings: {
    status: NonNullable<KnowledgeVersionView['embedding']>['status'];
    provider: string;
    model: string;
    dimension: number;
    embeddingVersion: string;
    embeddedCount: number;
    chunkCount: number;
    failureCode: string | null;
    embeddedAt: Date | null;
  }[];
};

function toVersionView(row: VersionRow): KnowledgeVersionView {
  return knowledgeVersionViewSchema.parse({
    id: row.id,
    version: row.version,
    format: formatOfMime(row.file.mime),
    contentHash: row.contentHash,
    characterCount: row.characterCount,
    status: row.status,
    isCurrent: row.isCurrent,
    chunkCount: row.chunkCount,
    failureCode: row.failureCode,
    parserVersion: row.parserVersion,
    chunkerVersion: row.chunkerVersion,
    createdAt: row.createdAt.toISOString(),
    chunkedAt: row.chunkedAt?.toISOString() ?? null,
    embedding: embeddingOf(row.embeddings[0]),
  });
}

function embeddingOf(run: VersionRow['embeddings'][number] | undefined) {
  if (!run) return null;
  return {
    status: run.status,
    provider: run.provider,
    model: run.model,
    dimension: run.dimension,
    embeddingVersion: run.embeddingVersion,
    embedded: run.embeddedCount,
    total: run.chunkCount,
    failureCode: run.failureCode,
    embeddedAt: run.embeddedAt?.toISOString() ?? null,
  };
}

function toDocumentView(row: {
  id: string;
  sourceId: string;
  title: string;
  canonicalRef: string;
  lessonId: string | null;
  lesson: { id: string; title: string; moduleId: string; module: { title: string } } | null;
  status: KnowledgeDocumentView['status'];
  createdAt: Date;
  versions: VersionRow[];
}): KnowledgeDocumentView {
  return knowledgeDocumentViewSchema.parse({
    id: row.id,
    sourceId: row.sourceId,
    title: row.title,
    canonicalRef: row.canonicalRef,
    lessonId: row.lessonId,
    lesson: row.lesson
      ? {
          id: row.lesson.id,
          title: row.lesson.title,
          moduleId: row.lesson.moduleId,
          moduleTitle: row.lesson.module.title,
        }
      : null,
    status: row.status,
    versions: row.versions.map(toVersionView),
    createdAt: row.createdAt.toISOString(),
  });
}
