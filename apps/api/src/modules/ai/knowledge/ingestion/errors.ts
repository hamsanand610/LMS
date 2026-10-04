import type { KnowledgeIngestionFailure } from '@lms/shared';

/**
 * Why an ingestion cannot go on (Phase 8B; ADR-0034), as the code the version records. The message
 * is for the server's own log and names no content.
 */
export class KnowledgeIngestionError extends Error {
  constructor(
    readonly code: KnowledgeIngestionFailure,
    detail: string,
  ) {
    super(detail);
    this.name = 'KnowledgeIngestionError';
  }
}

/** Failures that may pass: the queue tries the version again while it has retries left. */
export const TRANSIENT_INGESTION_FAILURES: ReadonlySet<KnowledgeIngestionFailure> = new Set([
  'storage_unavailable',
  'persist_failed',
]);
