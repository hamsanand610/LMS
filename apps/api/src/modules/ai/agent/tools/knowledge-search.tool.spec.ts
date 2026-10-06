import { describe, expect, it, vi } from 'vitest';
import { AI_ERROR_CODES, type KnowledgeRetrievalResult } from '@lms/shared';
import type { AppConfig } from '../../../../core/config/env.js';
import type { AuthUser } from '../../../../core/auth/auth-user.js';
import { ForbiddenError } from '../../../../core/http/errors.js';
import { AiQuotaExceededError, AiRestrictedContentError } from '../../ai-errors.js';
import {
  KnowledgeRetrievalForbiddenError,
  KnowledgeRetrievalTimeoutError,
  KnowledgeRetrievalUnavailableError,
} from '../../knowledge/retrieval/retrieval-errors.js';
import { FAKE_EMBEDDING_MODEL } from '../../providers/fake.provider.js';
import type { AgentToolContext } from './agent-tool.js';
import { KnowledgeSearchTool } from './knowledge-search.tool.js';

const uuid = (n: number) => `0190a0e4-7c1d-7b9e-8f00-${String(n).padStart(12, '0')}`;
const LESSON = uuid(1);
const COURSE = uuid(2);

const context = (changes: Partial<AgentToolContext> = {}): AgentToolContext => ({
  user: { id: uuid(9) } as AuthUser,
  studentId: uuid(8),
  conversationId: uuid(7),
  courseId: COURSE,
  lessonId: LESSON,
  ...changes,
});

function result(n: number, content: string, extra: Partial<KnowledgeRetrievalResult> = {}) {
  return {
    chunkId: uuid(100 + n),
    position: 0,
    heading: 'Section',
    content,
    contentHash: 'h'.repeat(64),
    similarity: 0.9,
    source: {
      id: uuid(200),
      name: 'Handbook',
      type: 'authored',
      audience: 'institute',
      dataClass: 'public',
      courseId: null,
    },
    document: { id: uuid(300 + n), title: `Doc ${n}`, lessonId: null },
    version: { id: uuid(400 + n), version: 1 },
    ...extra,
  } as unknown as KnowledgeRetrievalResult;
}

function toolWith(
  retrieve: (...args: unknown[]) => Promise<unknown>,
  options: { model?: string | null; floor?: number | null; approved?: string[] } = {},
) {
  const retrieval = { retrieve: vi.fn(retrieve) };
  const model = options.model === undefined ? FAKE_EMBEDDING_MODEL : options.model;
  const router = {
    embeddingRouting: () =>
      model ? { model: { provider: 'fake', id: model }, dimension: 768, batchSize: 16 } : null,
    approvedDataClasses: () => options.approved ?? ['public', 'course'],
  };
  const config = { AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY: options.floor ?? null } as AppConfig;
  return {
    tool: new KnowledgeSearchTool(retrieval as never, router as never, config),
    retrieval,
  };
}

const live = () => new AbortController().signal;
const found = (results: unknown[]) =>
  Promise.resolve({ results, topK: 6, context: { courseId: COURSE, lessonId: LESSON } });

describe('knowledge_search (Phase 9B; ADR-0039)', () => {
  it('declares a read-only, bounded search, switched on with the knowledge base', () => {
    const { tool } = toolWith(() => found([]));
    expect(tool).toMatchObject({
      name: 'knowledge_search',
      availableWith: ['ai.knowledge'],
      timeoutMs: 10_000,
      maxOutputCharacters: 12_000,
      availableInTimedTest: false,
      mutates: false,
    });
    for (const args of [{ query: 'loops', courseId: COURSE }, { query: 'lo' }, {}]) {
      expect(tool.input.safeParse(args).success, JSON.stringify(args)).toBe(false);
    }
  });

  it('searches as the learner, from the pinned lesson or course, six passages at most', async () => {
    const { tool, retrieval } = toolWith(() => found([]));
    const signal = live();
    await tool.run(context(), { query: 'loops' }, signal);
    await tool.run(context({ lessonId: null }), { query: 'loops' }, signal);
    await tool.run(context({ lessonId: null, courseId: null }), { query: 'loops' }, signal);
    expect(
      retrieval.retrieve.mock.calls.map(([user, input, given]) => [user, input, given]),
    ).toEqual([
      [context().user, { query: 'loops', topK: 6, lessonId: LESSON }, signal],
      [context().user, { query: 'loops', topK: 6, courseId: COURSE }, signal],
      [context().user, { query: 'loops', topK: 6 }, signal],
    ]);
  });

  it('keeps only evidence: above the floor, an approved class, no credential', async () => {
    const { tool } = toolWith(() =>
      found([
        result(1, 'Loops repeat their body.'),
        result(2, 'Too far from the question.', { similarity: 0.1 }),
        result(3, `Use gsk_${'g'.repeat(30)} to call it.`),
        result(4, 'Course material.', {
          source: { ...result(0, '').source, dataClass: 'course', courseId: COURSE },
        } as never),
        result(5, `Token ghp_${'A'.repeat(36)} here.`),
      ]),
    );
    const output = await tool.run(context(), { query: 'loops' }, live());
    expect(output.retrieved).toBe(5);
    expect(output.passages.map((passage) => [passage.chunkId, passage.dataClass])).toEqual([
      [uuid(101), 'public'],
      [uuid(104), 'course'],
    ]);
    expect(output.withheld).toBe(3);
    const publicOnly = toolWith(
      () =>
        found([
          result(4, 'Course.', {
            source: { ...result(0, '').source, dataClass: 'course' },
          } as never),
        ]),
      {
        approved: ['public'],
      },
    );
    expect((await publicOnly.tool.run(context(), { query: 'loops' }, live())).passages).toEqual([]);
  });

  it('is unavailable without an evidence floor for the embedding model', async () => {
    const { tool, retrieval } = toolWith(() => found([]), { model: 'unmeasured-model' });
    await expect(tool.run(context(), { query: 'loops' }, live())).rejects.toMatchObject({
      failure: 'unavailable',
      code: 'not_calibrated',
    });
    expect(retrieval.retrieve).not.toHaveBeenCalled();
    const configured = toolWith(() => found([]), { model: 'unmeasured-model', floor: 0.7 });
    await expect(configured.tool.run(context(), { query: 'loops' }, live())).resolves.toBeTruthy();
  });

  it('turns retrieval’s refusals into the registry’s terms', async () => {
    const cases: [Error, string, string][] = [
      [new KnowledgeRetrievalForbiddenError(), 'forbidden', 'context_forbidden'],
      [new ForbiddenError('timed test', AI_ERROR_CODES.NOT_ALLOWED), 'forbidden', 'timed_test'],
      [new ForbiddenError('off', AI_ERROR_CODES.FEATURE_DISABLED), 'unavailable', 'knowledge_off'],
      [new AiRestrictedContentError(), 'restricted', 'restricted_query'],
      [new AiQuotaExceededError('tokens'), 'quota', 'quota_tokens'],
      [new KnowledgeRetrievalTimeoutError(), 'timeout', 'retrieval_timeout'],
      [new KnowledgeRetrievalUnavailableError(), 'unavailable', 'retrieval_unavailable'],
    ];
    for (const [error, failure, code] of cases) {
      const { tool } = toolWith(() => Promise.reject(error));
      await expect(tool.run(context(), { query: 'loops' }, live()), code).rejects.toMatchObject({
        failure,
        code,
      });
    }
  });
});
