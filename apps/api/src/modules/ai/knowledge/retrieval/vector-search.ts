import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../core/prisma/prisma.service.js';
import { vectorLiteral } from '../../providers/vectors.js';
import type { KnowledgeEmbeddingContract } from '../embedding/contract.js';
import type { RetrievalCandidate } from './selection.js';

/**
 * What a person may draw on, resolved on the server before any search (Phase 8D; ADR-0036): the
 * sources and lesson documents their reach allows (`KnowledgeReachService.reachOf`), the data
 * classes a retrieval may draw on, and the course or lesson they ask from, once checked. Never
 * anything a client sent.
 */
export interface RetrievalScope {
  organizationId: string;
  /** The published sources whose audience includes the person. */
  sourceIds: readonly string[];
  /** Documents of those sources about a lesson the person cannot open now. */
  closedDocumentIds: readonly string[];
  dataClasses: readonly string[];
  /** Asked from this course: its course material alone, beside the institute's and staff's. */
  courseId: string | null;
  /** Asked from this lesson: of the course's lesson documents, this lesson's alone. */
  lessonId: string | null;
}

/** A search's bounds: how many candidates, and how long the database may take. */
export interface SearchBounds {
  limit: number;
  timeoutMs: number;
}

/** What may be ranked at this moment, as the database finds it from the scope. */
interface Rankable {
  sources: string[];
  documents: string[];
  versions: string[];
}

/**
 * The knowledge base's similarity search (Phase 8D; ADR-0036), in one transaction with one snapshot
 * (repeatable read), so that what may be ranked and the ranking see the same state:
 *
 * 1. **What may be ranked, now.** From the scope, the database finds the sources that are published
 *    and of a data class a retrieval may draw on (and, asked from a course, that course's or none);
 *    the documents to leave out — inactive ones, those about a lesson the person cannot open, and,
 *    asked from a lesson, those about another lesson; and the versions to leave out — any not
 *    current and fully chunked that still has vectors.
 * 2. **The ranking**, on the vectors' table alone: the institute, the active embedding contract,
 *    those sources, none of those documents or versions — conditions on the rows themselves, before
 *    they are ranked, so a passage the person may not draw on is never a candidate, however close,
 *    and never pushes one they may out of the top K. On its own columns the planner sees what the
 *    scope holds: the HNSW index orders a broad scope, with pgvector's iterative scan so that
 *    filtering cannot starve it; a narrow one is ranked exactly. Then each candidate is joined to
 *    its chunk — kept only while its hash is the chunk's — and its provenance, in the order of
 *    distance and chunk id.
 *
 * Bounded by `statement_timeout`; nothing here sees what a client sent.
 */
@Injectable()
export class KnowledgeVectorSearch {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    scope: RetrievalScope,
    contract: KnowledgeEmbeddingContract,
    vector: readonly number[],
    bounds: SearchBounds,
  ): Promise<RetrievalCandidate[]> {
    if (scope.sourceIds.length === 0 || scope.dataClasses.length === 0) return [];
    const query = vectorLiteral(vector);
    const timeoutMs = Math.max(1, Math.floor(bounds.timeoutMs));
    const limit = Math.max(1, Math.floor(bounds.limit));
    const sources = [...scope.sourceIds];
    const course = scope.courseId
      ? Prisma.sql`AND (s.audience <> 'course' OR s.course_id = ${scope.courseId}::uuid)`
      : Prisma.empty;
    const lesson = scope.lessonId
      ? Prisma.sql`OR (d.lesson_id IS NOT NULL AND d.lesson_id <> ${scope.lessonId}::uuid)`
      : Prisma.empty;
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          SELECT set_config('statement_timeout', ${String(timeoutMs)}, true),
                 set_config('hnsw.iterative_scan', 'relaxed_order', true),
                 set_config('hnsw.ef_search', ${String(Math.max(40, limit))}, true)`;
        const [rankable] = await tx.$queryRaw<Rankable[]>`
          SELECT
            ARRAY(
              SELECT s.id::text FROM knowledge_sources s
              WHERE s.id = ANY(${sources}::uuid[])
                AND s.status = 'published'
                AND s.data_class = ANY(${[...scope.dataClasses]}::text[])
                ${course}
            ) AS sources,
            ARRAY(
              SELECT d.id::text FROM knowledge_documents d
              WHERE d.source_id = ANY(${sources}::uuid[])
                AND (d.status <> 'active'
                     OR d.id = ANY(${[...scope.closedDocumentIds]}::uuid[])
                     ${lesson})
            ) AS documents,
            ARRAY(
              SELECT v.id::text FROM knowledge_document_versions v
              WHERE v.source_id = ANY(${sources}::uuid[])
                AND NOT (v.is_current AND v.status = 'chunked')
                AND EXISTS (SELECT 1 FROM knowledge_chunk_embeddings x WHERE x.version_id = v.id)
            ) AS versions`;
        if (!rankable || rankable.sources.length === 0) return [];
        return tx.$queryRaw<RetrievalCandidate[]>`
          WITH ranked AS MATERIALIZED (
            SELECT e.chunk_id, e.source_id, e.document_id, e.version_id, e.content_hash,
                   e.embedding <=> ${query}::vector AS distance
            FROM knowledge_chunk_embeddings e
            WHERE e.organization_id = ${scope.organizationId}::uuid
              AND e.provider = ${contract.provider}
              AND e.model = ${contract.model}
              AND e.dimension = ${contract.dimension}
              AND e.embedding_version = ${contract.embeddingVersion}
              AND e.source_id = ANY(${rankable.sources}::uuid[])
              AND NOT (e.document_id = ANY(${rankable.documents}::uuid[]))
              AND NOT (e.version_id = ANY(${rankable.versions}::uuid[]))
            ORDER BY distance
            LIMIT ${limit}
          )
          SELECT r.chunk_id::text AS "chunkId", r.source_id::text AS "sourceId",
                 r.document_id::text AS "documentId", r.version_id::text AS "versionId",
                 v.version AS "versionNumber", c.position, c.heading, c.content,
                 c.content_hash AS "contentHash", v.parser_version AS "parserVersion",
                 v.chunker_version AS "chunkerVersion", d.title, d.canonical_ref AS "canonicalRef",
                 d.lesson_id::text AS "lessonId", s.name AS "sourceName",
                 s.audience::text AS audience, s.course_id::text AS "courseId",
                 s.data_class AS "dataClass", r.distance
          FROM ranked r
          JOIN knowledge_chunks c ON c.id = r.chunk_id AND c.content_hash = r.content_hash
          JOIN knowledge_document_versions v ON v.id = r.version_id
          JOIN knowledge_documents d ON d.id = r.document_id
          JOIN knowledge_sources s ON s.id = r.source_id
          ORDER BY r.distance, r.chunk_id`;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: timeoutMs + 2_000,
      },
    );
  }
}

/** Whether a database error is PostgreSQL ending a statement at its `statement_timeout`. */
export function isStatementTimeout(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const record = current as {
      code?: unknown;
      meta?: { code?: unknown };
      message?: unknown;
      cause?: unknown;
    };
    if (record.code === '57014' || record.meta?.code === '57014') return true;
    if (typeof record.message === 'string' && /statement timeout/i.test(record.message)) {
      return true;
    }
    current = record.cause;
  }
  return false;
}
