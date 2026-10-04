import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_RETRIEVAL_LIMITS,
  type RetrievalCandidate,
  candidatesFor,
  selectPassages,
  similarityOf,
  toResult,
} from './selection.js';

const hash = (n: number) => n.toString(16).padStart(64, '0');

function candidate(n: number, overrides: Partial<RetrievalCandidate> = {}): RetrievalCandidate {
  return {
    chunkId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    sourceId: '00000000-0000-4000-8000-00000000aaaa',
    documentId: `00000000-0000-4000-8000-${String(1000 + n).padStart(12, '0')}`,
    versionId: `00000000-0000-4000-8000-${String(2000 + n).padStart(12, '0')}`,
    versionNumber: 1,
    position: 0,
    heading: `Part ${n}`,
    content: `Passage ${n}`,
    contentHash: hash(n),
    parserVersion: 'markdown-1',
    chunkerVersion: 'sections-1/1200-2000-200-200',
    title: `Document ${n}`,
    canonicalRef: `authored:${n}`,
    lessonId: null,
    sourceName: 'Notes',
    audience: 'institute',
    courseId: null,
    dataClass: 'public',
    distance: n / 100,
    ...overrides,
  };
}

const ids = (passages: RetrievalCandidate[]) => passages.map((p) => p.chunkId.slice(-2));

/** Selection after the search (Phase 8D; ADR-0036): order, ties, de-duplication, top-K. */
describe('selecting retrieved passages (Phase 8D)', () => {
  it('asks the search for enough candidates to fill K after de-duplication, and no more than 100', () => {
    expect(candidatesFor(1)).toBe(KNOWLEDGE_RETRIEVAL_LIMITS.candidatesPerResult);
    expect(candidatesFor(5)).toBe(20);
    expect(candidatesFor(20)).toBe(80);
    expect(candidatesFor(50)).toBe(KNOWLEDGE_RETRIEVAL_LIMITS.maxCandidates);
  });

  it('orders by distance, equal distances by chunk id, and stops at K', () => {
    const pool = [candidate(3), candidate(1), candidate(2, { distance: 0.01 }), candidate(4)];
    expect(ids(selectPassages(pool, 3))).toEqual(['01', '02', '03']);
    expect(ids(selectPassages(pool, 10))).toEqual(['01', '02', '03', '04']);
    // Whatever order they arrive in.
    expect(selectPassages([...pool].reverse(), 4)).toEqual(selectPassages(pool, 4));
    expect(pool.map((c) => c.chunkId.slice(-2))).toEqual(['03', '01', '02', '04']);
  });

  it('keeps one passage per chunk and one per text, the better-ranked', () => {
    const pool = [candidate(1), candidate(1), candidate(2, { contentHash: hash(1) }), candidate(3)];
    expect(ids(selectPassages(pool, 10))).toEqual(['01', '03']);
  });

  it('takes at most two passages of one document, then the next documents', () => {
    const one = '00000000-0000-4000-8000-00000000d0c1';
    const pool = [1, 2, 3, 4].map((n) => candidate(n, { documentId: one })).concat(candidate(5));
    const chosen = selectPassages(pool, 4);
    expect(ids(chosen)).toEqual(['01', '02', '05']);
    expect(chosen.filter((p) => p.documentId === one)).toHaveLength(
      KNOWLEDGE_RETRIEVAL_LIMITS.perDocument,
    );
  });

  it('answers with provenance and cosine similarity, and never a vector', () => {
    const result = toResult(candidate(7, { distance: 0.1234567, lessonId: null }));
    expect(result).toEqual({
      chunkId: candidate(7).chunkId,
      position: 0,
      heading: 'Part 7',
      content: 'Passage 7',
      contentHash: hash(7),
      similarity: 0.876543,
      source: {
        id: candidate(7).sourceId,
        name: 'Notes',
        audience: 'institute',
        courseId: null,
        dataClass: 'public',
      },
      document: {
        id: candidate(7).documentId,
        title: 'Document 7',
        canonicalRef: 'authored:7',
        lessonId: null,
      },
      version: {
        id: candidate(7).versionId,
        number: 1,
        parserVersion: 'markdown-1',
        chunkerVersion: 'sections-1/1200-2000-200-200',
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/distance|embedding|vector/);
    expect(similarityOf(0)).toBe(1);
    expect(similarityOf(2)).toBe(-1);
    expect(similarityOf(-0.0000001)).toBe(1);
  });
});
