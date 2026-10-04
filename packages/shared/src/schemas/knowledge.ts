import { z } from 'zod';
import { AI_APPROVABLE_DATA_CLASSES } from './ai.js';
import { patchSchemaOf } from './common.js';

/**
 * SI Academy AI's knowledge base — the contracts the API and its clients share (Roadmap Phase 8A;
 * ADR-0033). A source holds documents, a document has versions, a version is cut into chunks; who
 * may later draw on them is decided on the server (`KnowledgeReachService`), never by a client.
 * Nothing here retrieves, embeds or answers: those are Phases 8C to 8E.
 */

/** The option flag over the knowledge base's management, beside `module.ai`. Off by default. */
export const AI_KNOWLEDGE_FLAG = 'ai.knowledge';

export const KNOWLEDGE_SOURCE_TYPES = ['authored', 'uploaded', 'course'] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

/**
 * Who may draw on a published source: everyone in the institute who may ask SI Academy AI, staff
 * alone (never a learner), or the people the source's course reaches.
 */
export const KNOWLEDGE_AUDIENCES = ['institute', 'staff', 'course'] as const;
export type KnowledgeAudience = (typeof KNOWLEDGE_AUDIENCES)[number];

export const KNOWLEDGE_SOURCE_STATUSES = ['draft', 'published', 'archived'] as const;
export type KnowledgeSourceStatus = (typeof KNOWLEDGE_SOURCE_STATUSES)[number];

export const KNOWLEDGE_DOCUMENT_STATUSES = ['active', 'archived'] as const;
export const KNOWLEDGE_VERSION_STATUSES = ['pending', 'processing', 'chunked', 'failed'] as const;
export type KnowledgeVersionStatus = (typeof KNOWLEDGE_VERSION_STATUSES)[number];

/** The knowledge base's own refusals, beside the platform's. */
export const KNOWLEDGE_ERROR_CODES = {
  /** An archived source is closed for good: nothing is published, added or changed in it. */
  SOURCE_ARCHIVED: 'knowledge_source_archived',
  /** Who a source is for, and what it holds, are settled before it is published. */
  SOURCE_PUBLISHED: 'knowledge_source_published',
  /** The source is already published. */
  ALREADY_PUBLISHED: 'knowledge_source_already_published',
  /** A document with this reference is already in the source. */
  DOCUMENT_EXISTS: 'knowledge_document_exists',
  /** This content is already a version of the document. */
  VERSION_DUPLICATE: 'knowledge_version_duplicate',
  /** The version is already chunked: there is nothing left to ingest (Phase 8B). */
  VERSION_CHUNKED: 'knowledge_version_chunked',
  /** An ingestion holds the version now (Phase 8B). */
  INGESTION_RUNNING: 'knowledge_ingestion_running',
  /** A newer version of the document is already the current one (Phase 8B). */
  VERSION_STALE: 'knowledge_version_stale',
  /** Documents of this source are about lessons of its course, so its course stays (Phase 8B). */
  LESSON_DOCUMENTS: 'knowledge_source_has_lesson_documents',
  /** No provider and model can embed on this installation (Phase 8C). */
  EMBEDDINGS_UNAVAILABLE: 'knowledge_embeddings_unavailable',
  /** The version may not be embedded: not the current chunked version of a published source of
   * data the provider may be given (Phase 8C). */
  NOT_EMBEDDABLE: 'knowledge_version_not_embeddable',
  /** An embedding run holds the version now (Phase 8C). */
  EMBEDDING_RUNNING: 'knowledge_embedding_running',
  /** Every chunk of the version is embedded under the active contract (Phase 8C). */
  VERSION_EMBEDDED: 'knowledge_version_embedded',
} as const;

/**
 * The dimension of every stored embedding (Phase 8C; ADR-0035): the schema's `vector(768)`. The
 * configuration must name it (`AI_EMBEDDING_DIMENSION`) or the API refuses to start; another
 * dimension is a new migration, never a setting.
 */
export const KNOWLEDGE_EMBEDDING_DIMENSION = 768;

/**
 * The version of how a chunk is embedded — what text is sent, with which task, and how the vector
 * is kept (normalised to unit length). Bumped whenever that changes for the same chunk and model:
 * embeddings of another version are never drawn on (Phase 8C; ADR-0035).
 */
export const KNOWLEDGE_EMBEDDING_VERSION = 'embed-1';

/** A version's embedding run, under one embedding contract (Phase 8C). */
export const KNOWLEDGE_EMBEDDING_STATUSES = ['pending', 'embedding', 'embedded', 'failed'] as const;
export type KnowledgeEmbeddingStatus = (typeof KNOWLEDGE_EMBEDDING_STATUSES)[number];

