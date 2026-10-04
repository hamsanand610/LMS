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
  type KnowledgeSourceView,
  type KnowledgeStatus,
  type KnowledgeVersionView,
} from '@lms/shared';
import { AuthContextService } from '../src/core/auth/auth-context.service.js';
import type { AuthUser } from '../src/core/auth/auth-user.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../src/core/storage/storage.driver.js';
import { knowledgeContentHash } from '../src/modules/ai/knowledge/content-hash.js';
import {
  KNOWLEDGE_EMBEDDING_LIMITS,
  KnowledgeEmbeddingService,
} from '../src/modules/ai/knowledge/embedding/embedding.service.js';
import { KnowledgeReachService } from '../src/modules/ai/knowledge/knowledge-reach.service.js';
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
import { toMicros } from '../src/modules/ai/usage/cost.js';
import { AiUsageService } from '../src/modules/ai/usage/usage.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { JAVA_INHERITANCE_TEXT } from './fixtures/java-inheritance-basics.js';
import { courseNotes } from './fixtures/knowledge-course-notes.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const AI_ENV = {
  AI_PROVIDER: 'fake',
  AI_TIMEOUT_MS: '1000',
  AI_DATA_CLASSES: 'public,course,personal',
  AI_EMBEDDING_BATCH_SIZE: '4',
  AI_MODEL_COSTS: `fake-1=1/2,${FAKE_EMBEDDING_MODEL}=0.02/0`,
};
const BATCH = 4;
const FLAGS = [AI_MODULE_FLAG, AI_KNOWLEDGE_FLAG];
const CONTRACT = {
  provider: 'fake',
  model: FAKE_EMBEDDING_MODEL,
  dimension: KNOWLEDGE_EMBEDDING_DIMENSION,
  embeddingVersion: KNOWLEDGE_EMBEDDING_VERSION,
};
/** Words of the fixtures: no audit entry, log line or answer may ever carry them. */
const CONTENT_MARKERS = ['Inheritance lets one class', 'through example'];

/** What a test may have the provider answer to one embedding call. */
type Plan =
  | 'ok'
  | 'unavailable'
  | 'rate_limited'
  | 'auth'
  | 'bad_request'
  | 'hang'
  | 'short'
  | 'long'
  | 'nan'
  | 'missing'
  | ((request: AiEmbedRequest) => Promise<void>);

/**
 * The fake provider (deterministic, offline), with a call's answer scripted when a test needs a
 * failure: one plan per call, in order, then the fake's own vectors. A function runs first and the
 * fake answers after it. Every request is kept, so a test sees exactly what was asked, and when.
 */
class ScriptedEmbeddings extends FakeAiProvider {
  readonly calls: AiEmbedRequest[] = [];
  private plans: Plan[] = [];

  constructor() {
    super({ AI_MODEL: '' });
  }

  /** The next calls' answers, in order; after them, the fake's own. */
  next(...plans: Plan[]): void {
    this.plans = plans;
  }

  override async embed(request: AiEmbedRequest, signal: AbortSignal): Promise<AiEmbedResult> {
    this.calls.push(request);
    const plan = this.plans.shift() ?? 'ok';
    if (typeof plan === 'function') {
      await plan(request);
      return super.embed(request, signal);
    }
    switch (plan) {
      case 'unavailable':
        throw new AiProviderError('unavailable', { httpStatus: 503 });
      case 'rate_limited':
        throw new AiProviderError('rate_limited', { httpStatus: 429, retryAfterSeconds: 30 });
      case 'auth':
        throw new AiProviderError('auth', { httpStatus: 401 });
      case 'bad_request':
        throw new AiProviderError('bad_request', { httpStatus: 400 });
      case 'hang':
        return new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      default:
        break;
    }
    const answer = await super.embed(request, signal);
    const { vectors } = answer;
    switch (plan) {
      case 'short':
        return { ...answer, vectors: vectors.map((v) => v.slice(1)) };
      case 'long':
        return { ...answer, vectors: vectors.map((v) => [...v, 0]) };
      case 'nan':
        return {
          ...answer,
          vectors: vectors.map((v, i) => (i === 0 ? [Number.NaN, ...v.slice(1)] : v)),
        };
      case 'missing':
        return { ...answer, vectors: vectors.slice(1) };
      default:
        return answer;
    }
  }
}

interface StoredVector {
  id: string;
  chunk_id: string;
  organization_id: string;
  source_id: string;
  document_id: string;
  version_id: string;
  content_hash: string;
  provider: string;
  model: string;
  dimension: number;
  embedding_version: string;
  created_at: Date;
  dims: number;
  norm: number;
  head: number[];
}

const literal = (vector: readonly number[]) => `[${vector.join(',')}]`;

/**
 * Phase 8C: the knowledge base's embeddings, end to end — through the API's request and the queue's
 * job, on the test database (pgvector), with the fake provider and scripted failures: no network,
 * no key, no quota. Who may ask; what may be embedded; the contract each vector is made under; its
 * dimension and length, checked by the router and again by the database; batches, idempotency,
 * claims and leases; failures, retries and taking a run up again; what is purged and when; the
 * ledger, the budget and the requester's own allowance; the audit; the institute's own; what
 * retrieval (8D) will filter on; the index. Nothing is retrieved: there is no path to.
 */
