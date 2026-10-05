import type { KnowledgeRetrievalResult } from '@lms/shared';
import { describe, expect, it } from 'vitest';
import { FAKE_EMBEDDING_MODEL } from '../../providers/fake.provider.js';
import {
  KNOWLEDGE_ANSWER_LIMITS,
  KNOWLEDGE_EVIDENCE_FLOORS,
  evidenceFloorFor,
  packEvidence,
} from './evidence.js';

const id = (n: number, prefix = '0000') =>
  `00000000-0000-4000-8000-${prefix}${String(n).padStart(8, '0')}`;

function result(
  n: number,
  overrides: Partial<KnowledgeRetrievalResult> = {},
): KnowledgeRetrievalResult {
  return {
    chunkId: id(n),
    position: 0,
    heading: `Part ${n}`,
    content: `Passage ${n} explains something.`,
    contentHash: n.toString(16).padStart(64, '0'),
    similarity: 0.9 - n / 100,
    source: {
      id: id(n, '0001'),
      name: 'Notes',
      audience: 'institute',
      courseId: null,
      dataClass: 'public',
    },
    document: {
      id: id(n, '0002'),
      title: `Document ${n}`,
      canonicalRef: `ref:${n}`,
      lessonId: null,
    },
    version: { id: id(n, '0003'), number: 1, parserVersion: 'markdown-1', chunkerVersion: 'c' },
    ...overrides,
  };
}

const policy = { floor: 0.5, approved: ['public', 'course'] };

/** The evidence an answer may be given (Phase 8E; ADR-0037): only ever less than retrieval returned. */
describe('packEvidence', () => {
  it('keeps retrieval’s order and gives each passage the next citation id', () => {
    const { packed, withheld } = packEvidence([result(1), result(2), result(3)], policy);
    expect(packed.map((passage) => [passage.id, passage.result.chunkId])).toEqual([
      ['S1', id(1)],
      ['S2', id(2)],
      ['S3', id(3)],
    ]);
    expect(packed[0]).toMatchObject({ source: 'Notes', document: 'Document 1', heading: 'Part 1' });
    expect(withheld).toEqual({ belowFloor: 0, unapproved: 0, restricted: 0, overBudget: 0 });
  });

  it('withholds what is not evidence, may not be sent, holds a credential, or is past its bounds', () => {
    const { packed, withheld } = packEvidence(
      [
        result(1),
        result(2, { similarity: 0.49 }),
        result(3, { source: { ...result(3).source, dataClass: 'personal' } }),
        result(4, { content: `Sign in with ghp_${'A'.repeat(36)} today.` }),
        result(5),
      ],
      policy,
    );
    expect(packed.map((passage) => passage.result.chunkId)).toEqual([id(1), id(5)]);
    expect(packed.map((passage) => passage.id)).toEqual(['S1', 'S2']);
    expect(withheld).toEqual({ belowFloor: 1, unapproved: 1, restricted: 1, overBudget: 0 });
  });

  it('reads a credential wherever the model would be given it: the source’s name, the title, the heading (8F)', () => {
    const key = `ghp_${'B'.repeat(36)}`;
    const { packed, withheld } = packEvidence(
      [
        result(1, { source: { ...result(1).source, name: `Keys ${key}` } }),
        result(2, { document: { ...result(2).document, title: `Deploy with ${key}` } }),
        result(3, { heading: `Token ${key}` }),
        result(4),
      ],
      policy,
    );
    expect(packed.map((passage) => passage.result.chunkId)).toEqual([id(4)]);
    expect(withheld.restricted).toBe(3);
  });

  it('stops at its number of passages and its size, keeping the best', () => {
    const many = Array.from({ length: 9 }, (_, n) => result(n + 1));
    const counted = packEvidence(many, policy);
    expect(counted.packed).toHaveLength(KNOWLEDGE_ANSWER_LIMITS.passages);
    expect(counted.withheld.overBudget).toBe(9 - KNOWLEDGE_ANSWER_LIMITS.passages);

    const big = 'x'.repeat(5_000);
    const sized = packEvidence(
      [result(1, { content: big }), result(2, { content: big }), result(3, { content: big })],
      policy,
    );
    expect(sized.packed).toHaveLength(2);
    expect(sized.characters).toBe(10_000);
    expect(sized.withheld.overBudget).toBe(1);
  });

  it('is deterministic: the same retrieval, the same evidence', () => {
    const results = [result(1), result(2), result(3)];
    expect(packEvidence(results, policy)).toEqual(packEvidence(results, policy));
  });
});

describe('evidenceFloorFor', () => {
  it('takes the configured floor, else the one measured for the model, else none', () => {
    expect(evidenceFloorFor(FAKE_EMBEDDING_MODEL, 0.62)).toBe(0.62);
    expect(evidenceFloorFor(FAKE_EMBEDDING_MODEL, null)).toBe(
      KNOWLEDGE_EVIDENCE_FLOORS[FAKE_EMBEDDING_MODEL],
    );
    expect(evidenceFloorFor('gemini-embedding-001', null)).toBeNull();
    expect(evidenceFloorFor(null, null)).toBeNull();
  });
});