/**
 * Why an embedding run failed, as the run records it (Phase 8C; ADR-0035): a code, never content.
 * `provider_unavailable`, `provider_rate_limited`, `provider_timeout` and `persist_failed` may
 * pass, and the queue tries again; every other code holds until the cause is fixed and the
 * embedding is asked for again.
 */
export const KNOWLEDGE_EMBEDDING_FAILURES = [
  'not_chunked',
  'not_current',
  'not_published',
  'source_archived',
  'document_archived',
  'data_class_held_back',
  'data_class_not_approved',
  'embeddings_unavailable',
  'budget_exceeded',
  'unpriced_model',
  'provider_unavailable',
  'provider_rate_limited',
  'provider_timeout',
  'provider_auth',
  'provider_configuration',
  'provider_bad_request',
  'provider_malformed',
  'wrong_dimension',
  'invalid_vector',
  'persist_failed',
  'processing_timeout',
  'incomplete',
] as const;
export type KnowledgeEmbeddingFailure = (typeof KNOWLEDGE_EMBEDDING_FAILURES)[number];

/**
 * The longest source one version may be given, markup included (Phase 8B; 200,000 in 8A, when only
 * authored text was taken). Well inside the API's 1 MB request limit.
 */
export const KNOWLEDGE_VERSION_MAX_CHARACTERS = 500_000;

/** The longest text ingestion takes from one version, once its markup is gone (Phase 8B). */
export const KNOWLEDGE_TEXT_MAX_CHARACTERS = 200_000;

/**
 * The formats a version's content may be written in (Phase 8B; ADR-0034). PDF is not among them:
 * the platform has no engine that reads text out of a PDF, and 8B adds none.
 */
export const KNOWLEDGE_VERSION_FORMATS = ['markdown', 'text', 'html'] as const;
export type KnowledgeVersionFormat = (typeof KNOWLEDGE_VERSION_FORMATS)[number];

/** How each format is stored, by its media type. */
export const KNOWLEDGE_FORMAT_MIME: Record<KnowledgeVersionFormat, string> = {
  markdown: 'text/markdown',
  text: 'text/plain',
  html: 'text/html',
};

/**
 * Why an ingestion failed, as the version records it (Phase 8B; ADR-0034): a code, never the
 * content. `storage_unavailable` and `persist_failed` may pass, and the queue tries again; every
 * other code holds until the version is fixed or replaced.
 */
export const KNOWLEDGE_INGESTION_FAILURES = [
  'unsupported_format',
  'missing_file',
  'file_mismatch',
  'checksum_mismatch',
  'source_too_large',
  'malformed_content',
  'parser_failed',
  'empty_content',
  'content_too_large',
  'chunking_failed',
  'too_many_chunks',
  'storage_unavailable',
  'persist_failed',
  'source_archived',
  'document_archived',
  'document_mismatch',
  'stale_version',
  'processing_timeout',
] as const;
export type KnowledgeIngestionFailure = (typeof KNOWLEDGE_INGESTION_FAILURES)[number];

const uuid = z.uuid();

/** A new source. A course-audience source names its course; no other audience does. */
export const knowledgeSourceCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).default(''),
    type: z.enum(KNOWLEDGE_SOURCE_TYPES),
    audience: z.enum(KNOWLEDGE_AUDIENCES),
    courseId: uuid.nullable().default(null),
    dataClass: z.enum(AI_APPROVABLE_DATA_CLASSES),
  })
  .strict()
  .refine((value) => (value.audience === 'course') === (value.courseId !== null), {
    path: ['courseId'],
    message: 'A course audience needs its course; any other audience needs none',
  });
export type KnowledgeSourceCreate = z.infer<typeof knowledgeSourceCreateSchema>;

/**
 * A change to a source. Its name and description change at any time; who it is for and what it
 * holds only while it is a draft.
 */
export const knowledgeSourceUpdateSchema = patchSchemaOf(
  z
    .object({
      name: z.string().trim().min(2).max(160),
      description: z.string().trim().max(2000),
      audience: z.enum(KNOWLEDGE_AUDIENCES),
      courseId: uuid.nullable(),
      dataClass: z.enum(AI_APPROVABLE_DATA_CLASSES),
    })
    .strict(),
).strict();
export type KnowledgeSourceUpdate = z.infer<typeof knowledgeSourceUpdateSchema>;

/** A new document in a source. Its reference is its identity there: unique within the source. */
export const knowledgeDocumentCreateSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    canonicalRef: z
      .string()
      .trim()
      .min(1)
      .max(400)
      .regex(/^[\w.:/@-]+$/, 'Letters, digits and . : / @ - _ only'),
    lessonId: uuid.nullable().default(null),
  })
  .strict();
export type KnowledgeDocumentCreate = z.infer<typeof knowledgeDocumentCreateSchema>;