describe('SI Academy AI — knowledge embeddings (Phase 8C)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageDriver;
  let admin: Session;
  let adminId = '';
  let organizationId = '';
  let embedding: KnowledgeEmbeddingService;
  let reach: KnowledgeReachService;
  let usage: AiUsageService;
  let router: ModelRouter;
  let circuits: AiCircuitBreakers;
  const provider = new ScriptedEmbeddings();
  const logged: unknown[][] = [];
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;

  async function signedIn(roleKey: string, label: string) {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key: roleKey } });
    const email = `ai8c-${label}-${counter}-${unique}@test.local`;
    const learner = roleKey === SYSTEM_ROLES.STUDENT;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI 8C ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
        ...(learner
          ? {
              studentProfile: {
                create: { studentCode: `STU-AI8C-${counter}-${unique}`, status: 'active' },
              },
            }
          : {}),
      },
    });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    const auth = (await app.get(AuthContextService).load(user.id))!;
    return { session, auth: { ...auth, sessionId: '' } as AuthUser };
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

  async function newSource(overrides: object = {}) {
    return expectStatus(
      await admin.post('/ai/knowledge/sources', {
        name: `Embeddings ${++counter}`,
        type: 'authored',
        audience: 'institute',
        dataClass: 'public',
        ...overrides,
      }),
      201,
    ).body as KnowledgeSourceView;
  }

  async function newDocument(sourceId: string, overrides: object = {}) {
    return (
      expectStatus(
        await admin.post(`/ai/knowledge/sources/${sourceId}/documents`, {
          title: 'Course notes',
          canonicalRef: `authored:embed-${++counter}-${unique}`,
          ...overrides,
        }),
        201,
      ).body as { id: string }
    ).id;
  }

  async function newVersion(documentId: string, content = JAVA_INHERITANCE_TEXT) {
    return expectStatus(
      await admin.post(`/ai/knowledge/documents/${documentId}/versions`, {
        content,
        format: 'markdown',
      }),
      201,
    ).body as KnowledgeVersionView;
  }

  async function ingestViaApi(versionId: string) {
    const view = expectStatus(await admin.post(`/ai/knowledge/versions/${versionId}/ingest`), 202)
      .body as KnowledgeVersionView;
    expect(view.status).toBe('chunked');
    return view;
  }

  /** A version of a fresh document in a fresh source, not yet ingested. */
  async function fresh(content = JAVA_INHERITANCE_TEXT, source: object = {}) {
    const created = await newSource(source);
    const documentId = await newDocument(created.id);
    const version = await newVersion(documentId, content);
    return { source: created, documentId, version };
  }

  /** A chunked version of a published source: what may be embedded. */
  async function ready(content = courseNotes(2), source: object = {}) {
    const made = await fresh(content, source);
    const version = await ingestViaApi(made.version.id);
    expectStatus(await admin.post(`/ai/knowledge/sources/${made.source.id}/publish`), 200);
    return { ...made, version };
  }

  /** Asks for the version's embedding through the API; the queue runs it inline in tests. */
  async function embedViaApi(versionId: string, as: Session = admin) {
    return expectStatus(await as.post(`/ai/knowledge/versions/${versionId}/embed`), 202)
      .body as KnowledgeVersionView;
  }

  const chunksOf = (versionId: string) =>
    prisma.knowledgeChunk.findMany({ where: { versionId }, orderBy: { position: 'asc' } });

  const runOf = (versionId: string) =>
    prisma.knowledgeVersionEmbedding.findFirst({ where: { versionId, ...CONTRACT } });

  /** A version's vectors, in its chunks' order: each one's contract, size and length, never whole. */
  const vectorsOf = (versionId: string) =>
    prisma.$queryRaw<StoredVector[]>`
      SELECT e.id::text, e.chunk_id::text, e.organization_id::text, e.source_id::text,
             e.document_id::text, e.version_id::text, e.content_hash, e.provider, e.model,
             e.dimension, e.embedding_version, e.created_at,
             vector_dims(e.embedding) AS dims, vector_norm(e.embedding) AS norm,
             (e.embedding::real[])[1:4] AS head
      FROM knowledge_chunk_embeddings e JOIN knowledge_chunks c ON c.id = e.chunk_id
      WHERE e.version_id = ${versionId}::uuid
      ORDER BY c.position, e.model`;

  type Chunk = Awaited<ReturnType<typeof chunksOf>>[number];

  /** Writes a vector row straight to the database, around the service: the schema decides. */
  function insertVector(
    chunk: Chunk,
    options: {
      vector?: string;
      dimension?: number;
      hash?: string;
      model?: string;
      organizationId?: string;
    } = {},
  ) {
    return prisma.$executeRawUnsafe(
      `INSERT INTO knowledge_chunk_embeddings
         (id, organization_id, source_id, document_id, version_id, chunk_id, content_hash,
          provider, model, dimension, embedding_version, embedding)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6,
               'fake', $7, $8, 'embed-1', $9::vector)`,
      options.organizationId ?? chunk.organizationId,
      chunk.sourceId,
      chunk.documentId,
      chunk.versionId,
      chunk.id,
      options.hash ?? chunk.contentHash,
      options.model ?? FAKE_EMBEDDING_MODEL,
      options.dimension ?? KNOWLEDGE_EMBEDDING_DIMENSION,
      options.vector ?? literal(fakeEmbedding(chunk.content, KNOWLEDGE_EMBEDDING_DIMENSION)),
    );
  }

  /** The audit entry recording a state of the version's embedding. */
  const stateEntry = (versionId: string, status: string) =>
    prisma.auditLog.findFirstOrThrow({
      where: {
        resourceId: versionId,
        action: 'ai.knowledge.embedding',
        after: { path: ['status'], equals: status },
      },
      orderBy: { occurredAt: 'desc' },
    });

  /** A course with one open lesson. */
  async function course(label: string) {
    counter += 1;
    return prisma.course.create({
      data: {
        organizationId,
        slug: `ai8c-${label}-${counter}-${unique}`,
        title: `${label} course ${counter}`,
        status: 'published',
        modules: {
          create: [
            {
              title: 'Open',
              position: 0,
              lessons: {
                create: [
                  { title: 'First', type: 'article', position: 0, content: { html: '<p>One</p>' } },
                ],
              },
            },
          ],
        },
      },
      include: { modules: { include: { lessons: true } } },
    });
  }

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
    embedding = app.get(KnowledgeEmbeddingService);
    reach = app.get(KnowledgeReachService);
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
  });
  afterEach(() => {
    provider.next();
    // A test that fails the model on purpose leaves the next one a closed circuit.
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

  it('is asked for by ai:knowledge_manage alone, behind both flags; the job waits while they are off', async () => {
    const { version } = await ready();
    const mark = provider.calls.length;
    for (const role of [SYSTEM_ROLES.STUDENT, SYSTEM_ROLES.TRAINER, SYSTEM_ROLES.ADMIN]) {
      const { session } = await signedIn(role, `ask-${role}`);
      const res = await session.post(`/ai/knowledge/versions/${version.id}/embed`);
      expect(res.status, role).toBe(403);
      expect(problemCode(res), role).toBe('forbidden');
    }
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    expect(
      (await request(server).post(`/api/v1/ai/knowledge/versions/${version.id}/embed`)).status,
    ).toBe(401);
    await withFlag(AI_KNOWLEDGE_FLAG, false, async () => {
      expect(problemCode(await admin.post(`/ai/knowledge/versions/${version.id}/embed`))).toBe(
        'ai_feature_disabled',
      );
      // A job already queued does nothing while the knowledge base is off.
      expect(await embedding.embed(version.id)).toEqual({
        status: 'skipped',
        reason: 'switched_off',
      });
    });
    await withFlag(AI_MODULE_FLAG, false, async () => {
      expect(problemCode(await admin.post(`/ai/knowledge/versions/${version.id}/embed`))).toBe(
        'module_disabled',
      );
      expect((await embedding.embed(version.id)).status).toBe('skipped');
    });
    const unknown = await admin.post(
      '/ai/knowledge/versions/00000000-0000-4000-8000-000000000000/embed',
    );
    expect(unknown.status).toBe(404);
    // Nothing was asked of the provider, and nothing is held for the version.
    expect(provider.calls.length).toBe(mark);
    expect(await runOf(version.id)).toBeNull();
    expect(await vectorsOf(version.id)).toEqual([]);
  });

  it('embeds an eligible version: one unit vector of the schema’s dimension per chunk, in order, under the contract', async () => {
    const { source, documentId, version } = await ready(courseNotes(3));
    const chunks = await chunksOf(version.id);
    expect(chunks.length).toBeGreaterThan(BATCH);
    const mark = provider.calls.length;
    const view = await embedViaApi(version.id);
    expect(view.embedding).toEqual({
      status: 'embedded',
      ...CONTRACT,
      embedded: chunks.length,
      total: chunks.length,
      failureCode: null,
      embeddedAt: expect.any(String),
    });
    // In batches of AI_EMBEDDING_BATCH_SIZE at most, in the chunks' order, as documents.
    const calls = provider.calls.slice(mark);
    expect(calls).toHaveLength(Math.ceil(chunks.length / BATCH));
    expect(calls.flatMap((call) => call.texts)).toEqual(chunks.map((chunk) => chunk.content));
    for (const call of calls) {
      expect(call).toMatchObject({
        model: FAKE_EMBEDDING_MODEL,
        purpose: 'document',
        dimension: KNOWLEDGE_EMBEDDING_DIMENSION,
      });
      expect(call.texts.length).toBeLessThanOrEqual(BATCH);
    }
    const stored = await vectorsOf(version.id);
    expect(stored.map((row) => row.chunk_id)).toEqual(chunks.map((chunk) => chunk.id));
    stored.forEach((row, i) => {
      expect(row).toMatchObject({
        organization_id: organizationId,
        source_id: source.id,
        document_id: documentId,
        version_id: version.id,
        content_hash: chunks[i]!.contentHash,
        provider: 'fake',
        model: FAKE_EMBEDDING_MODEL,
        dimension: KNOWLEDGE_EMBEDDING_DIMENSION,
        embedding_version: KNOWLEDGE_EMBEDDING_VERSION,
        dims: KNOWLEDGE_EMBEDDING_DIMENSION,
      });
      expect(Math.abs(row.norm - 1)).toBeLessThan(1e-6);
      // The chunk's own vector, as the provider gave it, kept at single precision.
      const expected = fakeEmbedding(chunks[i]!.content, KNOWLEDGE_EMBEDDING_DIMENSION);
      row.head.forEach((value, k) => expect(value).toBeCloseTo(expected[k]!, 6));
    });
    // What the API tells: the run, never a vector.
    const read = expectStatus(await admin.get(`/ai/knowledge/versions/${version.id}`), 200)
      .body as KnowledgeVersionView;
    expect(read.embedding).toEqual(view.embedding);
    const status = expectStatus(await admin.get('/ai/knowledge/status'), 200)
      .body as KnowledgeStatus;
    expect(status.embeddings).toBe(
      await prisma.knowledgeChunkEmbedding.count({ where: { organizationId, ...CONTRACT } }),
    );
    const detail = expectStatus(await admin.get(`/ai/knowledge/sources/${source.id}`), 200).body;
    for (const body of [view, read, status, detail]) {
      expect(JSON.stringify(body)).not.toMatch(/\[-?\d\.\d+/);
    }
  });

  it('is idempotent: an embedded version is refused again, and two jobs at once embed it once', async () => {
    const { version } = await ready();
    await embedViaApi(version.id);
    const before = await vectorsOf(version.id);
    const mark = provider.calls.length;
    const again = await admin.post(`/ai/knowledge/versions/${version.id}/embed`);
    expect(again.status).toBe(409);
    expect(problemCode(again)).toBe('knowledge_version_embedded');
    expect(await embedding.embed(version.id)).toEqual({
      status: 'skipped',
      reason: 'already_embedded',
    });
    expect(provider.calls.length).toBe(mark);
    expect(await vectorsOf(version.id)).toEqual(before);

    // A run that failed, taken up by two jobs at once: one embeds, the other finds it taken.
    const twice = await ready();
    provider.next('unavailable');
    expect((await embedViaApi(twice.version.id)).embedding).toMatchObject({
      status: 'failed',
      failureCode: 'provider_unavailable',
      embedded: 0,
    });
    const start = provider.calls.length;
    const outcomes = await Promise.all([
      embedding.embed(twice.version.id),
      embedding.embed(twice.version.id),
    ]);
    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(['embedded', 'skipped']);
    const total = (await chunksOf(twice.version.id)).length;
    expect(provider.calls.length - start).toBe(Math.ceil(total / BATCH));
    expect(await vectorsOf(twice.version.id)).toHaveLength(total);
    expect(await runOf(twice.version.id)).toMatchObject({ status: 'embedded', attempts: 2 });
  });

  it('goes on from where a failed run stopped: only chunks without a valid vector are embedded again', async () => {
    const { version } = await ready(courseNotes(3));
    const chunks = await chunksOf(version.id);
    expect(chunks.length).toBeGreaterThan(BATCH);
    provider.next('ok', 'unavailable');
    const failed = await embedViaApi(version.id);
    expect(failed.embedding).toMatchObject({
      status: 'failed',
      failureCode: 'provider_unavailable',
      embedded: BATCH,
      total: chunks.length,
    });
    const kept = await vectorsOf(version.id);
    expect(kept.map((row) => row.chunk_id)).toEqual(chunks.slice(0, BATCH).map((c) => c.id));
    expect((await stateEntry(version.id, 'failed')).after).toEqual({
      status: 'failed',
      failureCode: 'provider_unavailable',
      stage: 'embedding',
      batches: 1,
      attempt: 1,
      transient: true,
    });

    // Taken up again: the rest alone, and what was written stays as it was.
    const resumed = provider.calls.length;
    const done = await embedViaApi(version.id);
    expect(done.embedding).toMatchObject({
      status: 'embedded',
      embedded: chunks.length,
      total: chunks.length,
      failureCode: null,
    });
    expect(provider.calls.slice(resumed).flatMap((call) => call.texts)).toEqual(
      chunks.slice(BATCH).map((chunk) => chunk.content),
    );
    expect((await vectorsOf(version.id)).slice(0, BATCH)).toEqual(kept);
    expect(await runOf(version.id)).toMatchObject({ attempts: 2 });

    // On the queue, a failure that may pass goes back to it while retries are left…
    const queued = await ready();
    provider.next('unavailable');
    await embedViaApi(queued.version.id);
    provider.next('rate_limited');
    await expect(embedding.embed(queued.version.id, { final: false })).rejects.toThrow(
      /tried again \(provider_rate_limited\)/,
    );
    expect(await runOf(queued.version.id)).toMatchObject({
      status: 'failed',
      failureCode: 'provider_rate_limited',
    });
    // …one that will not pass ends there, and the last attempt ends whatever it was.
    provider.next('auth');
    expect(await embedding.embed(queued.version.id, { final: false })).toEqual({
      status: 'failed',
      code: 'provider_auth',
      transient: false,
    });
    provider.next('unavailable');
    expect(await embedding.embed(queued.version.id, { final: true })).toEqual({
      status: 'failed',
      code: 'provider_unavailable',
      transient: true,
    });
    expect((await embedding.embed(queued.version.id)).status).toBe('embedded');
  });

  it('refuses what is not a vector of the schema’s dimension, and stores nothing of it', async () => {
    const { version } = await ready();
    const chunks = await chunksOf(version.id);
    for (const [plan, code] of [
      ['short', 'wrong_dimension'],
      ['long', 'wrong_dimension'],
      ['missing', 'wrong_dimension'],
      ['nan', 'invalid_vector'],
    ] as const) {
      provider.next(plan);
      const view = await embedViaApi(version.id);
      expect(view.embedding, plan).toMatchObject({
        status: 'failed',
        failureCode: code,
        embedded: 0,
      });
      expect(await vectorsOf(version.id), plan).toEqual([]);
      expect((await stateEntry(version.id, 'failed')).after, plan).toMatchObject({
        failureCode: code,
        transient: false,
      });
    }

    // The database holds the same line on its own: another dimension, a vector not of unit length,
    // a contract of another dimension, a hash that is not one.
    const [chunk] = chunks;
    const unit = fakeEmbedding('x', KNOWLEDGE_EMBEDDING_DIMENSION);
    await expect(insertVector(chunk!, { vector: literal(unit.slice(1)) })).rejects.toThrow(
      /expected 768 dimensions/,
    );
    await expect(
      insertVector(chunk!, { vector: literal(unit.map((value) => value * 2)) }),
    ).rejects.toThrow(/knowledge_chunk_embeddings_unit_length_check/);
    await expect(insertVector(chunk!, { dimension: 1536 })).rejects.toThrow(
      /knowledge_chunk_embeddings_dimension_check/,
    );
    await expect(insertVector(chunk!, { hash: 'not-a-hash' })).rejects.toThrow(
      /knowledge_chunk_embeddings_content_hash_check/,
    );
    expect(await vectorsOf(version.id)).toEqual([]);

    // Answered properly, the same version embeds.
    expect((await embedViaApi(version.id)).embedding).toMatchObject({
      status: 'embedded',
      embedded: chunks.length,
    });
  });

  it('fails in its own codes on each provider failure, and rests a model that keeps failing', async () => {
    const { version } = await ready();
    for (const [plan, code] of [
      ['rate_limited', 'provider_rate_limited'],
      ['auth', 'provider_auth'],
      ['bad_request', 'provider_bad_request'],
      ['hang', 'provider_timeout'],
    ] as const) {
      provider.next(plan);
      const view = await embedViaApi(version.id);
      expect(view.embedding, plan).toMatchObject({ status: 'failed', failureCode: code });
      expect(JSON.stringify(view), plan).not.toMatch(/httpStatus|retryAfter|RESOURCE_EXHAUSTED/);
    }

    // Five failures in a row rest the model: the next run calls nothing, and says the provider is unavailable.
    circuits.circuitOf('fake', FAKE_EMBEDDING_MODEL).succeeded();
    provider.next('unavailable', 'unavailable', 'unavailable', 'unavailable', 'unavailable');
    for (let i = 0; i < 5; i += 1) await embedViaApi(version.id);
    expect(circuits.state('fake', FAKE_EMBEDDING_MODEL)).toBe('open');
    const mark = provider.calls.length;
    const started = new Date();
    expect((await embedViaApi(version.id)).embedding).toMatchObject({
      status: 'failed',
      failureCode: 'provider_unavailable',
    });
    expect(provider.calls.length).toBe(mark);
    // A call never made is no call in the ledger.
    expect(
      await prisma.aiRequest.count({
        where: { feature: 'knowledge', userId: adminId, createdAt: { gte: started } },
      }),
    ).toBe(0);
    circuits.circuitOf('fake', FAKE_EMBEDDING_MODEL).succeeded();

    // A run that outlasts its own deadline stops there, as a failure that may pass.
    const limits = KNOWLEDGE_EMBEDDING_LIMITS as { deadlineMs: number };
    const deadline = limits.deadlineMs;
    limits.deadlineMs = -1;
    try {
      expect((await embedViaApi(version.id)).embedding).toMatchObject({
        status: 'failed',
        failureCode: 'processing_timeout',
      });
      expect((await stateEntry(version.id, 'failed')).after).toMatchObject({
        failureCode: 'processing_timeout',
        transient: true,
      });
    } finally {
      limits.deadlineMs = deadline;
    }
    expect((await embedViaApi(version.id)).embedding).toMatchObject({ status: 'embedded' });
  });

  it('embeds only what may be drawn on: chunked, current, published, active, public or course data', async () => {
    const refused = async (versionId: string, code: string) => {
      const res = await admin.post(`/ai/knowledge/versions/${versionId}/embed`);
      expect(res.status, code).toBe(409);
      expect(problemCode(res), code).toBe('knowledge_version_not_embeddable');
      expect((res.body as { detail: string }).detail, code).toContain(`(${code})`);
      expect(await runOf(versionId), code).toBeNull();
    };
    const mark = provider.calls.length;

    const pending = await fresh();
    await refused(pending.version.id, 'not_chunked');
    const draft = await fresh(courseNotes(1));
    await ingestViaApi(draft.version.id);
    await refused(draft.version.id, 'not_published');
    // Personal data never, though the provider is approved for it on this installation.
    const personal = await ready(JAVA_INHERITANCE_TEXT, { dataClass: 'personal' });
    await refused(personal.version.id, 'data_class_held_back');
    const stale = await ready(JAVA_INHERITANCE_TEXT);
    const newer = await newVersion(stale.documentId, `${JAVA_INHERITANCE_TEXT}\n\nMore.`);
    await ingestViaApi(newer.id);
    await refused(stale.version.id, 'not_current');
    const shelved = await ready(JAVA_INHERITANCE_TEXT);
    await prisma.knowledgeDocument.update({
      where: { id: shelved.documentId },
      data: { status: 'archived' },
    });
    await refused(shelved.version.id, 'document_archived');
    const closed = await ready(JAVA_INHERITANCE_TEXT);
    expectStatus(await admin.post(`/ai/knowledge/sources/${closed.source.id}/archive`), 200);
    await refused(closed.version.id, 'source_archived');
    // Course data, once the institute narrows what the provider may be given to public data.
    const coursework = await ready(JAVA_INHERITANCE_TEXT, { dataClass: 'course' });
    await settle({ dataClasses: ['public'] });
    try {
      await refused(coursework.version.id, 'data_class_not_approved');
    } finally {
      await settle({ dataClasses: null });
    }
    expect(provider.calls.length).toBe(mark);

    // The job asks again for itself: a run asked for while the version could be embedded embeds
    // nothing once it cannot.
    const late = await ready(JAVA_INHERITANCE_TEXT);
    await prisma.knowledgeVersionEmbedding.create({
      data: {
        organizationId,
        sourceId: late.source.id,
        documentId: late.documentId,
        versionId: late.version.id,
        ...CONTRACT,
        requestedById: adminId,
      },
    });
    await prisma.knowledgeDocument.update({
      where: { id: late.documentId },
      data: { status: 'archived' },
    });
    expect(await embedding.embed(late.version.id)).toEqual({
      status: 'failed',
      code: 'document_archived',
      transient: false,
    });
    await prisma.knowledgeDocument.update({
      where: { id: late.documentId },
      data: { status: 'active' },
    });
    await prisma.knowledgeVersionEmbedding.create({
      data: {
        organizationId,
        sourceId: coursework.source.id,
        documentId: coursework.documentId,
        versionId: coursework.version.id,
        ...CONTRACT,
        requestedById: adminId,
      },
    });
    await settle({ dataClasses: ['public'] });
    try {
      expect(await embedding.embed(coursework.version.id)).toEqual({
        status: 'failed',
        code: 'data_class_not_approved',
        transient: false,
      });
    } finally {
      await settle({ dataClasses: null });
    }
    expect(provider.calls.length).toBe(mark);
    expect(await vectorsOf(late.version.id)).toEqual([]);
    expect(await vectorsOf(coursework.version.id)).toEqual([]);
    // Allowed again, both embed.
    expect((await embedding.embed(late.version.id)).status).toBe('embedded');
    expect((await embedViaApi(coursework.version.id)).embedding).toMatchObject({
      status: 'embedded',
    });
  });

  it('keeps to its institute: another institute’s version is neither found, nor taken, nor written to', async () => {
    const orgB = await prisma.organization.create({
      data: { key: `ai8c-b-${unique}`, name: 'Institute B' },
    });
    const sourceB = await prisma.knowledgeSource.create({
      data: {
        organizationId: orgB.id,
        name: 'B',
        type: 'authored',
        audience: 'institute',
        dataClass: 'public',
        status: 'published',
        publishedAt: new Date(),
      },
    });
    const documentB = await prisma.knowledgeDocument.create({
      data: { organizationId: orgB.id, sourceId: sourceB.id, title: 'B', canonicalRef: 'b:doc' },
    });
    const content = 'Institute B knowledge.';
    const hash = knowledgeContentHash(content);
    const fileB = await prisma.file.create({
      data: {
        organizationId: orgB.id,
        ownerType: 'knowledge-version',
        driver: storage.name,
        bucket: storage.bucketName('private'),
        key: `ai8c-b/knowledge/${documentB.id}/b.md`,
        originalName: 'b.md',
        mime: 'text/markdown',
        size: content.length,
        checksum: hash,
        visibility: 'private',
        status: 'ready',
      },
    });
    const versionB = await prisma.knowledgeDocumentVersion.create({
      data: {
        organizationId: orgB.id,
        sourceId: sourceB.id,
        documentId: documentB.id,
        version: 1,
        contentHash: hash,
        fileId: fileB.id,
        characterCount: content.length,
        status: 'chunked',
        isCurrent: true,
        chunkCount: 1,
        chunkedAt: new Date(),
      },
    });
    const chunkB = await prisma.knowledgeChunk.create({
      data: {
        organizationId: orgB.id,
        sourceId: sourceB.id,
        documentId: documentB.id,
        versionId: versionB.id,
        position: 0,
        content,
        contentHash: hash,
        characterCount: content.length,
        tokenEstimate: 6,
      },
    });
    const runB = await prisma.knowledgeVersionEmbedding.create({
      data: {
        organizationId: orgB.id,
        sourceId: sourceB.id,
        documentId: documentB.id,
        versionId: versionB.id,
        ...CONTRACT,
        requestedById: adminId,
      },
    });
    const mark = provider.calls.length;
    expect(await embedding.embed(versionB.id)).toEqual({ status: 'skipped', reason: 'not_found' });
    for (const res of [
      await admin.post(`/ai/knowledge/versions/${versionB.id}/embed`),
      await admin.get(`/ai/knowledge/versions/${versionB.id}`),
    ]) {
      expect(res.status).toBe(404);
    }
    expect(
      await prisma.knowledgeVersionEmbedding.findUniqueOrThrow({ where: { id: runB.id } }),
    ).toMatchObject({ status: 'pending', attempts: 0 });
    expect(provider.calls.length).toBe(mark);
    // A vector is filed under its chunk's whole provenance: none of this institute's can claim the other's chunk.
    await expect(insertVector(chunkB, { organizationId })).rejects.toThrow(/foreign key/);
    expect(await prisma.knowledgeChunkEmbedding.count({ where: { chunkId: chunkB.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { resourceId: versionB.id } })).toBe(0);
  });

  it('lets one run hold a version: another waits out its lease, and a run that lost it writes nothing', async () => {
    const { version } = await ready();
    provider.next('unavailable');
    await embedViaApi(version.id);
    const run = (await runOf(version.id))!;
    // Held now by another run.
    await prisma.knowledgeVersionEmbedding.update({
      where: { id: run.id },
      data: { status: 'embedding', claimedAt: new Date() },
    });
    const mark = provider.calls.length;
    const busy = await admin.post(`/ai/knowledge/versions/${version.id}/embed`);
    expect(busy.status).toBe(409);
    expect(problemCode(busy)).toBe('knowledge_embedding_running');
    expect(await embedding.embed(version.id)).toEqual({ status: 'skipped', reason: 'in_progress' });
    expect(provider.calls.length).toBe(mark);
    // Its lease lapsed: taken over, and finished.
    await prisma.knowledgeVersionEmbedding.update({
      where: { id: run.id },
      data: { claimedAt: new Date(Date.now() - 11 * 60_000) },
    });
    expect(await embedding.embed(version.id)).toMatchObject({ status: 'embedded' });

    // Taken over while it was embedding: the run that lost the version writes no vector, and its
    // call still counts.
    const other = await ready();
    provider.next('unavailable');
    await embedViaApi(other.version.id);
    const otherRun = (await runOf(other.version.id))!;
    const takeover = new Date(Date.now() + 1_000);
    provider.next(async () => {
      await prisma.knowledgeVersionEmbedding.update({
        where: { id: otherRun.id },
        data: { claimedAt: takeover },
      });
    });
    const started = new Date();
    expect(await embedding.embed(other.version.id)).toEqual({
      status: 'skipped',
      reason: 'claim_lost',
    });
    expect(await vectorsOf(other.version.id)).toEqual([]);
    expect(await runOf(other.version.id)).toMatchObject({
      status: 'embedding',
      claimedAt: takeover,
      embeddedCount: 0,
    });
    expect(
      await prisma.aiRequest.count({
        where: {
          feature: 'knowledge',
          outcome: 'ok',
          userId: adminId,
          createdAt: { gte: started },
        },
      }),
    ).toBe(1);
    await prisma.knowledgeVersionEmbedding.update({
      where: { id: otherRun.id },
      data: { claimedAt: new Date(Date.now() - 11 * 60_000) },
    });
    expect(await embedding.embed(other.version.id)).toMatchObject({ status: 'embedded' });
  });

  it('keeps vectors only while they can be drawn on: older versions, other contracts, stale hashes, archived sources', async () => {
    const first = await ready(courseNotes(1));
    await embedViaApi(first.version.id);
    const firstCount = (await vectorsOf(first.version.id)).length;
    expect(firstCount).toBeGreaterThan(0);
    // A newer version, chunked: the older one's vectors stay until the newer one's are complete.
    const second = await newVersion(first.documentId, courseNotes(2));
    await ingestViaApi(second.id);
    expect(await vectorsOf(first.version.id)).toHaveLength(firstCount);
    // A vector made under another contract is never the active contract's: not shown, not counted, not kept.
    const secondChunks = await chunksOf(second.id);
    await insertVector(secondChunks[0]!, { model: 'fake-embedding-0' });
    await prisma.knowledgeVersionEmbedding.create({
      data: {
        organizationId,
        sourceId: first.source.id,
        documentId: first.documentId,
        versionId: second.id,
        ...CONTRACT,
        model: 'fake-embedding-0',
        status: 'embedded',
        chunkCount: 1,
        embeddedCount: 1,
        embeddedAt: new Date(),
      },
    });
    const before = expectStatus(await admin.get(`/ai/knowledge/versions/${second.id}`), 200)
      .body as KnowledgeVersionView;
    expect(before.embedding).toBeNull();
    const done = await embedViaApi(second.id);
    expect(done.embedding).toMatchObject({ status: 'embedded', embedded: secondChunks.length });
    expect(await vectorsOf(first.version.id)).toEqual([]);
    expect(
      await prisma.knowledgeVersionEmbedding.count({ where: { versionId: first.version.id } }),
    ).toBe(0);
    const left = await vectorsOf(second.id);
    expect(left.map((row) => row.model)).toEqual(secondChunks.map(() => FAKE_EMBEDDING_MODEL));
    expect(await prisma.knowledgeVersionEmbedding.count({ where: { versionId: second.id } })).toBe(
      1,
    );
    expect((await stateEntry(second.id, 'embedded')).after).toMatchObject({
      purged: firstCount + 1,
    });

    // A vector whose chunk's hash it no longer matches is no valid vector: asking again embeds that
    // chunk alone, in place.
    await prisma.$executeRaw`
      UPDATE knowledge_chunk_embeddings SET content_hash = ${'0'.repeat(64)} WHERE id = ${left[0]!.id}::uuid`;
    const mark = provider.calls.length;
    expect((await embedViaApi(second.id)).embedding).toMatchObject({
      status: 'embedded',
      embedded: secondChunks.length,
    });
    expect(provider.calls.slice(mark).map((call) => call.texts)).toEqual([
      [secondChunks[0]!.content],
    ]);
    const renewed = await vectorsOf(second.id);
    expect(renewed[0]).toMatchObject({
      id: left[0]!.id,
      content_hash: secondChunks[0]!.contentHash,
    });

    // A vector never outlives its chunk.
    await prisma.knowledgeChunk.delete({ where: { id: secondChunks.at(-1)!.id } });
    expect(await vectorsOf(second.id)).toHaveLength(secondChunks.length - 1);

    // Archived, every vector of the source goes at once.
    expectStatus(await admin.post(`/ai/knowledge/sources/${first.source.id}/archive`), 200);
    expect(
      await prisma.knowledgeChunkEmbedding.count({ where: { sourceId: first.source.id } }),
    ).toBe(0);
    expect(
      await prisma.knowledgeVersionEmbedding.count({ where: { sourceId: first.source.id } }),
    ).toBe(0);
    const archived = await prisma.auditLog.findFirstOrThrow({
      where: { resourceId: first.source.id, action: 'ai.knowledge.source.archived' },
    });
    expect(archived.after).toEqual({ embeddingsPurged: secondChunks.length - 1 });
  });

  it('records each call in the ledger and the budget, and never in the requester’s own allowance', async () => {
    const manager = await signedIn(SYSTEM_ROLES.SUPER_ADMIN, 'ledger');
    const { version } = await ready();
    const chunks = await chunksOf(version.id);
    const allowance = await usage.allowance(manager.auth.id);
    try {
      await embedViaApi(version.id, manager.session);
    } finally {
      // No other spec may meet a Super Admin it did not expect (the Phase 6 last-one rule).
      await prisma.user.update({ where: { id: manager.auth.id }, data: { status: 'suspended' } });
    }
    const ledger = await prisma.aiRequest.findMany({
      where: { userId: manager.auth.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(ledger).toHaveLength(Math.ceil(chunks.length / BATCH));
    for (const row of ledger) {
      expect(row).toMatchObject({
        organizationId,
        feature: 'knowledge',
        task: 'embed',
        dataClass: 'public',
        provider: 'fake',
        model: FAKE_EMBEDDING_MODEL,
        outcome: 'ok',
        fallback: false,
        outputTokens: 0,
        conversationId: null,
        messageId: null,
        countsAsQuestion: false,
        tokensEstimated: true,
      });
      expect(row.inputTokens).toBeGreaterThan(0);
      expect(row.estimatedCostMicros).toBe(toMicros((row.inputTokens * 0.02) / 1_000_000));
    }
    const tokens = chunks.reduce((sum, chunk) => sum + Math.ceil(chunk.content.length / 4), 0);
    expect(ledger.reduce((sum, row) => sum + row.inputTokens, 0)).toBe(tokens);
    const { day, monthStart } = await usage.today();
    expect(
      await prisma.aiUsageDaily.findUniqueOrThrow({
        where: { userId_day: { userId: manager.auth.id, day } },
      }),
    ).toMatchObject({
      requests: 0,
      inputTokens: tokens,
      outputTokens: 0,
      totalTokens: tokens,
      estimatedRequests: ledger.length,
      estimatedCostMicros: ledger.reduce((sum, row) => sum + (row.estimatedCostMicros ?? 0), 0),
    });
    // The institute's work, not the person's: their own allowance is as it was.
    expect(await usage.allowance(manager.auth.id)).toEqual(allowance);

    // At the institute's budget, nothing is called; with a budget and no price, nothing either.
    const payer = await signedIn(SYSTEM_ROLES.STUDENT, 'payer');
    const blocked = await ready(courseNotes(1));
    await settle({ monthlyBudgetUsd: 1 });
    const mark = provider.calls.length;
    try {
      const elsewhere = await usage.spentSince(organizationId, monthStart);
      await prisma.aiUsageDaily.create({
        data: {
          organizationId,
          userId: payer.auth.id,
          day,
          estimatedCostMicros: Math.max(0, 1_000_000 - elsewhere),
        },
      });
      expect((await embedViaApi(blocked.version.id)).embedding).toMatchObject({
        status: 'failed',
        failureCode: 'budget_exceeded',
      });
      await prisma.aiUsageDaily.deleteMany({ where: { userId: payer.auth.id } });
      const unpriced = vi.spyOn(router, 'costOf').mockReturnValue(null);
      try {
        expect((await embedViaApi(blocked.version.id)).embedding).toMatchObject({
          status: 'failed',
          failureCode: 'unpriced_model',
        });
      } finally {
        unpriced.mockRestore();
      }
      expect(provider.calls.length).toBe(mark);
      // Priced, and below the budget: embedded.
      expect((await embedViaApi(blocked.version.id)).embedding).toMatchObject({
        status: 'embedded',
      });
    } finally {
      await prisma.aiUsageDaily.deleteMany({ where: { userId: payer.auth.id } });
      await settle({ monthlyBudgetUsd: null });
    }
  });

  it('audits each step by ids, codes and counts — never content, a vector or a key — and logs likewise', async () => {
    const { version } = await ready();
    const chunks = await chunksOf(version.id);
    await embedViaApi(version.id);
    const audit = await prisma.auditLog.findMany({
      where: { resourceId: version.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(audit.map((entry) => entry.action)).toEqual([
      'ai.knowledge.version.created',
      'ai.knowledge.ingestion.requested',
      'ai.knowledge.version.ingestion',
      'ai.knowledge.chunks.recorded',
      'ai.knowledge.version.ingestion',
      'ai.knowledge.embedding.requested',
      'ai.knowledge.embedding',
      'ai.knowledge.embedding',
    ]);
    expect(audit[5]!.after).toEqual({ documentId: expect.any(String), ...CONTRACT });
    expect(audit[6]!.after).toEqual({ status: 'embedding', attempt: 1, ...CONTRACT });
    expect(audit[7]!.after).toEqual({
      status: 'embedded',
      embedded: chunks.length,
      total: chunks.length,
      batches: Math.ceil(chunks.length / BATCH),
      attempt: 1,
      purged: 0,
      durationMs: expect.any(Number),
      ...CONTRACT,
    });
    const everything = await prisma.auditLog.findMany({
      where: { action: { startsWith: 'ai.knowledge.embedding' } },
    });
    const text = JSON.stringify([everything, logged]);
    for (const marker of [...CONTENT_MARKERS, chunks[0]!.content.slice(0, 40)]) {
      expect(text).not.toContain(marker);
    }
    // No vector either: no list of numbers in the audit, nor a component of one in the logs — one
    // that is not nought, as most of the fake's are.
    const [component] = await prisma.$queryRaw<{ value: number }[]>`
      SELECT x AS value FROM knowledge_chunk_embeddings e, unnest(e.embedding::real[]) x
      WHERE e.version_id = ${version.id}::uuid AND x <> 0 AND length(x::text) >= 8
      LIMIT 1`;
    expect(JSON.stringify(everything)).not.toMatch(/\[-?\d\.\d+/);
    expect(text).not.toContain(String(component!.value).slice(0, 9));
    expect(JSON.stringify(everything)).not.toMatch(/api.?key|secret|password/i);
    // The log says what was done, by numbers.
    expect(JSON.stringify(logged)).toContain('"task":"embed"');
  });

  it('files each vector with what retrieval will filter on, under its chunk’s own provenance', async () => {
    const own = await course('meta');
    const lessonId = own.modules[0]!.lessons[0]!.id;
    const source = await newSource({ audience: 'course', courseId: own.id, dataClass: 'course' });
    const documentId = await newDocument(source.id, { lessonId });
    const version = await newVersion(documentId, courseNotes(1));
    await ingestViaApi(version.id);
    expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/publish`), 200);
    await embedViaApi(version.id);
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT e.organization_id::text AS "organizationId", e.source_id::text AS "sourceId",
             e.document_id::text AS "documentId", e.version_id::text AS "versionId",
             e.chunk_id::text AS "chunkId", e.content_hash = c.content_hash AS "hashMatches",
             s.audience::text AS audience, s.course_id::text AS "courseId",
             d.lesson_id::text AS "lessonId", s.data_class AS "dataClass",
             s.status::text AS "sourceStatus", d.status::text AS "documentStatus",
             v.is_current AS "isCurrent"
      FROM knowledge_chunk_embeddings e
      JOIN knowledge_chunks c ON c.id = e.chunk_id
      JOIN knowledge_document_versions v ON v.id = e.version_id
      JOIN knowledge_documents d ON d.id = e.document_id
      JOIN knowledge_sources s ON s.id = e.source_id
      WHERE e.version_id = ${version.id}::uuid`;
    expect(rows.length).toBe((await chunksOf(version.id)).length);
    for (const row of rows) {
      expect(row).toEqual({
        organizationId,
        sourceId: source.id,
        documentId,
        versionId: version.id,
        chunkId: expect.any(String),
        hashMatches: true,
        audience: 'course',
        courseId: own.id,
        lessonId,
        dataClass: 'course',
        sourceStatus: 'published',
        documentStatus: 'active',
        isCurrent: true,
      });
    }
    // A vector decides nothing about who may draw on its chunk: the reach rule does, as before.
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'meta');
    expect(await reach.mayRetrieve(learner.auth, rows[0]!['chunkId'] as string)).toBe(false);
  });

  it('stands on the HNSW cosine index and the checks the migration made, which Prisma cannot describe', async () => {
    const [index] = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'knowledge_chunk_embeddings'
        AND indexname = 'knowledge_chunk_embeddings_embedding_hnsw_idx'`;
    expect(index?.indexdef).toContain('USING hnsw (embedding vector_cosine_ops)');
    const checks = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname::text FROM pg_constraint
      WHERE conrelid IN ('knowledge_chunk_embeddings'::regclass, 'knowledge_version_embeddings'::regclass)
        AND contype = 'c'
      ORDER BY conname`;
    expect(checks.map((check) => check.conname)).toEqual([
      'knowledge_chunk_embeddings_content_hash_check',
      'knowledge_chunk_embeddings_dimension_check',
      'knowledge_chunk_embeddings_unit_length_check',
      'knowledge_version_embeddings_claim_check',
      'knowledge_version_embeddings_counts_check',
      'knowledge_version_embeddings_dimension_check',
      'knowledge_version_embeddings_embedded_check',
    ]);
    const [column] = await prisma.$queryRaw<{ type: string }[]>`
      SELECT format_type(atttypid, atttypmod) AS type FROM pg_attribute
      WHERE attrelid = 'knowledge_chunk_embeddings'::regclass AND attname = 'embedding'`;
    expect(column?.type).toBe('vector(768)');
    // An ordering by cosine distance can take the index (retrieval itself is Phase 8D's).
    const query = literal(fakeEmbedding('What is inheritance?', KNOWLEDGE_EMBEDDING_DIMENSION));
    const plan = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
      return tx.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
        `EXPLAIN SELECT id FROM knowledge_chunk_embeddings ORDER BY embedding <=> '${query}'::vector LIMIT 5`,
      );
    });
    expect(plan.map((row) => row['QUERY PLAN']).join('\n')).toContain(
      'knowledge_chunk_embeddings_embedding_hnsw_idx',
    );
  });

  it('embeds a moderately sized document within its limits, a batch at a time', async () => {
    const { version } = await ready(courseNotes(40));
    const chunks = await chunksOf(version.id);
    expect(chunks.length).toBeGreaterThan(80);
    const mark = provider.calls.length;
    const started = Date.now();
    const view = await embedViaApi(version.id);
    const elapsed = Date.now() - started;
    expect(view.embedding).toMatchObject({ status: 'embedded', embedded: chunks.length });
    const calls = provider.calls.slice(mark);
    expect(calls).toHaveLength(Math.ceil(chunks.length / BATCH));
    expect(Math.max(...calls.map((call) => call.texts.length))).toBe(BATCH);
    expect(elapsed).toBeLessThan(30_000);
    const done = (await stateEntry(version.id, 'embedded')).after as {
      durationMs: number;
      batches: number;
    };
    expect(done.batches).toBe(calls.length);
    expect(done.durationMs).toBeLessThan(30_000);
  });
});
