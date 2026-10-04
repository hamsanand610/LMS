import type { KnowledgeRetrievalResult } from '@lms/shared';

/** The limits that keep one retrieval bounded (Phase 8D; ADR-0036). */
export const KNOWLEDGE_RETRIEVAL_LIMITS = {
  /** The whole retrieval — the question's embedding and the search — within this. */
  deadlineMs: 10_000,
  /** Passages of one document at most, so that one long document cannot fill a retrieval. */
  perDocument: 2,
  /** Candidates the search returns per passage asked for, so that de-duplication can backfill. */
  candidatesPerResult: 4,
  /** And never more than this many. */
  maxCandidates: 100,
} as const;

/** A passage the search found within the person's reach, before selection: one row of it. */
export interface RetrievalCandidate {
  chunkId: string;
  sourceId: string;
  documentId: string;
  versionId: string;
  versionNumber: number;
  position: number;
  heading: string;
  content: string;
  contentHash: string;
  parserVersion: string | null;
  chunkerVersion: string | null;
  title: string;
  canonicalRef: string;
  lessonId: string | null;
  sourceName: string;
  audience: KnowledgeRetrievalResult['source']['audience'];
  courseId: string | null;
  dataClass: KnowledgeRetrievalResult['source']['dataClass'];
  /** Cosine distance to the question: 0 the same direction, 2 the opposite one. */
  distance: number;
}

/** How many candidates the search asks for, so that a top-K is still full after de-duplication. */
export function candidatesFor(topK: number): number {
  return Math.min(
    KNOWLEDGE_RETRIEVAL_LIMITS.maxCandidates,
    Math.max(topK, topK * KNOWLEDGE_RETRIEVAL_LIMITS.candidatesPerResult),
  );
}

/**
 * The passages a retrieval returns (ADR-0036): best first — the smallest distance, and between
 * equals the smaller chunk id, so the same question over the same knowledge always gives the same
 * order — skipping a chunk already chosen, a passage whose text (its hash) is already chosen from
 * another document or version, and a third passage of one document; then the first `topK`. Every
 * candidate is already within the person's reach: this only orders and thins, it never widens.
 */
export function selectPassages(
  candidates: readonly RetrievalCandidate[],
  topK: number,
): RetrievalCandidate[] {
  const ordered = [...candidates].sort(
    (a, b) =>
      a.distance - b.distance || (a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0),
  );
  const chunks = new Set<string>();
  const texts = new Set<string>();
  const perDocument = new Map<string, number>();
  const chosen: RetrievalCandidate[] = [];
  for (const candidate of ordered) {
    if (chosen.length === topK) break;
    if (chunks.has(candidate.chunkId) || texts.has(candidate.contentHash)) continue;
    const fromDocument = perDocument.get(candidate.documentId) ?? 0;
    if (fromDocument >= KNOWLEDGE_RETRIEVAL_LIMITS.perDocument) continue;
    chunks.add(candidate.chunkId);
    texts.add(candidate.contentHash);
    perDocument.set(candidate.documentId, fromDocument + 1);
    chosen.push(candidate);
  }
  return chosen;
}

/** A selected passage as the retrieval returns it: its provenance, never a vector. */
export function toResult(candidate: RetrievalCandidate): KnowledgeRetrievalResult {
  return {
    chunkId: candidate.chunkId,
    position: candidate.position,
    heading: candidate.heading,
    content: candidate.content,
    contentHash: candidate.contentHash,
    similarity: similarityOf(candidate.distance),
    source: {
      id: candidate.sourceId,
      name: candidate.sourceName,
      audience: candidate.audience,
      courseId: candidate.courseId,
      dataClass: candidate.dataClass,
    },
    document: {
      id: candidate.documentId,
      title: candidate.title,
      canonicalRef: candidate.canonicalRef,
      lessonId: candidate.lessonId,
    },
    version: {
      id: candidate.versionId,
      number: candidate.versionNumber,
      parserVersion: candidate.parserVersion,
      chunkerVersion: candidate.chunkerVersion,
    },
  };
}

/** Cosine similarity from cosine distance, to six places, within [-1, 1]. */
export function similarityOf(distance: number): number {
  const similarity = Math.round((1 - distance) * 1_000_000) / 1_000_000;
  return Math.min(1, Math.max(-1, similarity));
}
