import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  AI_ERROR_CODES,
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  KNOWLEDGE_ERROR_CODES,
  KNOWLEDGE_SOURCE_STATUSES,
  KNOWLEDGE_VERSION_STATUSES,
  type KnowledgeDocumentCreate,
  type KnowledgeDocumentView,
  type KnowledgeSourceCreate,
  type KnowledgeSourceDetail,
  type KnowledgeSourceUpdate,
  type KnowledgeSourceView,
  type KnowledgeStatus,
  type KnowledgeVersionCreate,
  type KnowledgeVersionView,
  knowledgeDocumentViewSchema,
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
import { estimateTokens } from '../usage/cost.js';
import { knowledgeContentHash, normaliseKnowledgeText } from './content-hash.js';
import { VectorReadinessService } from './vector-readiness.js';

/** What a chunk is made of, as ingestion hands it over (Phase 8B cuts them; 8A only records). */
export interface KnowledgeChunkInput {
  heading?: string;
  content: string;
}

/** The file owner type of a version's stored content: institution material, no person's upload. */
export const KNOWLEDGE_FILE_OWNER = 'knowledge-version';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenant: TenantService,
    private readonly flags: FlagsService,
    private readonly vectors: VectorReadinessService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

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
      include: { _count: { select: { documents: true } } },
    });
    return rows.map(toSourceView);
  }

  async source(user: AuthUser, id: string): Promise<KnowledgeSourceDetail> {
    await this.assertOn(user);
    const row = await this.prisma.knowledgeSource.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        _count: { select: { documents: true } },
        documents: {
          orderBy: { createdAt: 'asc' },
          include: { versions: { orderBy: { version: 'asc' } } },
        },
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
      include: { _count: { select: { documents: true } } },
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
    if (courseId && courseId !== before.courseId) await this.requireCourse(user, courseId);
    const row = await this.prisma.knowledgeSource.update({
      where: { id: before.id },
      data: { ...input, courseId },
      include: { _count: { select: { documents: true } } },
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
    await this.prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { status: 'archived', archivedAt: new Date() },
    });
    await this.audit.record({
      action: 'ai.knowledge.source.archived',
      resourceType: 'knowledge_source',
      resourceId: source.id,
      summary: `Knowledge source "${source.name}" was archived`,
      before: { status: source.status },
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
    if (input.lessonId) {
      // A document about one lesson belongs to a course source, and to a lesson of its course.
      const lesson = source.courseId
        ? await this.prisma.lesson.findFirst({
            where: { id: input.lessonId, module: { courseId: source.courseId } },
            select: { id: true },
          })
        : null;
      if (!lesson) {
        throw new ValidationError([
          { path: 'lessonId', message: 'Name a lesson of the source’s own course' },
        ]);
      }
    }
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
      include: { versions: true },
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
   * driver as a private file of the institute's. The same content as an earlier version is refused.
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
    const content = normaliseKnowledgeText(input.content);
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
    // A key of its own per attempt: two people adding the same content at once never share one.
    const key = `${org.key}/knowledge/${document.id}/${randomUUID()}.md`;
    // Storage first: should the record fail, this attempt's object is removed again below.
    await this.storage.put('private', key, bytes, 'text/markdown');
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
            originalName: `${document.canonicalRef.replace(/[^\w.-]+/g, '-').slice(0, 200)}.md`,
            mime: 'text/markdown',
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
          contentHash,
          characters: content.length,
        },
      });
      return toVersionView(version);
    } catch (error) {
      await this.storage.delete('private', key).catch(() => undefined);
      if ((error as { code?: string }).code === 'P2002') throw duplicateVersion();
      throw error;
    }
  }

  // ───────────────────────── ingestion states (the contract for Phase 8B) ─────────────────────────

  /**
   * Takes a version for ingestion: pending (or failed, to try again) → processing, by one caller
   * only. False when another has it, or it is done.
   */
  async claimForIngestion(versionId: string): Promise<boolean> {
    const claimed = await this.prisma.knowledgeDocumentVersion.updateMany({
      where: { id: versionId, status: { in: ['pending', 'failed'] } },
      data: { status: 'processing', failureCode: null },
    });
    if (claimed.count === 1) await this.recordState(versionId, 'processing');
    return claimed.count === 1;
  }

  /**
   * Records a claimed version's chunks, in order, with their whole provenance and hashes, and marks
   * the version chunked. The newest chunked version of a document becomes its current one.
   */
  async recordChunks(versionId: string, chunks: readonly KnowledgeChunkInput[]): Promise<void> {
    const cleaned = chunks.map((chunk, position) => {
      const content = normaliseKnowledgeText(chunk.content);
      if (!content) {
        throw new ValidationError([{ path: `chunks.${position}`, message: 'A chunk has text' }]);
      }
      return {
        position,
        heading: (chunk.heading ?? '').trim().slice(0, HEADING_MAX),
        content,
        contentHash: knowledgeContentHash(content),
        characterCount: content.length,
        tokenEstimate: estimateTokens(content.length),
      };
    });
    if (cleaned.length === 0) {
      throw new ValidationError([{ path: 'chunks', message: 'A version has at least one chunk' }]);
    }
    const summary = await this.prisma.$transaction(async (tx) => {
      const version = await tx.knowledgeDocumentVersion.findUnique({ where: { id: versionId } });
      if (!version) throw new NotFoundError('Knowledge version');
      if (version.status !== 'processing') {
        throw new DomainRuleError(
          'Only a version taken for ingestion has its chunks recorded.',
          'knowledge_version_not_processing',
        );
      }
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
      },
    });
    await this.recordState(versionId, 'chunked');
  }

  /** A claimed version that could not be ingested: failed, with a code — never its content. */
  async failIngestion(versionId: string, failureCode: string): Promise<void> {
    const failed = await this.prisma.knowledgeDocumentVersion.updateMany({
      where: { id: versionId, status: 'processing' },
      data: { status: 'failed', failureCode: failureCode.slice(0, 60) },
    });
    if (failed.count === 1) await this.recordState(versionId, 'failed');
  }

  // ───────────────────────── status ─────────────────────────

  /** Counts by state, and whether the database can hold vectors yet. Never any content. */
  async status(user: AuthUser): Promise<KnowledgeStatus> {
    await this.assertOn(user);
    const organizationId = user.organizationId;
    const [sources, versions, chunks, vector] = await Promise.all([
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
      include: { _count: { select: { documents: true } } },
    });
    return toSourceView(row);
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

  private async recordState(versionId: string, to: string): Promise<void> {
    await this.audit.record({
      action: 'ai.knowledge.version.ingestion',
      resourceType: 'knowledge_version',
      resourceId: versionId,
      summary: `A knowledge version is now ${to}`,
      after: { status: to },
    });
  }
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
};

function toSourceView(row: SourceRow): KnowledgeSourceView {
  return knowledgeSourceViewSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    audience: row.audience,
    courseId: row.courseId,
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
  createdAt: Date;
  chunkedAt: Date | null;
};

function toVersionView(row: VersionRow): KnowledgeVersionView {
  return knowledgeVersionViewSchema.parse({
    id: row.id,
    version: row.version,
    contentHash: row.contentHash,
    characterCount: row.characterCount,
    status: row.status,
    isCurrent: row.isCurrent,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt.toISOString(),
    chunkedAt: row.chunkedAt?.toISOString() ?? null,
  });
}

function toDocumentView(row: {
  id: string;
  sourceId: string;
  title: string;
  canonicalRef: string;
  lessonId: string | null;
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
    status: row.status,
    versions: row.versions.map(toVersionView),
    createdAt: row.createdAt.toISOString(),
  });
}
