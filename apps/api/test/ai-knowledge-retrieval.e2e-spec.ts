import { Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import {
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  KNOWLEDGE_EMBEDDING_DIMENSION,
  KNOWLEDGE_EMBEDDING_VERSION,
  SYSTEM_ROLES,
  type AiSettingsView,
  type KnowledgeRetrieval,
  type KnowledgeSourceView,
  type KnowledgeVersionView,
} from '@lms/shared';
import { AuthContextService } from '../src/core/auth/auth-context.service.js';
import type { AuthUser } from '../src/core/auth/auth-user.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { ScopeService } from '../src/core/scope/scope.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../src/core/storage/storage.driver.js';
import { knowledgeContentHash } from '../src/modules/ai/knowledge/content-hash.js';
import { KnowledgeReachService } from '../src/modules/ai/knowledge/knowledge-reach.service.js';
import { KnowledgeRetrievalService } from '../src/modules/ai/knowledge/retrieval/retrieval.service.js';
import { KNOWLEDGE_RETRIEVAL_LIMITS } from '../src/modules/ai/knowledge/retrieval/selection.js';
import { KnowledgeVectorSearch } from '../src/modules/ai/knowledge/retrieval/vector-search.js';
import {
  type AiEmbedRequest,
  type AiEmbedResult,
  AiProviderError,
} from '../src/modules/ai/providers/ai-provider.js';
import {
  FAKE_EMBEDDING_MODEL,
  FakeAiProvider,
  fakeEmbedding,
} from '../src/modules/ai/providers/fake.provider.js';
import { AiCircuitBreakers } from '../src/modules/ai/routing/circuit-breaker.js';
import { ModelRouter } from '../src/modules/ai/routing/model-router.js';
import { AiUsageService } from '../src/modules/ai/usage/usage.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { emptyKnowledgeBase } from './setup/knowledge-base.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

const AI_ENV = {
  AI_PROVIDER: 'fake',
  AI_TIMEOUT_MS: '3000',
  AI_DATA_CLASSES: 'public,course,personal',
  AI_MODEL_COSTS: `fake-1=1/2,${FAKE_EMBEDDING_MODEL}=0.02/0`,
};
const FLAGS = [AI_MODULE_FLAG, AI_KNOWLEDGE_FLAG];
const CONTRACT = {
  provider: 'fake' as const,
  model: FAKE_EMBEDDING_MODEL,
  dimension: KNOWLEDGE_EMBEDDING_DIMENSION,
  embeddingVersion: KNOWLEDGE_EMBEDDING_VERSION,
};

/** What a test may have the provider answer to the question's embedding. */
type Plan = 'ok' | 'unavailable' | 'hang' | 'short' | 'nan';

/** The fake provider, its next calls' answers scripted when a test needs a failure. */
class ScriptedEmbeddings extends FakeAiProvider {
  readonly calls: AiEmbedRequest[] = [];
  private plans: Plan[] = [];

  constructor() {
    super({ AI_MODEL: '' });
  }

  next(...plans: Plan[]): void {
    this.plans = plans;
  }

  override async embed(request: AiEmbedRequest, signal: AbortSignal): Promise<AiEmbedResult> {
    this.calls.push(request);
    const plan = this.plans.shift() ?? 'ok';
    if (plan === 'unavailable') throw new AiProviderError('unavailable', { httpStatus: 503 });
    if (plan === 'hang') {
      return new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
    const answer = await super.embed(request, signal);
    if (plan === 'short') return { ...answer, vectors: answer.vectors.map((v) => v.slice(1)) };
    if (plan === 'nan') {
      return { ...answer, vectors: answer.vectors.map((v) => [Number.NaN, ...v.slice(1)]) };
    }
    return answer;
  }
}

const literal = (vector: readonly number[]) => `[${vector.join(',')}]`;

/**
 * Phase 8D: retrieval from the knowledge base, end to end — the API's request, the scope resolved on
 * the server, the question embedded by the fake provider (`RETRIEVAL_QUERY`), the search in
 * PostgreSQL with pgvector. Above all, that a passage the person may not draw on is never returned
 * however close it is to the question — another institute's, a draft's, an archived source's or
 * document's, an older version's, a staff source's to a learner, another course's, a closed
 * lesson's, personal knowledge, a vector of another contract or of an older text — because the one
 * SQL statement excludes it before ranking. Then the rest: who may ask, the request's bounds,
 * course and lesson context, ranking, ties and de-duplication, provenance, failures in the
 * retrieval's own words, the ledger, the audit and the logs. No network, no key.
 */
describe('SI Academy AI — knowledge retrieval (Phase 8D)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageDriver;
  let admin: Session;
  let adminId = '';
  let organizationId = '';
  let reach: KnowledgeReachService;
  let search: KnowledgeVectorSearch;
  let retrieval: KnowledgeRetrievalService;
  let usage: AiUsageService;
  let router: ModelRouter;
  let circuits: AiCircuitBreakers;
  const provider = new ScriptedEmbeddings();
  const logged: unknown[][] = [];
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;

  /** A word no other test, or spec, writes: each test's knowledge and questions carry their own. */
  const word = (label: string) => `${label}${unique}x${++counter}`;

  async function signedIn(roleKey: string, label: string) {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key: roleKey } });
    const email = `ai8d-${label}-${counter}-${unique}@test.local`;
    const learner = roleKey === SYSTEM_ROLES.STUDENT;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI 8D ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
        ...(learner
          ? {
              studentProfile: {
                create: { studentCode: `STU-AI8D-${counter}-${unique}`, status: 'active' },
              },
            }
          : {}),
      },
      include: { studentProfile: true },
    });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    const auth = (await app.get(AuthContextService).load(user.id))!;
    return {
      session,
      user,
      studentId: user.studentProfile?.id ?? '',
      auth: { ...auth, sessionId: '' } as AuthUser,
    };
  }

  async function setFlag(key: string, enabled: boolean) {
    expectStatus(await admin.patch(`/flags/${key}`, { enabled }), 200);
  }

  async function withFlag(key: string, enabled: boolean, run: () => Promise<void>) {
    await setFlag(key, enabled);
    try {
      await run();
    } finally {
      await setFlag(key, !enabled);
    }
  }

  async function settle(patch: object): Promise<AiSettingsView> {
    return expectStatus(await admin.patch('/ai/admin/settings', patch), 200).body as AiSettingsView;
  }

  /** A course with an open module and a second one locked behind it (as in Phase 7E). */
  async function course(label: string) {
    counter += 1;
    return prisma.course.create({
      data: {
        organizationId,
        slug: `ai8d-${label.toLowerCase()}-${counter}-${unique}`,
        title: `${label} course ${counter}`,
        status: 'published',
        modules: {
          create: [
            {
              title: `${label} basics`,
              position: 0,
              lessons: {
                create: [
                  {
                    title: `${label} first`,
                    type: 'article',
                    position: 0,
                    content: { html: '<p>One</p>' },
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
                    title: `${label} second`,
                    type: 'article',
                    position: 0,
                    content: { html: '<p>Two</p>' },
                  },
                ],
              },
            },
          ],
        },
      },
      include: { modules: { orderBy: { position: 'asc' }, include: { lessons: true } } },
    });
  }
  type CourseRow = Awaited<ReturnType<typeof course>>;
  const lessonOf = (row: CourseRow, module = 0) => row.modules[module]!.lessons[0]!.id;
  const enrol = (studentId: string, courseId: string) =>
    prisma.enrollment.create({ data: { studentId, courseId } });

  /**
   * Knowledge through the platform's own path: a source, a document, a version of `text`, ingested,
   * published (unless a draft is wanted) and embedded under the active contract (unless not).
   */
  async function knowledge(
    text: string,
    options: {
      audience?: 'institute' | 'staff' | 'course';
      courseId?: string;
      lessonId?: string;
      dataClass?: 'public' | 'course' | 'personal';
      publish?: boolean;
      embed?: boolean;
    } = {},
  ) {
    const source = expectStatus(
      await admin.post('/ai/knowledge/sources', {
        name: `Retrieval ${++counter}`,
        type: 'authored',
        audience: options.audience ?? 'institute',
        dataClass: options.dataClass ?? (options.audience === 'course' ? 'course' : 'public'),
        ...(options.courseId ? { courseId: options.courseId } : {}),
      }),
      201,
    ).body as KnowledgeSourceView;
    const documentId = (
      expectStatus(
        await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
          title: `Notes ${counter}`,
          canonicalRef: `authored:retrieval-${counter}-${unique}`,
          ...(options.lessonId ? { lessonId: options.lessonId } : {}),
        }),
        201,
      ).body as { id: string }
    ).id;
    const version = await addVersion(documentId, text);
    if (options.publish !== false) {
      expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/publish`), 200);
      if (options.embed !== false) await embedVersion(version.id);
    }
    const chunks = await chunksOf(version.id);
    return { sourceId: source.id, documentId, versionId: version.id, chunks };
  }

  async function addVersion(documentId: string, text: string) {
    const version = expectStatus(
      await admin.post(`/ai/knowledge/documents/${documentId}/versions`, {
        content: text,
        format: 'markdown',
      }),
      201,
    ).body as KnowledgeVersionView;
    const ingested = expectStatus(
      await admin.post(`/ai/knowledge/versions/${version.id}/ingest`),
      202,
    ).body as KnowledgeVersionView;
    expect(ingested.status).toBe('chunked');
    return ingested;
  }

  async function embedVersion(versionId: string) {
    const view = expectStatus(await admin.post(`/ai/knowledge/versions/${versionId}/embed`), 202)
      .body as KnowledgeVersionView;
    expect(view.embedding?.status).toBe('embedded');
  }

  const chunksOf = (versionId: string) =>
    prisma.knowledgeChunk.findMany({ where: { versionId }, orderBy: { position: 'asc' } });

  /** A vector written straight to the database, around the service, as a stale or foreign one. */
  function insertVector(
    chunk: {
      id: string;
      organizationId: string;
      sourceId: string;
      documentId: string;
      versionId: string;
      content: string;
      contentHash: string;
    },
    options: { model?: string; hash?: string; vectorOf?: string } = {},
  ) {
    return prisma.$executeRawUnsafe(
      `INSERT INTO knowledge_chunk_embeddings
         (id, organization_id, source_id, document_id, version_id, chunk_id, content_hash,
          provider, model, dimension, embedding_version, embedding)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6,
               'fake', $7, $8, $9, $10::vector)`,
      chunk.organizationId,
      chunk.sourceId,
      chunk.documentId,
      chunk.versionId,
      chunk.id,
      options.hash ?? chunk.contentHash,
      options.model ?? FAKE_EMBEDDING_MODEL,
      KNOWLEDGE_EMBEDDING_DIMENSION,
      KNOWLEDGE_EMBEDDING_VERSION,
      literal(fakeEmbedding(options.vectorOf ?? chunk.content, KNOWLEDGE_EMBEDDING_DIMENSION)),
    );
  }

  /**
   * Knowledge written straight to the database — any institute, any state — with one chunk of
   * `text` and its vector under the active contract: what only the search's own conditions keep out.
   */
  async function rawKnowledge(
    text: string,
    options: {
      organizationId?: string;
      sourceStatus?: 'draft' | 'published' | 'archived';
      documentStatus?: 'active' | 'archived';
      dataClass?: 'public' | 'course' | 'personal';
      audience?: 'institute' | 'staff' | 'course';
      courseId?: string | null;
      current?: boolean;
    } = {},
  ) {
    counter += 1;
    const org = options.organizationId ?? organizationId;
    const source = await prisma.knowledgeSource.create({
      data: {
        organizationId: org,
        name: `Raw ${counter}`,
        type: 'authored',
        audience: options.audience ?? 'institute',
        courseId: options.courseId ?? null,
        dataClass: options.dataClass ?? 'public',
        status: options.sourceStatus ?? 'published',
        publishedAt: options.sourceStatus === 'draft' ? null : new Date(),
        archivedAt: options.sourceStatus === 'archived' ? new Date() : null,
      },
    });
    const document = await prisma.knowledgeDocument.create({
      data: {
        organizationId: org,
        sourceId: source.id,
        title: `Raw ${counter}`,
        canonicalRef: `raw:${counter}-${unique}`,
        status: options.documentStatus ?? 'active',
      },
    });
    const hash = knowledgeContentHash(text);
    const file = await prisma.file.create({
      data: {
        organizationId: org,
        ownerType: 'knowledge-version',
        driver: storage.name,
        bucket: storage.bucketName('private'),
        key: `ai8d/knowledge/${document.id}/${counter}.md`,
        originalName: 'raw.md',
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
        documentId: document.id,
        version: 1,
        contentHash: hash,
        fileId: file.id,
        characterCount: text.length,
        status: 'chunked',
        isCurrent: options.current ?? true,
        chunkCount: 1,
        chunkedAt: new Date(),
        parserVersion: 'markdown-1',
        chunkerVersion: 'sections-1/1200-2000-200-200',
      },
    });
    const chunk = await prisma.knowledgeChunk.create({
      data: {
        organizationId: org,
        sourceId: source.id,
        documentId: document.id,
        versionId: version.id,
        position: 0,
        content: text,
        contentHash: hash,
        characterCount: text.length,
        tokenEstimate: Math.ceil(text.length / 4),
      },
    });
    await insertVector(chunk);
    return { sourceId: source.id, documentId: document.id, versionId: version.id, chunk };
  }

  async function retrieve(session: Session, body: object) {
    return session.post('/ai/knowledge/retrieve', body);
  }

  async function resultsOf(session: Session, body: object) {
    return (expectStatus(await retrieve(session, body), 200).body as KnowledgeRetrieval).results;
  }

  const retrievals = (since: Date) =>
    prisma.auditLog.findMany({
      where: { action: 'ai.knowledge.retrieval', occurredAt: { gte: since } },
      orderBy: { occurredAt: 'asc' },
    });

  beforeAll(async () => {
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
    Object.assign(process.env, AI_ENV);
    app = await createTestApp({ aiProvider: provider });
    prisma = app.get(PrismaService);
    storage = app.get<StorageDriver>(STORAGE_DRIVER);
    reach = app.get(KnowledgeReachService);
    search = app.get(KnowledgeVectorSearch);
    retrieval = app.get(KnowledgeRetrievalService);
    usage = app.get(AiUsageService);
    router = app.get(ModelRouter);
    circuits = app.get(AiCircuitBreakers);
    const superAdmin = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_ACCOUNTS.superAdmin.email },
    });
    organizationId = superAdmin.organizationId;
    adminId = superAdmin.id;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    for (const key of FLAGS) await setFlag(key, true);
    await emptyKnowledgeBase(admin);
  });
  afterEach(() => {
    provider.next();
    circuits.circuitOf('fake', FAKE_EMBEDDING_MODEL).succeeded();
  });
  afterAll(async () => {
    // The institute's AI settings back to the deployment's (no stored row), as the next spec expects.
    await prisma.setting.deleteMany({ where: { organizationId, key: 'ai' } });
    for (const key of FLAGS) await setFlag(key, false);
    await app.close();
    for (const key of Object.keys(AI_ENV)) delete process.env[key];
    vi.restoreAllMocks();
  });

  it('is for whoever may ask SI Academy AI, behind both flags, and searches nothing otherwise', async () => {
    const topic = word('gate');
    await knowledge(`${topic} inheritance lets a subclass reuse its superclass.`);
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'gate');
    expect(await resultsOf(learner.session, { query: `${topic} inheritance` })).not.toHaveLength(0);

    // A role without `ai:chat` may not retrieve at all.
    const bare = await prisma.role.create({
      data: { organizationId, key: `no_ai_${unique}`, name: `No AI ${unique}` },
    });
    const outsiderSession = (await signedIn(bare.key, 'outsider')).session;
    const mark = provider.calls.length;
    const forbidden = await retrieve(outsiderSession, { query: `${topic} inheritance` });
    expect(forbidden.status).toBe(403);
    expect(problemCode(forbidden)).toBe('forbidden');
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    expect(
      (await request(server).post('/api/v1/ai/knowledge/retrieve').send({ query: 'anything' }))
        .status,
    ).toBe(401);
    await withFlag(AI_KNOWLEDGE_FLAG, false, async () => {
      const off = await retrieve(learner.session, { query: `${topic} inheritance` });
      expect(off.status).toBe(403);
      expect(problemCode(off)).toBe('ai_feature_disabled');
    });
    await withFlag(AI_MODULE_FLAG, false, async () => {
      expect(problemCode(await retrieve(learner.session, { query: `${topic} inheritance` }))).toBe(
        'module_disabled',
      );
    });
    // Nothing was embedded or searched for any of them.
    expect(provider.calls.length).toBe(mark);
  });

  it('takes a question and how many passages — and nothing that would let a client widen its reach', async () => {
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'bounds');
    const mark = provider.calls.length;
    const refused: object[] = [
      {},
      { query: '' },
      { query: '  a ' },
      { query: 'x'.repeat(1001) },
      { query: 'loops', topK: 0 },
      { query: 'loops', topK: 21 },
      { query: 'loops', topK: 2.5 },
      { query: 'loops', topK: '5' },
      { query: 'loops', courseId: 'not-a-uuid' },
      { query: 'loops', lessonId: 42 },
      { query: 'loops', instituteId: organizationId },
      { query: 'loops', organizationId },
      { query: 'loops', archived: true },
      { query: 'loops', includeArchived: true },
      { query: 'loops', unpublished: true },
      { query: 'loops', status: 'draft' },
      { query: 'loops', dataClass: 'personal' },
      { query: 'loops', dataClasses: ['public', 'course', 'personal'] },
      { query: 'loops', audience: 'staff' },
      { query: 'loops', sourceIds: [] },
      { query: 'loops', model: 'gemini-embedding-001' },
      { query: 'loops', vector: [0.1, 0.2] },
      { query: 'loops', embedding: [1] },
      { query: 'loops', filter: '1=1 OR organization_id IS NOT NULL' },
    ];
    for (const body of refused) {
      const res = await retrieve(learner.session, body);
      expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(400);
      expect(problemCode(res)).toBe('validation_failed');
    }
    expect(provider.calls.length).toBe(mark);

    // A lesson given with a course it is not a lesson of.
    const one = await course('Bounds');
    const other = await course('Other');
    await enrol(learner.studentId, one.id);
    await enrol(learner.studentId, other.id);
    const mismatch = await retrieve(learner.session, {
      query: 'loops',
      courseId: other.id,
      lessonId: lessonOf(one),
    });
    expect(mismatch.status).toBe(400);

    // Thirty retrievals in five minutes, then no more.
    const busy = await signedIn(SYSTEM_ROLES.STUDENT, 'busy');
    for (let i = 0; i < 30; i += 1) {
      expectStatus(await retrieve(busy.session, { query: `rate ${i} limit check` }), 200);
    }
    const limited = await retrieve(busy.session, { query: 'one more question' });
    expect(limited.status).toBe(429);
    expect(problemCode(limited)).toBe('rate_limited');
  });

  it('returns the passages the person may draw on, best first, with their whole provenance and never a vector', async () => {
    const topic = word('prov');
    const made = await knowledge(
      `# ${topic} inheritance\n\n${topic} inheritance lets a subclass reuse the fields and methods of its superclass.`,
    );
    await knowledge(`${topic} interfaces declare what a class promises to do.`);
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'prov');
    const mark = provider.calls.length;
    const res = expectStatus(
      await retrieve(learner.session, {
        query: `${topic} inheritance subclass superclass`,
        topK: 3,
      }),
      200,
    );
    const body = res.body as KnowledgeRetrieval;
    expect(body.topK).toBe(3);
    expect(body.context).toEqual({ courseId: null, lessonId: null });
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.length).toBeLessThanOrEqual(3);
    // The question was embedded once, as a question, under the active contract.
    expect(provider.calls.slice(mark)).toEqual([
      {
        texts: [`${topic} inheritance subclass superclass`],
        model: FAKE_EMBEDDING_MODEL,
        purpose: 'query',
        dimension: KNOWLEDGE_EMBEDDING_DIMENSION,
      },
    ]);
    const [best] = body.results;
    const chunk = made.chunks[0]!;
    const version = await prisma.knowledgeDocumentVersion.findUniqueOrThrow({
      where: { id: made.versionId },
      include: { document: { include: { source: true } } },
    });
    expect(best).toEqual({
      chunkId: chunk.id,
      position: chunk.position,
      heading: chunk.heading,
      content: chunk.content,
      contentHash: chunk.contentHash,
      similarity: expect.any(Number),
      source: {
        id: made.sourceId,
        name: version.document.source.name,
        audience: 'institute',
        courseId: null,
        dataClass: 'public',
      },
      document: {
        id: made.documentId,
        title: version.document.title,
        canonicalRef: version.document.canonicalRef,
        lessonId: null,
      },
      version: {
        id: made.versionId,
        number: version.version,
        parserVersion: 'markdown-1',
        chunkerVersion: version.chunkerVersion,
      },
    });
    // Best first; cosine similarity, at most 1.
    const similarities = body.results.map((result) => result.similarity);
    expect([...similarities].sort((a, b) => b - a)).toEqual(similarities);
    expect(best!.similarity).toBeGreaterThan(0.5);
    expect(best!.similarity).toBeLessThanOrEqual(1);
    // No vector, no list of numbers and no field that would hold either ever reaches the client —
    // judged by the answer's structure, not the passages' words (material may speak of vectors).
    const keysOf = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.flatMap(keysOf)
        : value !== null && typeof value === 'object'
          ? Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)])
          : [];
    const holdsNumbers = (value: unknown): boolean =>
      Array.isArray(value)
        ? value.some((item) => typeof item === 'number' || holdsNumbers(item))
        : value !== null && typeof value === 'object' && Object.values(value).some(holdsNumbers);
    expect(keysOf(body).filter((key) => /embedding|vector|distance/i.test(key))).toEqual([]);
    expect(holdsNumbers(body)).toBe(false);
    for (const result of body.results) {
      expect(Object.keys(result).sort()).toEqual([
        'chunkId',
        'content',
        'contentHash',
        'document',
        'heading',
        'position',
        'similarity',
        'source',
        'version',
      ]);
    }
    // The same question again: the same passages in the same order.
    expect(
      await resultsOf(learner.session, {
        query: `${topic} inheritance subclass superclass`,
        topK: 3,
      }),
    ).toEqual(body.results);
    // The default K is 5.
    expect(
      (
        expectStatus(await retrieve(learner.session, { query: `${topic} inheritance` }), 200)
          .body as KnowledgeRetrieval
      ).topK,
    ).toBe(5);
  });

  it('never returns another institute’s passage, however close it is to the question', async () => {
    const topic = word('inst');
    const ours = await knowledge(`${topic} polymorphism lets one call reach many forms.`);
    const orgB = await prisma.organization.create({
      data: { key: `ai8d-b-${unique}-${counter}`, name: 'Institute B' },
    });
    // Institute B's passage is the question itself: a similarity of 1 — and many of them.
    const question = `${topic} polymorphism dispatch override virtual method table`;
    const theirs = [];
    for (let i = 0; i < 12; i += 1) {
      theirs.push((await rawKnowledge(question, { organizationId: orgB.id })).chunk.id);
    }
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'inst');
    const results = await resultsOf(learner.session, { query: question, topK: 20 });
    expect(results.map((result) => result.chunkId)).toContain(ours.chunks[0]!.id);
    for (const result of results) {
      expect(theirs).not.toContain(result.chunkId);
      expect(await reach.mayRetrieve(learner.auth, result.chunkId)).toBe(true);
    }
    // The search's own condition, whatever the scope says: given institute B's source, it still
    // returns nothing of institute B's.
    const sourceIds = (await prisma.knowledgeSource.findMany({ select: { id: true } })).map(
      (s) => s.id,
    );
    const rows = await search.search(
      {
        organizationId,
        sourceIds,
        closedDocumentIds: [],
        dataClasses: ['public', 'course'],
        courseId: null,
        lessonId: null,
      },
      CONTRACT,
      fakeEmbedding(question, KNOWLEDGE_EMBEDDING_DIMENSION),
      { limit: 100, timeoutMs: 5_000 },
    );
    expect(rows.map((row) => row.chunkId)).not.toEqual(expect.arrayContaining([theirs[0]]));
    for (const row of rows) expect(theirs).not.toContain(row.chunkId);
    // And through the API, a client cannot name institute B.
    const named = await retrieve(learner.session, { query: question, instituteId: orgB.id });
    expect(named.status).toBe(400);
  });

  it('enforces publication, archiving, the current version, the data class and the contract in the search itself', async () => {
    const topic = word('state');
    const question = `${topic} recursion base case stack frames`;
    const valid = await rawKnowledge(question);
    const draft = await rawKnowledge(question, { sourceStatus: 'draft' });
    const archivedSource = await rawKnowledge(question, { sourceStatus: 'archived' });
    const archivedDocument = await rawKnowledge(question, { documentStatus: 'archived' });
    const personal = await rawKnowledge(question, { dataClass: 'personal' });
    const old = await rawKnowledge(question, { current: false });
    // A vector of another model, and one made from an older text, for a chunk that is otherwise fine.
    const foreign = await rawKnowledge(`${topic} unrelated words entirely`);
    await prisma.$executeRaw`DELETE FROM knowledge_chunk_embeddings WHERE chunk_id = ${foreign.chunk.id}::uuid`;
    await insertVector(foreign.chunk, { model: 'fake-embedding-0', vectorOf: question });
    const stale = await rawKnowledge(`${topic} other unrelated words`);
    await prisma.$executeRaw`DELETE FROM knowledge_chunk_embeddings WHERE chunk_id = ${stale.chunk.id}::uuid`;
    await insertVector(stale.chunk, { hash: '0'.repeat(64), vectorOf: question });
    const excluded = [draft, archivedSource, archivedDocument, personal, old, foreign, stale].map(
      (made) => made.chunk.id,
    );

    // The search alone, given every source as if the reach allowed them all.
    const sourceIds = (await prisma.knowledgeSource.findMany({ select: { id: true } })).map(
      (s) => s.id,
    );
    const rows = await search.search(
      {
        organizationId,
        sourceIds,
        closedDocumentIds: [],
        dataClasses: ['public', 'course'],
        courseId: null,
        lessonId: null,
      },
      CONTRACT,
      fakeEmbedding(question, KNOWLEDGE_EMBEDDING_DIMENSION),
      { limit: 100, timeoutMs: 5_000 },
    );
    const found = rows.map((row) => row.chunkId);
    expect(found).toContain(valid.chunk.id);
    for (const id of excluded) expect(found).not.toContain(id);

    // Through the API, for a learner and for the Super Admin alike.
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'state');
    for (const session of [learner.session, admin]) {
      const results = await resultsOf(session, { query: question, topK: 20 });
      expect(results.map((r) => r.chunkId)).toContain(valid.chunk.id);
      for (const id of excluded) expect(results.map((r) => r.chunkId)).not.toContain(id);
    }
  });

  it('keeps an older version out while its vectors remain, and draws on the current one once embedded', async () => {
    const topic = word('ver');
    const first = await knowledge(`${topic} arrays hold a fixed number of values of one type.`);
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'ver');
    expect(
      (await resultsOf(learner.session, { query: `${topic} arrays fixed values` }))[0]!.chunkId,
    ).toBe(first.chunks[0]!.id);
    // A newer version, chunked but not embedded: the old one's vectors are still there, and unused.
    const second = await addVersion(
      first.documentId,
      `${topic} arrays grow when copied into a larger one.`,
    );
    expect(
      await prisma.knowledgeChunkEmbedding.count({ where: { versionId: first.versionId } }),
    ).toBeGreaterThan(0);
    const between = await resultsOf(learner.session, {
      query: `${topic} arrays fixed values`,
      topK: 20,
    });
    expect(between.map((r) => r.document.id)).not.toContain(first.documentId);
    // Embedded, the newer version answers; a historical vector put back is still never used.
    await embedVersion(second.id);
    const after = await resultsOf(learner.session, {
      query: `${topic} arrays grow copied larger`,
      topK: 20,
    });
    const fromDocument = after.filter((r) => r.document.id === first.documentId);
    expect(fromDocument.map((r) => r.version.id)).toEqual([second.id]);
    await insertVector(first.chunks[0]!);
    const historical = await resultsOf(learner.session, {
      query: `${topic} arrays fixed values`,
      topK: 20,
    });
    expect(historical.map((r) => r.chunkId)).not.toContain(first.chunks[0]!.id);
  });

  it('keeps each audience to its people: staff material from learners, a course’s from those it does not reach', async () => {
    const topic = word('aud');
    const shared = await course('Shared');
    const staffOnly = await knowledge(`${topic} grading rubric moderation for assessors.`, {
      audience: 'staff',
    });
    const courseOnly = await knowledge(`${topic} grading rubric for the course project.`, {
      audience: 'course',
      courseId: shared.id,
    });
    const institute = await knowledge(`${topic} grading rubric explained to everyone.`);
    const query = { query: `${topic} grading rubric`, topK: 20 };
    const idsFor = async (session: Session) =>
      (await resultsOf(session, query)).map((result) => result.chunkId);

    const enrolled = await signedIn(SYSTEM_ROLES.STUDENT, 'enrolled');
    await enrol(enrolled.studentId, shared.id);
    const stranger = await signedIn(SYSTEM_ROLES.STUDENT, 'stranger');
    const trainer = await signedIn(SYSTEM_ROLES.TRAINER, 'teacher');
    const profile = await prisma.trainerProfile.create({ data: { userId: trainer.user.id } });
    const batch = await prisma.batch.findFirstOrThrow({
      where: { code: TEST_FIXTURES.assignedBatchCode },
    });
    await prisma.batchTrainer.create({
      data: { batchId: batch.id, trainerId: profile.id, subject: 'Java' },
    });
    await prisma.coursePublication.create({
      data: { courseId: shared.id, scopeType: 'batch', scopeId: batch.id },
    });

    const learnerSees = await idsFor(enrolled.session);
    expect(learnerSees).toContain(courseOnly.chunks[0]!.id);
    expect(learnerSees).toContain(institute.chunks[0]!.id);
    expect(learnerSees).not.toContain(staffOnly.chunks[0]!.id);

    const strangerSees = await idsFor(stranger.session);
    expect(strangerSees).toContain(institute.chunks[0]!.id);
    expect(strangerSees).not.toContain(courseOnly.chunks[0]!.id);
    expect(strangerSees).not.toContain(staffOnly.chunks[0]!.id);

    // The trainer's reach is the batches they teach, read afresh.
    app.get(ScopeService).invalidate(trainer.user.id);
    const teacher = trainer.session;
    const teacherSees = await idsFor(teacher);
    expect(teacherSees).toContain(staffOnly.chunks[0]!.id);
    expect(teacherSees).toContain(courseOnly.chunks[0]!.id);

    // The Super Admin manages the knowledge base, and draws on it as staff: not a course it does not teach.
    const adminSees = await idsFor(admin);
    expect(adminSees).toContain(staffOnly.chunks[0]!.id);
    expect(adminSees).not.toContain(courseOnly.chunks[0]!.id);

    // Personal knowledge reaches nobody, even with vectors in place.
    const personal = await rawKnowledge(`${topic} grading rubric personal notes`, {
      dataClass: 'personal',
    });
    for (const session of [enrolled.session, teacher, admin]) {
      expect(await idsFor(session)).not.toContain(personal.chunk.id);
    }
  });

  it('draws only on the course or lesson asked from — never another course’s, never a closed lesson’s', async () => {
    const topic = word('ctx');
    const courseA = await course('Alpha');
    const courseB = await course('Beta');
    const query = (extra: object = {}) => ({
      query: `${topic} iteration loops`,
      topK: 20,
      ...extra,
    });
    const aGeneral = await knowledge(`${topic} iteration loops in course alpha.`, {
      audience: 'course',
      courseId: courseA.id,
    });
    const aFirst = await knowledge(`${topic} iteration loops in the first lesson.`, {
      audience: 'course',
      courseId: courseA.id,
      lessonId: lessonOf(courseA, 0),
    });
    const aSecond = await knowledge(`${topic} iteration loops in the locked lesson.`, {
      audience: 'course',
      courseId: courseA.id,
      lessonId: lessonOf(courseA, 1),
    });
    const bGeneral = await knowledge(`${topic} iteration loops in course beta.`, {
      audience: 'course',
      courseId: courseB.id,
    });
    const general = await knowledge(`${topic} iteration loops for everyone.`);
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'ctx');
    await enrol(learner.studentId, courseA.id);
    await enrol(learner.studentId, courseB.id);
    const ids = async (extra: object = {}) =>
      (await resultsOf(learner.session, query(extra))).map((result) => result.chunkId);

    // No context: both courses, the institute's — not the lesson still locked.
    const everywhere = await ids();
    expect(everywhere).toEqual(
      expect.arrayContaining([
        aGeneral.chunks[0]!.id,
        aFirst.chunks[0]!.id,
        bGeneral.chunks[0]!.id,
        general.chunks[0]!.id,
      ]),
    );
    expect(everywhere).not.toContain(aSecond.chunks[0]!.id);

    // From course A: course A's material and the institute's, never course B's.
    const fromA = await ids({ courseId: courseA.id });
    expect(fromA).toEqual(
      expect.arrayContaining([aGeneral.chunks[0]!.id, aFirst.chunks[0]!.id, general.chunks[0]!.id]),
    );
    expect(fromA).not.toContain(bGeneral.chunks[0]!.id);
    expect(fromA).not.toContain(aSecond.chunks[0]!.id);

    // From lesson A1: its own documents, the course's general ones — never another lesson's.
    await prisma.lessonProgress.createMany({
      data: courseA.modules[0]!.lessons.map((lesson) => ({
        studentId: learner.studentId,
        lessonId: lesson.id,
        status: 'completed',
        completedAt: new Date(),
      })),
    });
    const opened = await ids();
    expect(opened).toContain(aSecond.chunks[0]!.id);
    const fromLesson = await ids({ lessonId: lessonOf(courseA, 0) });
    expect(fromLesson).toEqual(
      expect.arrayContaining([aFirst.chunks[0]!.id, aGeneral.chunks[0]!.id]),
    );
    expect(fromLesson).not.toContain(aSecond.chunks[0]!.id);
    expect(fromLesson).not.toContain(bGeneral.chunks[0]!.id);

    // A course or lesson the person cannot open is refused, and nothing is searched.
    const outsider = await signedIn(SYSTEM_ROLES.STUDENT, 'ctx-out');
    await enrol(outsider.studentId, courseA.id);
    const mark = provider.calls.length;
    for (const context of [
      { courseId: courseB.id },
      { lessonId: lessonOf(courseB, 0) },
      { lessonId: lessonOf(courseA, 1) },
      { courseId: '00000000-0000-4000-8000-000000000000' },
      { lessonId: '00000000-0000-4000-8000-000000000000' },
    ]) {
      const res = await retrieve(outsider.session, query(context));
      expect(res.status, JSON.stringify(context)).toBe(403);
      expect(problemCode(res)).toBe('knowledge_retrieval_forbidden');
    }
    expect(provider.calls.length).toBe(mark);
  });

  it('ranks deterministically: equal distances by chunk id, one passage per text, two per document', async () => {
    const topic = word('rank');
    // The same words in another order: the same vector, so the same distance — a true tie.
    const tieA = await knowledge(`${topic} alpha beta gamma delta`);
    const tieB = await knowledge(`${topic} delta gamma beta alpha`);
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'rank');
    const tied = await resultsOf(learner.session, {
      query: `${topic} alpha beta gamma delta`,
      topK: 2,
    });
    expect(tied.map((r) => r.similarity)).toEqual([tied[0]!.similarity, tied[0]!.similarity]);
    expect(tied.map((r) => r.chunkId)).toEqual([tieA.chunks[0]!.id, tieB.chunks[0]!.id].sort());
    for (let i = 0; i < 3; i += 1) {
      expect(
        await resultsOf(learner.session, { query: `${topic} alpha beta gamma delta`, topK: 2 }),
      ).toEqual(tied);
    }

    // The same text in two documents: one passage.
    const echo = `${topic} epsilon zeta eta theta, said twice.`;
    const echoA = await knowledge(echo);
    const echoB = await knowledge(echo);
    const echoed = await resultsOf(learner.session, { query: echo, topK: 20 });
    const echoIds = [echoA.chunks[0]!.id, echoB.chunks[0]!.id];
    expect(echoed.filter((r) => echoIds.includes(r.chunkId))).toHaveLength(1);
    expect(echoed.find((r) => echoIds.includes(r.chunkId))!.chunkId).toBe([...echoIds].sort()[0]);

    // One document of many matching passages gives two; no chunk twice.
    const sections = Array.from(
      { length: 5 },
      (_, i) =>
        `## Part ${i}\n\n${`${topic} iota kappa lambda mu nu xi omicron part ${i}. `.repeat(30)}`,
    ).join('\n\n');
    const long = await knowledge(sections);
    expect(long.chunks.length).toBeGreaterThan(2);
    const flooded = await resultsOf(learner.session, {
      query: `${topic} iota kappa lambda`,
      topK: 20,
    });
    expect(flooded.filter((r) => r.document.id === long.documentId)).toHaveLength(2);
    expect(new Set(flooded.map((r) => r.chunkId)).size).toBe(flooded.length);
  });

  it('fails in its own words: the provider unavailable, a bad vector, the deadline, a slow search', async () => {
    const topic = word('fail');
    await knowledge(`${topic} exceptions unwind the stack to a handler.`);
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'fail');
    const since = new Date();
    const expectProblem = async (status: number, code: string) => {
      const res = await retrieve(learner.session, { query: `${topic} exceptions handler` });
      expect(res.status, code).toBe(status);
      expect(problemCode(res), code).toBe(code);
      expect(res.text).not.toMatch(/prisma|postgres|sql|stack|at .*\.ts|gemini|google|fake/i);
      return res;
    };
    provider.next('unavailable');
    await expectProblem(503, 'knowledge_retrieval_unavailable');
    provider.next('short');
    await expectProblem(502, 'knowledge_retrieval_failed');
    provider.next('nan');
    await expectProblem(502, 'knowledge_retrieval_failed');

    const limits = KNOWLEDGE_RETRIEVAL_LIMITS as { deadlineMs: number };
    const deadline = limits.deadlineMs;
    try {
      limits.deadlineMs = 400;
      provider.next('hang');
      const started = Date.now();
      await expectProblem(504, 'knowledge_retrieval_timeout');
      expect(Date.now() - started).toBeLessThan(2_000);

      // The search held up: the vectors' table locked, so the statement waits out its timeout.
      limits.deadlineMs = 1_500;
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(
            'LOCK TABLE knowledge_chunk_embeddings IN ACCESS EXCLUSIVE MODE',
          );
          const slow = Date.now();
          await expectProblem(504, 'knowledge_retrieval_timeout');
          expect(Date.now() - slow).toBeLessThan(5_000);
        },
        { timeout: 20_000 },
      );
    } finally {
      limits.deadlineMs = deadline;
    }
    // Recovered, it answers again.
    expectStatus(await retrieve(learner.session, { query: `${topic} exceptions handler` }), 200);

    const entries = await retrievals(since);
    const failures = entries
      .filter((entry) => (entry.after as { status: string }).status === 'failed')
      .map((entry) => (entry.after as { failureCode: string }).failureCode);
    expect(failures).toEqual([
      'provider_unavailable',
      'provider_malformed',
      'provider_malformed',
      'timeout',
      'timeout',
    ]);
  });

  it('refuses what may not be sent or paid for: a credential, unapproved data, a spent allowance', async () => {
    const topic = word('refuse');
    const shared = await course('Refuse');
    await knowledge(`${topic} generics keep collections type safe.`, {
      audience: 'course',
      courseId: shared.id,
    });
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'refuse');
    await enrol(learner.studentId, shared.id);
    const mark = provider.calls.length;

    const secret = await retrieve(learner.session, {
      query: `${topic} why does ghp_${'A'.repeat(36)} fail`,
    });
    expect(secret.status).toBe(422);
    expect(problemCode(secret)).toBe('ai_restricted_content');

    await settle({ dataClasses: ['public'] });
    try {
      const course = await retrieve(learner.session, {
        query: `${topic} generics`,
        courseId: shared.id,
      });
      expect(course.status).toBe(403);
      expect(problemCode(course)).toBe('ai_data_not_approved');
    } finally {
      await settle({ dataClasses: null });
    }

    const { day, monthStart } = await usage.today();
    await settle({ monthlyBudgetUsd: 1 });
    const payer = await signedIn(SYSTEM_ROLES.STUDENT, 'payer');
    try {
      const elsewhere = await usage.spentSince(organizationId, monthStart);
      await prisma.aiUsageDaily.create({
        data: {
          organizationId,
          userId: payer.user.id,
          day,
          estimatedCostMicros: Math.max(0, 1_000_000 - elsewhere),
        },
      });
      const spent = await retrieve(learner.session, { query: `${topic} generics` });
      expect(spent.status).toBe(429);
      expect(problemCode(spent)).toBe('ai_quota_exceeded');
      await prisma.aiUsageDaily.deleteMany({ where: { userId: payer.user.id } });
      const unpriced = vi.spyOn(router, 'costOf').mockReturnValue(null);
      try {
        const res = await retrieve(learner.session, { query: `${topic} generics` });
        expect(res.status).toBe(503);
        expect(problemCode(res)).toBe('knowledge_retrieval_unavailable');
      } finally {
        unpriced.mockRestore();
      }
    } finally {
      await prisma.aiUsageDaily.deleteMany({ where: { userId: payer.user.id } });
      await settle({ monthlyBudgetUsd: null });
    }
    // None of them reached the provider.
    expect(provider.calls.length).toBe(mark);
  });

  it('records the call in the ledger and the person’s allowance, and audits by ids and counts — never the question or a passage', async () => {
    const topic = word('rec');
    const marker = `confidentialmarker${unique}`;
    const made = await knowledge(`${topic} streams pipe values through ${marker} stages.`);
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'rec');
    const since = new Date();
    const before = await usage.allowance(learner.user.id);
    const question = `${topic} streams ${marker} pipeline question`;
    const results = await resultsOf(learner.session, { query: question, topK: 4 });
    expect(results.map((r) => r.chunkId)).toContain(made.chunks[0]!.id);

    const ledger = await prisma.aiRequest.findMany({ where: { userId: learner.user.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      feature: 'knowledge',
      task: 'retrieve',
      dataClass: 'public',
      provider: 'fake',
      model: FAKE_EMBEDDING_MODEL,
      outcome: 'ok',
      outputTokens: 0,
      conversationId: null,
      countsAsQuestion: false,
    });
    // A person's own retrieval counts in their allowance (the institute's embedding never does).
    const after = await usage.allowance(learner.user.id);
    expect(after.tokensLeft).toBe(before.tokensLeft - ledger[0]!.totalTokens);
    expect(after.requestsLeft).toBe(before.requestsLeft);

    const [entry] = await retrievals(since);
    expect(entry).toMatchObject({ actorId: learner.user.id, resourceType: 'knowledge_retrieval' });
    expect(entry!.after).toEqual({
      status: 'succeeded',
      topK: 4,
      courseId: null,
      lessonId: null,
      resultCount: results.length,
      candidates: expect.any(Number),
      documentIds: [...new Set(results.map((r) => r.document.id))],
      durationMs: expect.any(Number),
      ...CONTRACT,
    });
    // The question and the passages are nowhere but in the answer: not the audit, ledger or logs.
    const kept = JSON.stringify([await retrievals(since), ledger, logged]);
    for (const text of [marker, question, topic, made.chunks[0]!.content.slice(0, 30)]) {
      expect(kept).not.toContain(text);
    }
    expect(JSON.stringify(logged)).toContain('Knowledge retrieved');
  });

  it('stops the work when the client has gone, and says so', async () => {
    const topic = word('gone');
    await knowledge(`${topic} threads share memory carefully.`);
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'gone');
    const since = new Date();
    const controller = new AbortController();
    controller.abort(new Error('The client went away'));
    await expect(
      retrieval.retrieve(learner.auth, { query: `${topic} threads`, topK: 5 }, controller.signal),
    ).rejects.toMatchObject({ code: 'knowledge_retrieval_unavailable' });
    const [entry] = await retrievals(since);
    expect(entry!.after).toMatchObject({ status: 'failed', failureCode: 'cancelled' });
    void adminId;
  });
});
