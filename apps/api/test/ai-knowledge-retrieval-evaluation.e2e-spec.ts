import { writeFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  KNOWLEDGE_EMBEDDING_DIMENSION,
  KNOWLEDGE_EMBEDDING_VERSION,
  SYSTEM_ROLES,
  type KnowledgeRetrieval,
  type KnowledgeSourceView,
  type KnowledgeVersionView,
} from '@lms/shared';
import { AuthContextService } from '../src/core/auth/auth-context.service.js';
import type { AuthUser } from '../src/core/auth/auth-user.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../src/core/storage/storage.driver.js';
import { knowledgeContentHash } from '../src/modules/ai/knowledge/content-hash.js';
import { KnowledgeReachService } from '../src/modules/ai/knowledge/knowledge-reach.service.js';
import { FAKE_EMBEDDING_MODEL, fakeEmbedding } from '../src/modules/ai/providers/fake.provider.js';
import { hashPassword } from '../src/modules/auth/password.js';
import {
  EVALUATION_DOCUMENTS,
  EVALUATION_QUERIES,
  type EvaluationDocument,
  type EvaluationQuery,
} from './fixtures/knowledge-retrieval-corpus.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const AI_ENV = { AI_PROVIDER: 'fake', AI_DATA_CLASSES: 'public,course' };
const FLAGS = [AI_MODULE_FLAG, AI_KNOWLEDGE_FLAG];
const K = 5;

interface Outcome {
  query: EvaluationQuery;
  /** Which of the two learners asked it. */
  asker: number;
  ranked: { key: string | null; chunkId: string; similarity: number }[];
  ms: number;
}

/**
 * Phase 8D: how well retrieval finds what answers a question, measured on a synthetic corpus
 * (`fixtures/knowledge-retrieval-corpus.ts`) through the API, as a learner of one course would ask —
 * the fake provider's lexical vectors standing in for meaning. Recall@5, precision@1 and @5, the
 * mean reciprocal rank, the empty-result rate and the latency, by kind of question; and the measure
 * that matters most, which must be nought: passages returned that the person may not draw on.
 */
