import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../../core/prisma/prisma.service.js';
import { KnowledgeVectorSearch, type RetrievalScope, isStatementTimeout } from './vector-search.js';

const CONTRACT = {
  provider: 'fake' as const,
  model: 'fake-embedding-2',
  dimension: 768,
  embeddingVersion: 'embed-1',
};

const scope = (overrides: Partial<RetrievalScope> = {}): RetrievalScope => ({
  organizationId: '00000000-0000-4000-8000-000000000001',
  sourceIds: ['00000000-0000-4000-8000-00000000aaaa'],
  closedDocumentIds: [],
  dataClasses: ['public', 'course'],
  courseId: null,
  lessonId: null,
  ...overrides,
});

/** The search's own guards (Phase 8D; ADR-0036); its SQL is proved end to end against PostgreSQL. */
describe('KnowledgeVectorSearch', () => {
  it('searches nothing — no transaction, no statement — for a scope with no source or no data class', async () => {
    const $transaction = vi.fn();
    const search = new KnowledgeVectorSearch({ $transaction } as unknown as PrismaService);
    const vector = new Array<number>(768).fill(0);
    vector[0] = 1;
    const bounds = { limit: 20, timeoutMs: 1_000 };

    await expect(
      search.search(scope({ sourceIds: [] }), CONTRACT, vector, bounds),
    ).resolves.toEqual([]);
    await expect(
      search.search(scope({ dataClasses: [] }), CONTRACT, vector, bounds),
    ).resolves.toEqual([]);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('bounds the transaction by the time left, and reads one snapshot (repeatable read)', async () => {
    const $transaction = vi.fn().mockResolvedValue([]);
    const search = new KnowledgeVectorSearch({ $transaction } as unknown as PrismaService);
    const vector = new Array<number>(768).fill(0);
    vector[1] = 1;

    await search.search(scope(), CONTRACT, vector, { limit: 20, timeoutMs: 1_500.7 });

    expect($transaction).toHaveBeenCalledTimes(1);
    expect($transaction.mock.calls[0]![1]).toEqual({
      isolationLevel: 'RepeatableRead',
      timeout: 3_500,
    });
  });
});

describe('isStatementTimeout', () => {
  it("recognises PostgreSQL's statement timeout, however the driver wraps it", () => {
    expect(isStatementTimeout({ code: '57014' })).toBe(true);
    expect(isStatementTimeout({ meta: { code: '57014' } })).toBe(true);
    expect(isStatementTimeout(new Error('canceling statement due to statement timeout'))).toBe(
      true,
    );
    expect(isStatementTimeout(new Error('wrapped', { cause: { cause: { code: '57014' } } }))).toBe(
      true,
    );
  });

  it('is false for any other failure, and safe on a cycle', () => {
    const looped: { cause?: unknown; message: string } = { message: 'deadlock detected' };
    looped.cause = looped;
    expect(isStatementTimeout(looped)).toBe(false);
    expect(isStatementTimeout({ code: '40P01' })).toBe(false);
    expect(isStatementTimeout(new Error('connection refused'))).toBe(false);
    expect(isStatementTimeout(null)).toBe(false);
    expect(isStatementTimeout('statement timeout')).toBe(false);
  });
});
