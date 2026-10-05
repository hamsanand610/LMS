import { Logger, type INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import {
  AI_KNOWLEDGE_ANSWERS_FLAG,
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  SYSTEM_ROLES,
  type KnowledgeAnswer,
  type KnowledgeRetrieval,
  type KnowledgeSourceView,
  type KnowledgeVersionView,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../src/core/storage/storage.driver.js';
import { INSTRUCTION_FINGERPRINTS } from '../src/modules/ai/knowledge/answers/grounded-prompt.js';
import { KnowledgeEmbeddingService } from '../src/modules/ai/knowledge/embedding/embedding.service.js';
import { KnowledgeIngestionService } from '../src/modules/ai/knowledge/ingestion/ingestion.service.js';
import { KnowledgeService } from '../src/modules/ai/knowledge/knowledge.service.js';
import { credentialsIn } from '../src/modules/ai/policy/data-class.js';
import { FAKE_EMBEDDING_MODEL } from '../src/modules/ai/providers/fake.provider.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { AttemptsService } from '../src/modules/tests/index.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { ScriptedGroundedProvider } from './setup/scripted-grounded.provider.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const AI_ENV = {
  AI_PROVIDER: 'fake',
  AI_TIMEOUT_MS: '5000',
  AI_DATA_CLASSES: 'public,course',
  AI_MODEL_COSTS: `fake-1=1/2,${FAKE_EMBEDDING_MODEL}=0.02/0`,
};
const FLAGS = [AI_MODULE_FLAG, AI_KNOWLEDGE_FLAG, AI_KNOWLEDGE_ANSWERS_FLAG];

/**
 * Phase 8F: the knowledge base's whole life, end to end, as the platform lives it — a source
 * created and published, its document versioned, ingested and embedded (each after a failure),
 * retrieved and answered from; a newer version taking its place; the source archived. Then what it
 * all left behind: the ledger, the audit and the logs hold ids, counts and codes — never the
 * knowledge's text, a question, an answer, the instructions or a key. And each step taken twice, or
 * twice at once, changes nothing the second time.
 */
describe('SI Academy AI — the knowledge lifecycle, closed (Phase 8F)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageDriver;
  let ingestion: KnowledgeIngestionService;
  let embedding: KnowledgeEmbeddingService;
  let admin: Session;
  let organizationId = '';
  let started = new Date();
  const provider = new ScriptedGroundedProvider();
  const logged: unknown[][] = [];
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;
  /** What the records must never hold: the knowledge's words, the questions and the answers. */
  const neverRecorded: string[] = [];

  async function signedIn(roleKey: string, label: string) {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key: roleKey } });
    const email = `ai8f-${label}-${counter}-${unique}@test.local`;
    await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI 8F ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
        studentProfile: {
          create: { studentCode: `STU-AI8F-${counter}-${unique}`, status: 'active' },
        },
      },
    });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    return session;
  }

  async function setFlag(key: string, enabled: boolean) {
    expectStatus(await admin.patch(`/flags/${key}`, { enabled }), 200);
  }

  async function newVersion(documentId: string, content: string) {
    return expectStatus(
      await admin.post(`/ai/knowledge/documents/${documentId}/versions`, {
        content,
        format: 'markdown',
      }),
      201,
    ).body as KnowledgeVersionView;
  }

  /** Ingestion and embedding asked for through the API; the queue runs them inline in tests. */
  const ingest = async (versionId: string) =>
    expectStatus(await admin.post(`/ai/knowledge/versions/${versionId}/ingest`), 202)
      .body as KnowledgeVersionView;
  const embed = async (versionId: string) =>
    expectStatus(await admin.post(`/ai/knowledge/versions/${versionId}/embed`), 202)
      .body as KnowledgeVersionView;
  const retrieve = async (session: Session, query: string) =>
    expectStatus(await session.post('/ai/knowledge/retrieve', { query }), 200)
      .body as KnowledgeRetrieval;
  const answer = async (session: Session, query: string) => {
    const body = expectStatus(await session.post('/ai/knowledge/answer', { query }), 200)
      .body as KnowledgeAnswer;
    neverRecorded.push(body.answer);
    return body;
  };
  const chunksOf = (versionId: string) =>
    prisma.knowledgeChunk.findMany({ where: { versionId }, orderBy: { position: 'asc' } });
  const vectorsOf = (versionId: string) =>
    prisma.knowledgeChunkEmbedding.count({ where: { versionId } });
  const isCurrent = async (versionId: string) =>
    (await prisma.knowledgeDocumentVersion.findUniqueOrThrow({ where: { id: versionId } }))
      .isCurrent;

  beforeAll(async () => {
    Object.assign(process.env, AI_ENV);
    app = await createTestApp({ aiProvider: provider });
    prisma = app.get(PrismaService);
    storage = app.get<StorageDriver>(STORAGE_DRIVER);
    ingestion = app.get(KnowledgeIngestionService);
    embedding = app.get(KnowledgeEmbeddingService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    for (const key of FLAGS) await setFlag(key, true);
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
    started = new Date();
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    for (const key of FLAGS) await setFlag(key, false);
    await app.close();
    for (const key of Object.keys(AI_ENV)) delete process.env[key];
  });

  it('lives a source’s whole life: published, versioned, ingested and embedded after a failure each, retrieved and answered — then replaced by its next version, then archived', async () => {
    const marker = `ferrylife${unique}`;
    const first = `# ${marker} ferry\n\nThe ${marker} ferry to the island campus leaves the harbour every 20 minutes on weekdays.`;
    const second = `# ${marker} ferry\n\nThe ${marker} ferry to the island campus leaves the harbour every 30 minutes on weekdays.`;
    const question = `How often does the ${marker} ferry to the island campus leave the harbour?`;
    neverRecorded.push(marker, question);
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'life');

    // A source, written as a draft; its document; the first version, waiting.
    const source = expectStatus(
      await admin.post('/ai/knowledge/sources', {
        name: `Lifecycle ${unique}`,
        type: 'authored',
        audience: 'institute',
        dataClass: 'public',
      }),
      201,
    ).body as KnowledgeSourceView;
    const documentId = (
      expectStatus(
        await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
          title: 'Ferry timetable',
          canonicalRef: `authored:timetable-${unique}`,
        }),
        201,
      ).body as { id: string }
    ).id;
    const v1 = await newVersion(documentId, first);
    expect(v1).toMatchObject({ status: 'pending', isCurrent: false });

    // Ingestion fails safely while the stored text is missing — and recovers once it is back.
    const file = (
      await prisma.knowledgeDocumentVersion.findUniqueOrThrow({
        where: { id: v1.id },
        include: { file: true },
      })
    ).file!;
    await storage.delete('private', file.key);
    expect(await ingest(v1.id)).toMatchObject({
      status: 'failed',
      failureCode: 'missing_file',
      chunkCount: 0,
      isCurrent: false,
    });
    expect(await chunksOf(v1.id)).toHaveLength(0);
    await storage.put('private', file.key, Buffer.from(first, 'utf8'), file.mime);
    expect(await ingest(v1.id)).toMatchObject({
      status: 'chunked',
      isCurrent: true,
      failureCode: null,
    });
    const v1Chunks = await chunksOf(v1.id);
    expect(v1Chunks.length).toBeGreaterThan(0);
    // Asked again, or run again: refused, skipped — the same chunks, none twice.
    expect(problemCode(await admin.post(`/ai/knowledge/versions/${v1.id}/ingest`))).toBe(
      'knowledge_version_chunked',
    );
    expect(await ingestion.ingest(v1.id)).toEqual({ status: 'skipped', reason: 'already_chunked' });
    expect(await chunksOf(v1.id)).toEqual(v1Chunks);

    // Nothing of a draft is drawn on; published, it may be embedded.
    expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/publish`), 200);

    // Embedding fails safely while the provider is down — and resumes once it is back.
    provider.failNextEmbeds(1);
    expect((await embed(v1.id)).embedding).toMatchObject({
      status: 'failed',
      failureCode: 'provider_unavailable',
    });
    expect((await embed(v1.id)).embedding).toMatchObject({
      status: 'embedded',
      embedded: v1Chunks.length,
      total: v1Chunks.length,
      failureCode: null,
    });
    // Asked again: refused. Run twice at once: both skip. One vector per chunk, never two.
    expect(problemCode(await admin.post(`/ai/knowledge/versions/${v1.id}/embed`))).toBe(
      'knowledge_version_embedded',
    );
    expect(await Promise.all([embedding.embed(v1.id), embedding.embed(v1.id)])).toEqual([
      { status: 'skipped', reason: 'already_embedded' },
      { status: 'skipped', reason: 'already_embedded' },
    ]);
    expect(await vectorsOf(v1.id)).toBe(v1Chunks.length);

    // Retrieved and answered from version 1 — the same retrieval twice, the same passages.
    const found = await retrieve(learner, question);
    expect(found.results[0]).toMatchObject({
      document: { id: documentId },
      version: { id: v1.id },
    });
    expect(await retrieve(learner, question)).toEqual(found);
    const answered = await answer(learner, question);
    expect(answered.status).toBe('answered');
    expect(answered.citations[0]).toMatchObject({ documentId, versionId: v1.id });
    expect(answered.answer).toContain('every 20 minutes');

    // Version 2, chunked, is current; version 1 keeps its vectors until version 2 has its own, and
    // is never drawn on again meanwhile.
    const v2 = await newVersion(documentId, second);
    expect(await ingest(v2.id)).toMatchObject({ status: 'chunked', isCurrent: true });
    expect(await isCurrent(v1.id)).toBe(false);
    expect(await vectorsOf(v1.id)).toBe(v1Chunks.length);
    const between = await retrieve(learner, question);
    expect(between.results.some((result) => result.version.id === v1.id)).toBe(false);
    const meanwhile = await answer(learner, question);
    expect(meanwhile.citations.some((citation) => citation.versionId === v1.id)).toBe(false);
    expect(meanwhile.answer).not.toContain('20 minutes');

    // Version 2 embedded: version 1's vectors are gone, and the answer is version 2's.
    expect((await embed(v2.id)).embedding).toMatchObject({ status: 'embedded' });
    expect(await vectorsOf(v1.id)).toBe(0);
    expect(await vectorsOf(v2.id)).toBe((await chunksOf(v2.id)).length);
    const now = await answer(learner, question);
    expect(now.status).toBe('answered');
    expect(now.citations[0]).toMatchObject({ documentId, versionId: v2.id });
    expect(now.answer).toContain('every 30 minutes');
    expect(now.answer).not.toContain('20 minutes');

    // Archived: its vectors go at once, and nothing of it is drawn on again.
    expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/archive`), 200);
    expect(await vectorsOf(v2.id)).toBe(0);
    const gone = await retrieve(learner, question);
    expect(gone.results.some((result) => result.document.id === documentId)).toBe(false);
    const afterwards = await answer(learner, question);
    expect(afterwards.citations.some((citation) => citation.documentId === documentId)).toBe(false);
    expect(afterwards.status).toBe('insufficient_evidence');
  });

  it('takes each step twice at once without doing it twice: ingestion and embedding race for one version', async () => {
    const marker = `racelife${unique}`;
    neverRecorded.push(marker);
    const source = expectStatus(
      await admin.post('/ai/knowledge/sources', {
        name: `Lifecycle race ${unique}`,
        type: 'authored',
        audience: 'institute',
        dataClass: 'public',
      }),
      201,
    ).body as KnowledgeSourceView;
    const documentId = (
      expectStatus(
        await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
          title: 'Rowing club',
          canonicalRef: `authored:rowing-${unique}`,
        }),
        201,
      ).body as { id: string }
    ).id;
    const version = await newVersion(
      documentId,
      `# ${marker} rowing\n\nThe ${marker} rowing club trains on the river at dawn.`,
    );
    const ingested = await Promise.all([
      ingestion.ingest(version.id),
      ingestion.ingest(version.id),
    ]);
    expect(ingested.map((outcome) => outcome.status).sort()).toEqual(['chunked', 'skipped']);
    const chunks = await chunksOf(version.id);
    expect(chunks.length).toBeGreaterThan(0);
    expect(new Set(chunks.map((chunk) => chunk.position)).size).toBe(chunks.length);
    expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/publish`), 200);
    // A run asked for and failed, taken up by two jobs at once: one embeds, the other finds it taken.
    provider.failNextEmbeds(1);
    expect((await embed(version.id)).embedding).toMatchObject({ status: 'failed' });
    const embedded = await Promise.all([embedding.embed(version.id), embedding.embed(version.id)]);
    expect(embedded.map((outcome) => outcome.status).sort()).toEqual(['embedded', 'skipped']);
    expect(await vectorsOf(version.id)).toBe(chunks.length);
  });

  it('closes what the audit found (8F): no retrieval during a timed test, no credential stored, no source written in a state it has left', async () => {
    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'closure');
    const since = new Date();

    // Retrieval is AI too: nothing is embedded, searched or shown while a timed test is open.
    const embeds = provider.embeds.length;
    const open = vi.spyOn(app.get(AttemptsService), 'hasOpenAttempt').mockResolvedValue(true);
    const timed = await learner.post('/ai/knowledge/retrieve', {
      query: 'When does the ferry leave?',
    });
    open.mockRestore();
    expect(timed.status).toBe(403);
    expect(problemCode(timed)).toBe('ai_not_allowed');
    expect(provider.embeds.length).toBe(embeds);
    const [refused] = await prisma.auditLog.findMany({
      where: { action: 'ai.knowledge.retrieval', occurredAt: { gte: since } },
    });
    expect(refused?.after).toMatchObject({ status: 'refused', reason: 'timed_test' });

    // A version holding a credential is refused at the door: nothing of it is stored.
    const source = expectStatus(
      await admin.post('/ai/knowledge/sources', {
        name: `Lifecycle closure ${unique}`,
        type: 'authored',
        audience: 'institute',
        dataClass: 'public',
      }),
      201,
    ).body as KnowledgeSourceView;
    const documentId = (
      expectStatus(
        await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
          title: 'Deploy notes',
          canonicalRef: `authored:deploy-${unique}`,
        }),
        201,
      ).body as { id: string }
    ).id;
    const secret = `ghp_${'Z'.repeat(36)}`;
    neverRecorded.push(secret);
    const files = await prisma.file.count({ where: { ownerType: 'knowledge-version' } });
    const withKey = await admin.post(`/ai/knowledge/documents/${documentId}/versions`, {
      content: `# Deploys\n\nThe build server signs every release with ${secret}.`,
      format: 'markdown',
    });
    expect(withKey.status).toBe(422);
    expect(problemCode(withKey)).toBe('ai_restricted_content');
    expect(withKey.text).not.toContain(secret);
    expect(await prisma.knowledgeDocumentVersion.count({ where: { documentId } })).toBe(0);
    expect(await prisma.file.count({ where: { ownerType: 'knowledge-version' } })).toBe(files);

    // Who a source is for, written over a publication that happened since it was read: refused,
    // and what was published stays — the read made stale on purpose, as a race would.
    const knowledge = app.get(KnowledgeService) as unknown as {
      findSource: (...args: unknown[]) => Promise<{ status: string }>;
    };
    expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/publish`), 200);
    const published = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } });
    const stale = vi
      .spyOn(knowledge, 'findSource')
      .mockResolvedValueOnce({ ...published, status: 'draft' });
    const widened = await admin.patch(`/ai/knowledge/sources/${source.id}`, { audience: 'staff' });
    stale.mockRestore();
    expect(widened.status).toBe(409);
    expect(problemCode(widened)).toBe('knowledge_source_published');
    expect(
      (await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })).audience,
    ).toBe('institute');

    // Archived once: a second archive, racing the first, does nothing and records nothing.
    expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/archive`), 200);
    const archived = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } });
    const again = vi
      .spyOn(knowledge, 'findSource')
      .mockResolvedValueOnce({ ...archived, status: 'published' });
    const twice = await admin.post(`/ai/knowledge/sources/${source.id}/archive`);
    again.mockRestore();
    expect(twice.status).toBe(409);
    expect(problemCode(twice)).toBe('knowledge_source_archived');
    expect(
      (await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })).archivedAt,
    ).toEqual(archived.archivedAt);
    expect(
      await prisma.auditLog.count({
        where: { action: 'ai.knowledge.source.archived', resourceId: source.id },
      }),
    ).toBe(1);
  });

  it('leaves behind ids, counts and codes alone — in the ledger, the audit and the logs — and no key anywhere', async () => {
    // The ledger: each stage's calls, priced, with no column that could hold a text.
    const ledger = await prisma.aiRequest.findMany({
      where: { organizationId, createdAt: { gte: started }, feature: 'knowledge' },
    });
    const tasks = new Set(ledger.map((row) => row.task));
    for (const task of ['embed', 'retrieve', 'rag_answer']) expect(tasks, task).toContain(task);
    expect(ledger.some((row) => row.task === 'embed' && row.outcome !== 'ok')).toBe(true);
    expect(
      ledger.filter((row) => row.task === 'rag_answer').every((r) => r.model === 'fake-1'),
    ).toBe(true);
    // Its only text columns are names from fixed vocabularies: no column could hold a question.
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'ai_requests' AND data_type IN ('text', 'character varying', 'json', 'jsonb')
      ORDER BY column_name`;
    expect(columns.map((c) => c.column_name)).toEqual([
      'data_class',
      'feature',
      'model',
      'outcome',
      'provider',
      'request_id',
      'task',
    ]);

    // The audit: every knowledge entry since the start, none holding a text.
    const audit = await prisma.auditLog.findMany({
      where: { occurredAt: { gte: started }, action: { startsWith: 'ai.knowledge' } },
    });
    const actions = new Set(audit.map((entry) => entry.action));
    for (const action of ['ai.knowledge.retrieval', 'ai.knowledge.answer']) {
      expect(actions, action).toContain(action);
    }

    // The logs: each stage reported, by numbers.
    const messages = logged.map((args) => String(args.at(-1)));
    for (const message of [
      'Knowledge version not ingested',
      'Knowledge version ingested',
      'Knowledge version not embedded',
      'Knowledge version embedded',
      'Knowledge retrieved',
      'Knowledge answered',
    ]) {
      expect(messages, message).toContain(message);
    }

    const recorded = JSON.stringify([ledger, audit, logged]);
    for (const secret of [...neverRecorded, ...INSTRUCTION_FINGERPRINTS, 'Reference code']) {
      expect(recorded.toLowerCase(), secret).not.toContain(secret.toLowerCase());
    }
    expect(credentialsIn(recorded)).toEqual([]);

    // The institute's AI settings, if stored, hold choices — no key.
    const settings = await prisma.setting.findMany({ where: { organizationId, key: 'ai' } });
    expect(credentialsIn(JSON.stringify(settings))).toEqual([]);
    expect(JSON.stringify(settings)).not.toMatch(/api[_-]?key|secret|token/i);
  });
});