describe('SI Academy AI — knowledge retrieval, evaluated (Phase 8D)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageDriver;
  let admin: Session;
  let organizationId = '';
  let reach: KnowledgeReachService;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  /**
   * The corpus's own word, in every passage and question. Fixed, never of the run: the fake embeds
   * a word into one dimension picked by its hash, and a word of the run's would land, about one run
   * in four, on a dimension a corpus word uses — moving the similarities it touches from run to run.
   * This one shares no dimension with the corpus (checked below): every measure is the same each run.
   */
  const NONCE = 'evalcorpusnonce';
  let counter = 0;
  const chunkOf = new Map<string, string>();
  const keyOf = new Map<string, string>();
  const courses: Record<string, { id: string; lessons: string[] }> = {};
  /** Two learners alike — enrolled in course alpha alone — so the questions stay within the rate limit. */
  const learners: { session: Session; auth: AuthUser }[] = [];
  const outcomes: Outcome[] = [];

  async function addKnowledge(document: EvaluationDocument, text: string): Promise<string> {
    const placement = document.placement;
    const course = placement.kind === 'course' ? courses[placement.course]! : null;
    const source = expectStatus(
      await admin.post('/ai/knowledge/sources', {
        name: document.title,
        type: 'authored',
        audience: placement.kind === 'staff' ? 'staff' : course ? 'course' : 'institute',
        dataClass: course ? 'course' : 'public',
        ...(course ? { courseId: course.id } : {}),
      }),
      201,
    ).body as KnowledgeSourceView;
    const lessonId =
      placement.kind === 'course' && placement.lesson
        ? course!.lessons[placement.lesson === 'alpha-1' ? 0 : 1]
        : undefined;
    const documentId = (
      expectStatus(
        await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
          title: document.title,
          canonicalRef: `evaluation:${document.key}-${unique}`,
          ...(lessonId ? { lessonId } : {}),
        }),
        201,
      ).body as { id: string }
    ).id;
    const version = expectStatus(
      await admin.post(`/ai/knowledge/documents/${documentId}/versions`, {
        content: text,
        format: 'markdown',
      }),
      201,
    ).body as KnowledgeVersionView;
    expectStatus(await admin.post(`/ai/knowledge/versions/${version.id}/ingest`), 202);
    expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/publish`), 200);
    expectStatus(await admin.post(`/ai/knowledge/versions/${version.id}/embed`), 202);
    const [chunk] = await prisma.knowledgeChunk.findMany({ where: { versionId: version.id } });
    return chunk!.id;
  }

  /** A passage only the search's own conditions keep out: written straight to the database. */
  async function addOutOfReach(
    document: EvaluationDocument,
    text: string,
    orgB: string,
  ): Promise<string> {
    counter += 1;
    const placement = document.placement.kind;
    const org = placement === 'other-institute' ? orgB : organizationId;
    const source = await prisma.knowledgeSource.create({
      data: {
        organizationId: org,
        name: document.title,
        type: 'authored',
        audience: 'institute',
        dataClass: placement === 'personal' ? 'personal' : 'public',
        status:
          placement === 'draft' ? 'draft' : placement === 'archived' ? 'archived' : 'published',
        publishedAt: placement === 'draft' ? null : new Date(),
        archivedAt: placement === 'archived' ? new Date() : null,
      },
    });
    const doc = await prisma.knowledgeDocument.create({
      data: {
        organizationId: org,
        sourceId: source.id,
        title: document.title,
        canonicalRef: `evaluation:${document.key}-${unique}`,
      },
    });
    const hash = knowledgeContentHash(text);
    const file = await prisma.file.create({
      data: {
        organizationId: org,
        ownerType: 'knowledge-version',
        driver: storage.name,
        bucket: storage.bucketName('private'),
        key: `ai8d-eval/${doc.id}/${counter}.md`,
        originalName: 'evaluation.md',
        mime: 'text/markdown',
        size: text.length,
        checksum: hash,
        visibility: 'private',
        status: 'ready',
      },
    });
    const version = await prisma.knowledgeDocumentVersion.create({
      data: {
        organizationId: org,
        sourceId: source.id,
        documentId: doc.id,
        version: 1,
        contentHash: hash,
        fileId: file.id,
        characterCount: text.length,
        status: 'chunked',
        isCurrent: true,
        chunkCount: 1,
        chunkedAt: new Date(),
      },
    });
    const chunk = await prisma.knowledgeChunk.create({
      data: {
        organizationId: org,
        sourceId: source.id,
        documentId: doc.id,
        versionId: version.id,
        position: 0,
        content: text,
        contentHash: hash,
        characterCount: text.length,
        tokenEstimate: Math.ceil(text.length / 4),
      },
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO knowledge_chunk_embeddings
         (id, organization_id, source_id, document_id, version_id, chunk_id, content_hash,
          provider, model, dimension, embedding_version, embedding)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6,
               'fake', $7, $8, $9, $10::vector)`,
      org,
      source.id,
      doc.id,
      version.id,
      chunk.id,
      hash,
      FAKE_EMBEDDING_MODEL,
      KNOWLEDGE_EMBEDDING_DIMENSION,
      KNOWLEDGE_EMBEDDING_VERSION,
      `[${fakeEmbedding(text, KNOWLEDGE_EMBEDDING_DIMENSION).join(',')}]`,
    );
    return chunk.id;
  }

  async function course(label: string) {
    counter += 1;
    const row = await prisma.course.create({
      data: {
        organizationId,
        slug: `ai8d-eval-${label}-${counter}-${unique}`,
        title: `Evaluation ${label}`,
        status: 'published',
        modules: {
          create: [
            {
              title: `${label} basics`,
              position: 0,
              lessons: {
                create: [
                  {
                    title: `${label} 1`,
                    type: 'article',
                    position: 0,
                    content: { html: '<p>1</p>' },
                  },
                ],
              },
            },
            {
              title: `${label} further`,
              position: 1,
              unlockRule: { type: 'after_previous', minPercent: 100 },
              lessons: {
                create: [
                  {
                    title: `${label} 2`,
                    type: 'article',
                    position: 0,
                    content: { html: '<p>2</p>' },
                  },
                ],
              },
            },
          ],
        },
      },
      include: { modules: { orderBy: { position: 'asc' }, include: { lessons: true } } },
    });
    return { id: row.id, lessons: row.modules.map((module) => module.lessons[0]!.id) };
  }

  beforeAll(async () => {
    Object.assign(process.env, AI_ENV);
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storage = app.get<StorageDriver>(STORAGE_DRIVER);
    reach = app.get(KnowledgeReachService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    for (const key of FLAGS) {
      expectStatus(await admin.patch(`/flags/${key}`, { enabled: true }), 200);
    }
    courses['alpha'] = await course('alpha');
    courses['beta'] = await course('beta');
    const orgB = await prisma.organization.create({
      data: { key: `ai8d-eval-b-${unique}`, name: 'Institute B' },
    });
    for (const document of EVALUATION_DOCUMENTS) {
      const text = `${NONCE} ${document.text}`;
      const inReach = ['institute', 'staff', 'course'].includes(document.placement.kind);
      const chunkId = inReach
        ? await addKnowledge(document, text)
        : await addOutOfReach(document, text, orgB.id);
      chunkOf.set(document.key, chunkId);
      keyOf.set(chunkId, document.key);
    }

    // The learners: enrolled in course alpha alone, its second lesson still locked.
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    for (const n of [0, 1]) {
      const email = `ai8d-eval-${n}-${unique}@test.local`;
      const user = await prisma.user.create({
        data: {
          organizationId,
          email,
          name: `AI 8D evaluation ${n}`,
          passwordHash: await hashPassword(password),
          status: 'active',
          emailVerifiedAt: new Date(),
          roles: { create: [{ roleId: role.id }] },
          studentProfile: {
            create: { studentCode: `STU-AI8D-EVAL-${n}-${unique}`, status: 'active' },
          },
        },
        include: { studentProfile: true },
      });
      await prisma.enrollment.create({
        data: { studentId: user.studentProfile!.id, courseId: courses['alpha'].id },
      });
      const session = new Session(app);
      expectStatus(await session.login(email, password), 200);
      const auth = (await app.get(AuthContextService).load(user.id))!;
      learners.push({ session, auth: { ...auth, sessionId: '' } as AuthUser });
    }

    for (const [index, query] of EVALUATION_QUERIES.entries()) {
      const asker = index % learners.length;
      const context: Record<string, string> = {};
      if (query.context?.course) context['courseId'] = courses[query.context.course]!.id;
      if (query.context?.lesson) {
        context['lessonId'] =
          courses['alpha']!.lessons[query.context.lesson === 'alpha-1' ? 0 : 1]!;
      }
      const started = performance.now();
      const res = await learners[asker]!.session.post('/ai/knowledge/retrieve', {
        query: `${NONCE} ${query.query}`,
        topK: K,
        ...context,
      });
      const ms = performance.now() - started;
      const body = expectStatus(res, 200).body as KnowledgeRetrieval;
      outcomes.push({
        query,
        asker,
        ms,
        ranked: body.results.map((result) => ({
          key: keyOf.get(result.chunkId) ?? null,
          chunkId: result.chunkId,
          similarity: result.similarity,
        })),
      });
    }
  });
  afterAll(async () => {
    for (const key of FLAGS) {
      expectStatus(await admin.patch(`/flags/${key}`, { enabled: false }), 200);
    }
    await app.close();
    for (const key of Object.keys(AI_ENV)) delete process.env[key];
  });

  const ofKind = (...kinds: EvaluationQuery['kind'][]) =>
    outcomes.filter((outcome) => kinds.includes(outcome.query.kind));
  const rankOf = (outcome: Outcome) =>
    outcome.ranked.findIndex((r) => r.key !== null && outcome.query.relevant.includes(r.key)) + 1;
  const recallAt = (outcome: Outcome) => {
    const found = new Set(outcome.ranked.map((r) => r.key).filter((key) => key !== null));
    const wanted = outcome.query.kind === 'duplicate' ? 1 : outcome.query.relevant.length;
    const hits = outcome.query.relevant.filter((key) => found.has(key)).length;
    return Math.min(1, hits / wanted);
  };
  const mean = (values: number[]) =>
    values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
  const percentile = (values: number[], p: number) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
  };

  it('keeps every similarity the same in every run: its word shares no dimension with the corpus', () => {
    const nonce = fakeEmbedding(NONCE, KNOWLEDGE_EMBEDDING_DIMENSION).findIndex(
      (value) => value !== 0,
    );
    for (const text of [
      ...EVALUATION_DOCUMENTS.map((document) => document.text),
      ...EVALUATION_QUERIES.map((query) => query.query),
    ]) {
      expect(fakeEmbedding(text, KNOWLEDGE_EMBEDDING_DIMENSION)[nonce], text.slice(0, 60)).toBe(0);
    }
  });

  it('never returns a passage the person may not draw on: unauthorized results are nought', async () => {
    let unauthorized = 0;
    for (const outcome of outcomes) {
      for (const result of outcome.ranked) {
        if (!(await reach.mayRetrieve(learners[outcome.asker]!.auth, result.chunkId)))
          unauthorized += 1;
        if (outcome.query.forbidden?.includes(result.key ?? '')) unauthorized += 1;
      }
    }
    const forbiddenEverywhere = EVALUATION_DOCUMENTS.filter(
      (d) =>
        !['institute'].includes(d.placement.kind) &&
        !(
          d.placement.kind === 'course' &&
          d.placement.course === 'alpha' &&
          d.placement.lesson !== 'alpha-2'
        ),
    ).map((d) => chunkOf.get(d.key)!);
    for (const outcome of outcomes) {
      for (const result of outcome.ranked)
        expect(forbiddenEverywhere).not.toContain(result.chunkId);
    }
    expect(unauthorized).toBe(0);
  });

  it('finds what answers a question: recall, precision and rank by kind, and the latency', () => {
    const answered = ofKind('exact', 'paraphrase', 'multi-topic', 'course', 'lesson', 'duplicate');
    const summary = Object.fromEntries(
      (['exact', 'paraphrase', 'multi-topic', 'course', 'lesson', 'duplicate'] as const).map(
        (kind) => {
          const set = ofKind(kind);
          return [
            kind,
            {
              queries: set.length,
              recallAt5: mean(set.map(recallAt)),
              precisionAt1: mean(set.map((o) => (rankOf(o) === 1 ? 1 : 0))),
              precisionAt5: mean(
                set.map(
                  (o) =>
                    o.ranked.filter((r) => r.key !== null && o.query.relevant.includes(r.key))
                      .length / K,
                ),
              ),
              mrr: mean(set.map((o) => (rankOf(o) > 0 ? 1 / rankOf(o) : 0))),
            },
          ];
        },
      ),
    );
    const irrelevantTop = ofKind('irrelevant').map((o) => o.ranked[0]?.similarity ?? 0);
    const answeredTop = answered.map((o) => o.ranked[0]?.similarity ?? 0);
    const latencies = outcomes.map((o) => o.ms);
    const report = {
      queries: outcomes.length,
      byKind: summary,
      overall: {
        recallAt5: mean(answered.map(recallAt)),
        mrr: mean(answered.map((o) => (rankOf(o) > 0 ? 1 / rankOf(o) : 0))),
        emptyRate: mean(answered.map((o) => (o.ranked.length === 0 ? 1 : 0))),
      },
      irrelevant: {
        topSimilarityMax: Math.max(...irrelevantTop),
        answeredTopSimilarityMin: Math.min(...answeredTop),
      },
      latencyMs: {
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
        max: Math.max(...latencies),
      },
    };
    // The figures for the record, when asked for (LMS_RETRIEVAL_REPORT names the file).
    const reportPath = process.env['LMS_RETRIEVAL_REPORT'];
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Exact sentences: always first.
    expect(summary['exact']!.precisionAt1).toBe(1);
    // Paraphrases: found, and almost always first.
    expect(summary['paraphrase']!.recallAt5).toBeGreaterThanOrEqual(0.875);
    expect(summary['paraphrase']!.mrr).toBeGreaterThanOrEqual(0.75);
    // Both topics of a two-topic question within the five.
    expect(summary['multi-topic']!.recallAt5).toBe(1);
    // From a course, and from a lesson: their own passage first.
    expect(summary['course']!.precisionAt1).toBe(1);
    expect(summary['lesson']!.precisionAt1).toBe(1);
    // A passage written twice is returned once.
    for (const outcome of ofKind('duplicate')) {
      expect(
        outcome.ranked.filter((r) => outcome.query.relevant.includes(r.key ?? '')),
      ).toHaveLength(1);
    }
    // Every answerable question has passages; nothing in the corpus is as close to an
    // irrelevant question as the answers are to theirs.
    expect(report.overall.emptyRate).toBe(0);
    expect(report.irrelevant.topSimilarityMax).toBeLessThan(
      report.irrelevant.answeredTopSimilarityMin,
    );
    expect(report.latencyMs.p95).toBeLessThan(2_000);
  });
});
