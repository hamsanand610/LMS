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
} as const;

/** The longest content one version may hold in Phase 8A (authored text). */
export const KNOWLEDGE_VERSION_MAX_CHARACTERS = 200_000;

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

/** A new version of a document: its content, stored through the platform's storage driver. */
export const knowledgeVersionCreateSchema = z
  .object({
    content: z
      .string()
      .min(1)
      .max(KNOWLEDGE_VERSION_MAX_CHARACTERS)
      .refine((value) => value.trim().length > 0, 'Write the content'),
  })
  .strict();
export type KnowledgeVersionCreate = z.infer<typeof knowledgeVersionCreateSchema>;

export const knowledgeVersionViewSchema = z
  .object({
    id: uuid,
    version: z.number().int().min(1),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    characterCount: z.number().int().min(0),
    status: z.enum(KNOWLEDGE_VERSION_STATUSES),
    isCurrent: z.boolean(),
    chunkCount: z.number().int().min(0),
    createdAt: z.iso.datetime(),
    chunkedAt: z.iso.datetime().nullable(),
  })
  .strict();
export type KnowledgeVersionView = z.infer<typeof knowledgeVersionViewSchema>;

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
