/**
 * The knowledge base's background work (ADR-0033), as a contract for the slices that do it. Phase 8A
 * defines it and registers no handler: nothing is ingested or embedded yet.
 *
 * - **Ingest (Phase 8B)** takes a version that is `pending` by a claim in the database
 *   (`KnowledgeService.claimForIngestion`: pending or failed → processing, by one worker only),
 *   reads its content through the storage driver, cuts it into chunks and records them
 *   (`recordChunks`: processing → chunked, and the newest chunked version becomes the current one),
 *   or records why it could not (`failIngestion`: processing → failed, a code and never the content).
 * - **Embed (Phase 8C)** gives each chunk of a chunked version its embedding, in a table of its own
 *   beside `knowledge_chunks` (ADR-0026, ADR-0027).
 *
 * As for SI Academy AI's other jobs (Phase 7D), a payload carries ids alone, and the database's state
 * — never the queue's singleton keys — is what makes a job safe to repeat or to run twice at once.
 */
export const KNOWLEDGE_JOBS = {
  ingest: 'ai.knowledge.ingest',
  embed: 'ai.knowledge.embed',
} as const;

export interface KnowledgeVersionJob {
  versionId: string;
}