/**
 * A new version of a document: its content, stored through the platform's storage driver, in one of
 * the formats ingestion reads (Markdown when none is named, as in Phase 8A).
 */
export const knowledgeVersionCreateSchema = z
  .object({
    content: z
      .string()
      .min(1)
      .max(KNOWLEDGE_VERSION_MAX_CHARACTERS)
      .refine((value) => value.trim().length > 0, 'Write the content'),
    format: z.enum(KNOWLEDGE_VERSION_FORMATS).default('markdown'),
  })
  .strict();
export type KnowledgeVersionCreate = z.infer<typeof knowledgeVersionCreateSchema>;

export const knowledgeVersionViewSchema = z
  .object({
    id: uuid,
    version: z.number().int().min(1),
    /** The format its content is stored in; null for a type ingestion does not read. */
    format: z.enum(KNOWLEDGE_VERSION_FORMATS).nullable(),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    characterCount: z.number().int().min(0),
    status: z.enum(KNOWLEDGE_VERSION_STATUSES),
    isCurrent: z.boolean(),
    chunkCount: z.number().int().min(0),
    /** Why the last ingestion failed: a code (`KNOWLEDGE_INGESTION_FAILURES`), never the content. */
    failureCode: z.string().max(60).nullable(),
    parserVersion: z.string().nullable(),
    chunkerVersion: z.string().nullable(),
    createdAt: z.iso.datetime(),
    chunkedAt: z.iso.datetime().nullable(),
    /** Its embedding under the active contract (Phase 8C); null when none was asked for. */
    embedding: z
      .object({
        status: z.enum(KNOWLEDGE_EMBEDDING_STATUSES),
        provider: z.string(),
        model: z.string(),
        dimension: z.number().int().min(1),
        embeddingVersion: z.string(),
        /** Chunks with a valid embedding, of `total`. */
        embedded: z.number().int().min(0),
        total: z.number().int().min(0),
        /** Why the last run failed: a code (`KNOWLEDGE_EMBEDDING_FAILURES`), never content. */
        failureCode: z.string().max(60).nullable(),
        embeddedAt: z.iso.datetime().nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type KnowledgeVersionView = z.infer<typeof knowledgeVersionViewSchema>;

/** The payload of a knowledge job (`ai.knowledge.ingest`, `ai.knowledge.embed`): an id, nothing else. */
export const knowledgeVersionJobSchema = z.object({ versionId: uuid }).strict();
export type KnowledgeVersionJob = z.infer<typeof knowledgeVersionJobSchema>;

export const knowledgeDocumentViewSchema = z
  .object({
    id: uuid,
    sourceId: uuid,
    title: z.string(),
    canonicalRef: z.string(),
    lessonId: uuid.nullable(),
    status: z.enum(KNOWLEDGE_DOCUMENT_STATUSES),
    versions: z.array(knowledgeVersionViewSchema),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type KnowledgeDocumentView = z.infer<typeof knowledgeDocumentViewSchema>;

export const knowledgeSourceViewSchema = z
  .object({
    id: uuid,
    name: z.string(),
    description: z.string(),
    type: z.enum(KNOWLEDGE_SOURCE_TYPES),
    audience: z.enum(KNOWLEDGE_AUDIENCES),
    courseId: uuid.nullable(),
    dataClass: z.enum(AI_APPROVABLE_DATA_CLASSES),
    status: z.enum(KNOWLEDGE_SOURCE_STATUSES),
    publishedAt: z.iso.datetime().nullable(),
    archivedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    documentCount: z.number().int().min(0),
  })
  .strict();
export type KnowledgeSourceView = z.infer<typeof knowledgeSourceViewSchema>;

export const knowledgeSourceDetailSchema = knowledgeSourceViewSchema
  .extend({ documents: z.array(knowledgeDocumentViewSchema) })
  .strict();
export type KnowledgeSourceDetail = z.infer<typeof knowledgeSourceDetailSchema>;

/**
 * Where the knowledge base stands, for the people who manage it: counts by state, and whether the
 * database can hold vectors yet (ADR-0026). Never any content.
 */
export const knowledgeStatusSchema = z
  .object({
    sources: z.record(z.enum(KNOWLEDGE_SOURCE_STATUSES), z.number().int().min(0)),
    versions: z.record(z.enum(KNOWLEDGE_VERSION_STATUSES), z.number().int().min(0)),
    chunks: z.number().int().min(0),
    /** Chunks embedded under the active embedding contract (Phase 8C). */
    embeddings: z.number().int().min(0),
    vector: z
      .object({
        extension: z.literal('vector'),
        available: z.boolean(),
        installed: z.boolean(),
        version: z.string().nullable(),
      })
      .strict(),
  })
  .strict();
export type KnowledgeStatus = z.infer<typeof knowledgeStatusSchema>;
