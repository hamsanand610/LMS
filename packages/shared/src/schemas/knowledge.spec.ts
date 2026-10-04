import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_RETRIEVAL_QUERY_MAX,
  KNOWLEDGE_RETRIEVAL_TOP_K_DEFAULT,
  KNOWLEDGE_RETRIEVAL_TOP_K_MAX,
  knowledgeRetrievalResultSchema,
  knowledgeRetrieveRequestSchema,
} from './knowledge.js';

const ID = '01a1066b-235f-764e-bb8d-2b9825822266';

/** A retrieval's request names a question, a K and a context — nothing that decides reach (8D). */
describe('a knowledge retrieval request (Phase 8D)', () => {
  it('takes a question, trimmed, and five passages unless told otherwise', () => {
    expect(knowledgeRetrieveRequestSchema.parse({ query: '  What is a loop?  ' })).toEqual({
      query: 'What is a loop?',
      topK: KNOWLEDGE_RETRIEVAL_TOP_K_DEFAULT,
    });
    expect(
      knowledgeRetrieveRequestSchema.parse({
        query: 'loops',
        topK: 20,
        courseId: ID,
        lessonId: ID,
      }),
    ).toEqual({ query: 'loops', topK: 20, courseId: ID, lessonId: ID });
  });

  it('refuses a question too short or too long, and a K out of bounds', () => {
    for (const body of [
      {},
      { query: '' },
      { query: ' ab ' },
      { query: 'x'.repeat(KNOWLEDGE_RETRIEVAL_QUERY_MAX + 1) },
      { query: 'loops', topK: 0 },
      { query: 'loops', topK: KNOWLEDGE_RETRIEVAL_TOP_K_MAX + 1 },
      { query: 'loops', topK: 1.5 },
      { query: 'loops', topK: '3' },
      { query: 'loops', courseId: 'course-1' },
    ]) {
      expect(knowledgeRetrieveRequestSchema.safeParse(body).success, JSON.stringify(body)).toBe(
        false,
      );
    }
  });

  it('refuses every field that would let a client decide its own reach', () => {
    for (const field of [
      'instituteId',
      'organizationId',
      'archived',
      'unpublished',
      'dataClass',
      'audience',
      'sourceIds',
      'model',
      'vector',
      'embedding',
      'filter',
    ]) {
      expect(
        knowledgeRetrieveRequestSchema.safeParse({ query: 'loops', [field]: 'anything' }).success,
        field,
      ).toBe(false);
    }
  });

  it('answers with provenance alone: a result carries no vector, and nothing it does not name', () => {
    const result = {
      chunkId: ID,
      position: 0,
      heading: 'Loops',
      content: 'A loop repeats a block.',
      contentHash: 'a'.repeat(64),
      similarity: 0.91,
      source: { id: ID, name: 'Notes', audience: 'institute', courseId: null, dataClass: 'public' },
      document: { id: ID, title: 'Loops', canonicalRef: 'authored:loops', lessonId: null },
      version: { id: ID, number: 1, parserVersion: 'markdown-1', chunkerVersion: 'sections-1' },
    };
    expect(knowledgeRetrievalResultSchema.parse(result)).toEqual(result);
    expect(knowledgeRetrievalResultSchema.safeParse({ ...result, embedding: [0.1] }).success).toBe(
      false,
    );
    expect(knowledgeRetrievalResultSchema.safeParse({ ...result, similarity: 1.5 }).success).toBe(
      false,
    );
    expect(
      knowledgeRetrievalResultSchema.safeParse({
        ...result,
        source: { ...result.source, dataClass: 'restricted' },
      }).success,
    ).toBe(false);
  });
});
