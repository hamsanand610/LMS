import type {
  KnowledgeAudience,
  KnowledgeDocumentView,
  KnowledgeSourceStatus,
  KnowledgeVersionJob,
} from '@lms/shared';

/**
 * The knowledge base's background work (ADR-0033, ADR-0034), as a contract for the slices that do it.
 *
 * - **Ingest (Phase 8B, built)** takes a version by a claim in the database (pending, failed, or
 *   processing past its lease → processing, by one worker only), reads its content through the
 *   storage driver, checks it against its hash, reads its structure, cuts it into chunks and
 *   records them with the version marked chunked, in one transaction — or records why it could
 *   not, as a code, never the content. Parsing and chunking are steps of this one job.
 * - **Embed (Phase 8C, not built)** gives each chunk of a chunked version its embedding, in a table
 *   of its own beside `knowledge_chunks` (ADR-0026, ADR-0027), from `KnowledgeEmbeddingInput`
 *   alone: it never reads the version's file again.
 *
 * As for SI Academy AI's other jobs (Phase 7D), a payload carries an id alone
 * (`knowledgeVersionJobSchema`), and the database's state — never the queue's singleton keys — is
 * what makes a job safe to repeat or to run twice at once.
 */
export const KNOWLEDGE_JOBS = {
  ingest: 'ai.knowledge.ingest',
  embed: 'ai.knowledge.embed',
  /** Phase 10: a version ingested, then — while its source is published — embedded, on its own. */
  process: 'ai.knowledge.process',
} as const;

export type { KnowledgeVersionJob };

/**
 * One chunk as Phase 8B hands it to Phase 8C: everything an embedding needs, with no file to read
 * and nothing to parse again. Only chunks of a chunked version, of a source neither archived nor
 * holding data the provider may not be given (`RETRIEVABLE_DATA_CLASSES`), are handed over.
 */
export interface KnowledgeEmbeddingInput {
  chunkId: string;
  organizationId: string;
  sourceId: string;
  documentId: string;
  versionId: string;
  /** The chunk's place in its version, from 0. */
  position: number;
  /** The chunk's section, as its headings joined by `' > '`. */
  heading: string;
  /** The normalised text to embed. */
  content: string;
  contentHash: string;
  characterCount: number;
  tokenEstimate: number;
  parserVersion: string | null;
  chunkerVersion: string | null;
  document: Pick<KnowledgeDocumentView, 'title' | 'canonicalRef' | 'lessonId'>;
  /** What retrieval will filter by (Phase 8D); copied for 8C to record, never to decide. */
  visibility: {
    audience: KnowledgeAudience;
    courseId: string | null;
    dataClass: string;
    sourceStatus: KnowledgeSourceStatus;
    isCurrent: boolean;
  };
}
