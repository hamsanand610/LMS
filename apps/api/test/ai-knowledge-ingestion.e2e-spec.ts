import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  SYSTEM_ROLES,
  type KnowledgeSourceView,
  type KnowledgeVersionView,
} from '@lms/shared';
import { AuthContextService } from '../src/core/auth/auth-context.service.js';
import type { AuthUser } from '../src/core/auth/auth-user.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../src/core/storage/storage.driver.js';
import {
  knowledgeChunkId,
  knowledgeContentHash,
} from '../src/modules/ai/knowledge/content-hash.js';
import { KnowledgeIngestionService } from '../src/modules/ai/knowledge/ingestion/ingestion.service.js';
import { KnowledgeReachService } from '../src/modules/ai/knowledge/knowledge-reach.service.js';
import { KnowledgeService } from '../src/modules/ai/knowledge/knowledge.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { JAVA_INHERITANCE_TEXT } from './fixtures/java-inheritance-basics.js';
import { courseNotes, courseNotesHtml } from './fixtures/knowledge-course-notes.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const FLAGS = [AI_MODULE_FLAG, AI_KNOWLEDGE_FLAG];
const CHUNKER = 'sections-1/1200-2000-200-200';
/** Words of the fixture: no audit entry may ever carry them. */
const CONTENT_MARKER = 'Inheritance lets one class';

/**
 * Phase 8B: the knowledge base's ingestion, end to end — through the API's trigger and the queue's
 * job, on the test database and the test object storage: formats, provenance, the same version
 * twice, failures and their recovery, tampered and foreign files, institutes, publication, archived
 * knowledge, lessons and courses, stale versions, the hand-over to Phase 8C. Nothing is embedded,
 * retrieved or sent to a provider: there is no path to.
 */
describe('SI Academy AI — knowledge ingestion (Phase 8B)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageDriver;
  let admin: Session;
  let organizationId = '';
  let knowledge: KnowledgeService;
  let ingestion: KnowledgeIngestionService;
  let reach: KnowledgeReachService;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;

  async function signedIn(roleKey: string, label: string) {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key: roleKey } });
    const email = `ai8b-${label}-${counter}-${unique}@test.local`;
    const learner = roleKey === SYSTEM_ROLES.STUDENT;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI 8B ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
        ...(learner
          ? {
              studentProfile: {
                create: { studentCode: `STU-AI8B-${counter}-${unique}`, status: 'active' },
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

  async function newSource(overrides: object = {}) {
    return expectStatus(
      await admin.post('/ai/knowledge/sources', {
        name: `Ingestion ${++counter}`,
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
          canonicalRef: `authored:notes-${++counter}-${unique}`,
          ...overrides,
        }),
        201,
      ).body as { id: string }
    ).id;
  }

  async function newVersion(
    documentId: string,
    content = JAVA_INHERITANCE_TEXT,
    format = 'markdown',
  ) {
    return expectStatus(
      await admin.post(`/ai/knowledge/documents/${documentId}/versions`, { content, format }),
      201,
    ).body as KnowledgeVersionView;
  }

  /** A version of a fresh document in a fresh source. */
  async function fresh(content = JAVA_INHERITANCE_TEXT, format = 'markdown', source: object = {}) {
    const created = await newSource(source);
    const documentId = await newDocument(created.id);
    const version = await newVersion(documentId, content, format);
    return { source: created, documentId, version };
  }

  /** Asks for the version's ingestion through the API; the queue runs it inline in tests. */
  async function ingestViaApi(versionId: string) {
    return expectStatus(await admin.post(`/ai/knowledge/versions/${versionId}/ingest`), 202)
      .body as KnowledgeVersionView;
  }

  const chunksOf = (versionId: string) =>
    prisma.knowledgeChunk.findMany({ where: { versionId }, orderBy: { position: 'asc' } });

  const fileOf = async (versionId: string) =>
    (
      await prisma.knowledgeDocumentVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: { file: true },
      })
    ).file;

  /** A course with one open lesson. */
  async function course(label: string) {
    counter += 1;
    return prisma.course.create({
      data: {
        organizationId,
        slug: `ai8b-${label}-${counter}-${unique}`,
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
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storage = app.get<StorageDriver>(STORAGE_DRIVER);
    knowledge = app.get(KnowledgeService);
    ingestion = app.get(KnowledgeIngestionService);
    reach = app.get(KnowledgeReachService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    for (const key of FLAGS) await setFlag(key, true);
  });
  afterAll(async () => {
    for (const key of FLAGS) await setFlag(key, false);
    await app.close();
  });

  it('is asked for by ai:knowledge_manage alone, behind both flags; the job waits while they are off', async () => {
    const { version } = await fresh();
    for (const role of [SYSTEM_ROLES.STUDENT, SYSTEM_ROLES.TRAINER, SYSTEM_ROLES.ADMIN]) {
      const { session } = await signedIn(role, `ask-${role}`);
      for (const res of [
        await session.post(`/ai/knowledge/versions/${version.id}/ingest`),
        await session.get(`/ai/knowledge/versions/${version.id}`),
      ]) {
        expect(res.status, role).toBe(403);
        expect(problemCode(res), role).toBe('forbidden');
      }
    }
    await withFlag(AI_KNOWLEDGE_FLAG, false, async () => {
      expect(problemCode(await admin.post(`/ai/knowledge/versions/${version.id}/ingest`))).toBe(
        'ai_feature_disabled',
      );
      // A job already queued does nothing while the knowledge base is off.
      expect(await ingestion.ingest(version.id)).toEqual({
        status: 'skipped',
        reason: 'switched_off',
      });
    });
    await withFlag(AI_MODULE_FLAG, false, async () => {
      expect(problemCode(await admin.post(`/ai/knowledge/versions/${version.id}/ingest`))).toBe(
        'module_disabled',
      );
      expect((await ingestion.ingest(version.id)).status).toBe('skipped');
    });
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    expect(
      (await request(server).post(`/api/v1/ai/knowledge/versions/${version.id}/ingest`)).status,
    ).toBe(401);
    expect(
      (await prisma.knowledgeDocumentVersion.findUniqueOrThrow({ where: { id: version.id } }))
        .status,
    ).toBe('pending');
  });

  it('ingests Markdown, plain text and HTML into chunks with their whole provenance', async () => {
    for (const [content, format] of [
      [courseNotes(3), 'markdown'],
      [JAVA_INHERITANCE_TEXT, 'text'],
      [courseNotesHtml(3), 'html'],
    ] as const) {
      const { source, documentId, version } = await fresh(content, format);
      expect(version).toMatchObject({ format, status: 'pending', failureCode: null });
      const after = await ingestViaApi(version.id);
      expect(after, format).toMatchObject({
        status: 'chunked',
        isCurrent: true,
        failureCode: null,
        parserVersion: `${format}-1`,
        chunkerVersion: CHUNKER,
        format,
      });
      const chunks = await chunksOf(version.id);
      expect(chunks.length).toBe(after.chunkCount);
      chunks.forEach((chunk, position) => {
        expect(chunk).toMatchObject({
          organizationId,
          sourceId: source.id,
          documentId,
          versionId: version.id,
          position,
          contentHash: knowledgeContentHash(chunk.content),
          id: knowledgeChunkId(version.id, position, chunk.contentHash),
          characterCount: chunk.content.length,
        });
        expect(chunk.content.length).toBeLessThanOrEqual(2000);
      });
      if (format !== 'text') {
        expect(chunks.every((chunk) => chunk.heading.startsWith('Programming Course Notes'))).toBe(
          true,
        );
      }
      if (format === 'html') {
        const text = chunks.map((chunk) => chunk.content).join('\n');
        for (const gone of ['<p>', 'track()', 'color: red', 'Footer text', 'Sign in']) {
          expect(text).not.toContain(gone);
        }
        expect(text).toContain('```java');
        expect(text).toContain('| Topic | Marks |');
      }
    }
  });

  it('ingests a version once: again changes nothing, and the same content gives the same chunks', async () => {
    const { version } = await fresh(courseNotes(4));
    await ingestViaApi(version.id);
    const first = await chunksOf(version.id);
    const chunkedAt = (
      await prisma.knowledgeDocumentVersion.findUniqueOrThrow({ where: { id: version.id } })
    ).chunkedAt;

    expect(await ingestion.ingest(version.id)).toEqual({
      status: 'skipped',
      reason: 'already_chunked',
    });
    const again = await admin.post(`/ai/knowledge/versions/${version.id}/ingest`);
    expect(again.status).toBe(409);
    expect(problemCode(again)).toBe('knowledge_version_chunked');
    expect(await chunksOf(version.id)).toEqual(first);
    expect(
      (await prisma.knowledgeDocumentVersion.findUniqueOrThrow({ where: { id: version.id } }))
        .chunkedAt,
    ).toEqual(chunkedAt);
    const recorded = await prisma.auditLog.count({
      where: { resourceId: version.id, action: 'ai.knowledge.chunks.recorded' },
    });
    expect(recorded).toBe(1);

    // Taken again on purpose (as after a fix), it gives the very same chunks: ids, text, hashes.
    await prisma.knowledgeDocumentVersion.update({
      where: { id: version.id },
      data: { status: 'failed', isCurrent: false, failureCode: 'parser_failed' },
    });
    expect((await ingestion.ingest(version.id)).status).toBe('chunked');
    const second = await chunksOf(version.id);
    expect(
      second.map(({ id, position, content, contentHash, heading }) => ({
        id,
        position,
        content,
        contentHash,
        heading,
      })),
    ).toEqual(
      first.map(({ id, position, content, contentHash, heading }) => ({
        id,
        position,
        content,
        contentHash,
        heading,
      })),
    );
  });

  it('fails safely, and recovers: a missing file, an ingestion that stopped half-way', async () => {
    const { version } = await fresh();
    const file = await fileOf(version.id);
    const bytes = Buffer.from(JAVA_INHERITANCE_TEXT, 'utf8');
    await storage.delete('private', file.key);
    const failed = await ingestViaApi(version.id);
    expect(failed).toMatchObject({ status: 'failed', failureCode: 'missing_file', chunkCount: 0 });
    expect(await chunksOf(version.id)).toHaveLength(0);
    await storage.put('private', file.key, bytes, file.mime);
    expect((await ingestViaApi(version.id)).status).toBe('chunked');

    // Stopped half-way: claimed, never finished, and something left behind.
    const other = await fresh(courseNotes(2));
    const claimedAt = await knowledge.claim(other.version.id);
    expect(claimedAt).not.toBeNull();
    expect(await ingestion.ingest(other.version.id)).toEqual({
      status: 'skipped',
      reason: 'in_progress',
    });
    const busy = await admin.post(`/ai/knowledge/versions/${other.version.id}/ingest`);
    expect(problemCode(busy)).toBe('knowledge_ingestion_running');
    await prisma.knowledgeChunk.create({
      data: {
        organizationId,
        sourceId: other.source.id,
        documentId: other.documentId,
        versionId: other.version.id,
        position: 99,
        content: 'Left behind',
        contentHash: knowledgeContentHash('Left behind'),
        characterCount: 11,
        tokenEstimate: 3,
      },
    });
    // Once its lease has lapsed the version is taken over; what was left is replaced, not added to.
    await prisma.knowledgeDocumentVersion.update({
      where: { id: other.version.id },
      data: { ingestionStartedAt: new Date(Date.now() - 11 * 60_000) },
    });
    expect((await ingestion.ingest(other.version.id)).status).toBe('chunked');
    const chunks = await chunksOf(other.version.id);
    expect(chunks.some((chunk) => chunk.content === 'Left behind')).toBe(false);
    expect(chunks.map((chunk) => chunk.position)).toEqual(chunks.map((_, i) => i));
    // The ingestion that lost its lease records nothing.
    await expect(
      knowledge.recordChunks(other.version.id, [{ content: 'Late' }], { claimedAt: claimedAt! }),
    ).rejects.toMatchObject({ code: 'knowledge_version_not_processing' });
  });

  it('refuses tampered, foreign, unreadable and oversized content, each with its code', async () => {
    const expectFailure = async (versionId: string, code: string) => {
      expect(await ingestion.ingest(versionId), code).toEqual({ status: 'failed', code });
      expect(await chunksOf(versionId)).toHaveLength(0);
      expect(
        (await prisma.knowledgeDocumentVersion.findUniqueOrThrow({ where: { id: versionId } }))
          .failureCode,
      ).toBe(code);
    };

    const tampered = await fresh();
    const file = await fileOf(tampered.version.id);
    await storage.put('private', file.key, Buffer.from('Something else entirely.'), file.mime);
    await expectFailure(tampered.version.id, 'checksum_mismatch');

    const malformed = await fresh();
    const malformedFile = await fileOf(malformed.version.id);
    await storage.put(
      'private',
      malformedFile.key,
      Buffer.from([0x48, 0xff, 0xfe]),
      malformedFile.mime,
    );
    await expectFailure(malformed.version.id, 'malformed_content');

    const oversized = await fresh();
    const oversizedFile = await fileOf(oversized.version.id);
    await storage.put(
      'private',
      oversizedFile.key,
      Buffer.alloc(2 * 1024 * 1024 + 10, 0x61),
      oversizedFile.mime,
    );
    await expectFailure(oversized.version.id, 'source_too_large');

    const pdf = await fresh();
    await prisma.file.update({
      where: { id: (await fileOf(pdf.version.id)).id },
      data: { mime: 'application/pdf' },
    });
    await expectFailure(pdf.version.id, 'unsupported_format');

    // Files that are not this version's own: another version's, another context's, another folder.
    const owner = await fresh();
    const borrower = await fresh();
    const borrowedFile = await fileOf(borrower.version.id);
    await prisma.file.update({
      where: { id: borrowedFile.id },
      data: { ownerId: owner.version.id },
    });
    await expectFailure(borrower.version.id, 'file_mismatch');
    const lent = await fresh();
    await prisma.file.update({
      where: { id: (await fileOf(lent.version.id)).id },
      data: { ownerType: 'lesson-resource' },
    });
    await expectFailure(lent.version.id, 'file_mismatch');
    const moved = await fresh();
    await prisma.file.update({
      where: { id: (await fileOf(moved.version.id)).id },
      data: { key: `elsewhere/${moved.documentId}/moved.md` },
    });
    await expectFailure(moved.version.id, 'file_mismatch');

    const scripts = await fresh('<script>a()</script><style>p{}</style>', 'html');
    await expectFailure(scripts.version.id, 'empty_content');

    const huge = await fresh(courseNotes(100), 'markdown');
    await expectFailure(huge.version.id, 'content_too_large');

    const pdfFormat = await admin.post(`/ai/knowledge/documents/${owner.documentId}/versions`, {
      content: 'Binary',
      format: 'pdf',
    });
    expect(pdfFormat.status).toBe(400);
  });

  it('keeps to its institute: another institute’s version is neither taken nor found', async () => {
    const orgB = await prisma.organization.create({
      data: { key: `ai8b-b-${unique}`, name: 'Institute B' },
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
    const hash = knowledgeContentHash('Institute B knowledge.');
    const fileB = await prisma.file.create({
      data: {
        organizationId: orgB.id,
        ownerType: 'knowledge-version',
        driver: storage.name,
        bucket: storage.bucketName('private'),
        key: `ai8b-b/knowledge/${documentB.id}/b.md`,
        originalName: 'b.md',
        mime: 'text/markdown',
        size: 22,
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
        characterCount: 22,
      },
    });
    expect(await ingestion.ingest(versionB.id)).toEqual({ status: 'skipped', reason: 'not_found' });
    expect(await knowledge.claimForIngestion(versionB.id)).toBe(false);
    expect(
      (await prisma.knowledgeDocumentVersion.findUniqueOrThrow({ where: { id: versionB.id } }))
        .status,
    ).toBe('pending');
    for (const res of [
      await admin.post(`/ai/knowledge/versions/${versionB.id}/ingest`),
      await admin.get(`/ai/knowledge/versions/${versionB.id}`),
    ]) {
      expect(res.status).toBe(404);
    }
    // Nothing was even asked for on its behalf.
    expect(await prisma.auditLog.count({ where: { resourceId: versionB.id } })).toBe(0);
    expect(await ingestion.chunksForEmbedding(versionB.id)).toEqual([]);
  });

  it('never ingests archived knowledge, and never publishes what it ingests', async () => {
    const archivedSource = await fresh();
    expectStatus(
      await admin.post(`/ai/knowledge/sources/${archivedSource.source.id}/archive`),
      200,
    );
    const refused = await admin.post(`/ai/knowledge/versions/${archivedSource.version.id}/ingest`);
    expect(problemCode(refused)).toBe('knowledge_source_archived');
    // A job queued before the source was archived stops at its own check.
    expect(await ingestion.ingest(archivedSource.version.id)).toEqual({
      status: 'failed',
      code: 'source_archived',
    });

    const archivedDocument = await fresh();
    await prisma.knowledgeDocument.update({
      where: { id: archivedDocument.documentId },
      data: { status: 'archived' },
    });
    expect(await ingestion.ingest(archivedDocument.version.id)).toEqual({
      status: 'failed',
      code: 'document_archived',
    });

    const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'reach');
    const draft = await fresh();
    await ingestViaApi(draft.version.id);
    const [chunk] = await chunksOf(draft.version.id);
    expect(
      (await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: draft.source.id } })).status,
    ).toBe('draft');
    expect(await reach.mayRetrieve(learner.auth, chunk!.id)).toBe(false);
    expectStatus(await admin.post(`/ai/knowledge/sources/${draft.source.id}/publish`), 200);
    expect(await reach.mayRetrieve(learner.auth, chunk!.id)).toBe(true);

    const personal = await fresh(JAVA_INHERITANCE_TEXT, 'markdown', { dataClass: 'personal' });
    await ingestViaApi(personal.version.id);
    expectStatus(await admin.post(`/ai/knowledge/sources/${personal.source.id}/publish`), 200);
    const [held] = await chunksOf(personal.version.id);
    expect(await reach.mayRetrieve(learner.auth, held!.id)).toBe(false);
    expect(await ingestion.chunksForEmbedding(personal.version.id)).toEqual([]);
  });

  it('holds a lesson document to its source’s course, and an older version below the current one', async () => {
    const own = await course('own');
    const other = await course('other');
    const source = await newSource({ audience: 'course', courseId: own.id, dataClass: 'course' });
    const documentId = await newDocument(source.id, { lessonId: own.modules[0]!.lessons[0]!.id });
    const version = await newVersion(documentId);
    const moving = await admin.patch(`/ai/knowledge/sources/${source.id}`, { courseId: other.id });
    expect(moving.status).toBe(409);
    expect(problemCode(moving)).toBe('knowledge_source_has_lesson_documents');
    // Should the two part all the same, ingestion refuses the document.
    await prisma.knowledgeSource.update({ where: { id: source.id }, data: { courseId: other.id } });
    expect(await ingestion.ingest(version.id)).toEqual({
      status: 'failed',
      code: 'document_mismatch',
    });

    const stale = await fresh();
    const newer = await newVersion(stale.documentId, `${JAVA_INHERITANCE_TEXT}\n\nMore.`);
    await ingestViaApi(newer.id);
    const late = await admin.post(`/ai/knowledge/versions/${stale.version.id}/ingest`);
    expect(problemCode(late)).toBe('knowledge_version_stale');
    expect(await ingestion.ingest(stale.version.id)).toEqual({
      status: 'failed',
      code: 'stale_version',
    });
  });

  it('hands Phase 8C everything an embedding needs, without the file', async () => {
    const { source, documentId, version } = await fresh(courseNotes(3));
    await ingestViaApi(version.id);
    await storage.delete('private', (await fileOf(version.id)).key);
    const handed = await ingestion.chunksForEmbedding(version.id);
    const chunks = await chunksOf(version.id);
    expect(handed).toHaveLength(chunks.length);
    handed.forEach((item, i) => {
      expect(item).toEqual({
        chunkId: chunks[i]!.id,
        organizationId,
        sourceId: source.id,
        documentId,
        versionId: version.id,
        position: i,
        heading: chunks[i]!.heading,
        content: chunks[i]!.content,
        contentHash: chunks[i]!.contentHash,
        characterCount: chunks[i]!.characterCount,
        tokenEstimate: chunks[i]!.tokenEstimate,
        parserVersion: 'markdown-1',
        chunkerVersion: CHUNKER,
        document: { title: 'Course notes', canonicalRef: expect.any(String), lessonId: null },
        visibility: {
          audience: 'institute',
          courseId: null,
          dataClass: 'public',
          sourceStatus: 'draft',
          isCurrent: true,
        },
      });
    });
    expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/archive`), 200);
    expect(await ingestion.chunksForEmbedding(version.id)).toEqual([]);
  });

  it('audits by ids and counts, never content, and keeps the files API closed to knowledge files', async () => {
    const { version } = await fresh(JAVA_INHERITANCE_TEXT, 'html');
    await ingestViaApi(version.id);
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
    ]);
    expect(audit[2]!.after).toMatchObject({ status: 'processing' });
    expect(audit[4]!.after).toMatchObject({
      status: 'chunked',
      parserVersion: 'html-1',
      chunkerVersion: CHUNKER,
    });
    expect(JSON.stringify(audit)).not.toContain(CONTENT_MARKER);

    const failed = await fresh('<script>x()</script>', 'html');
    await ingestViaApi(failed.version.id);
    const failure = await prisma.auditLog.findFirstOrThrow({
      where: {
        resourceId: failed.version.id,
        action: 'ai.knowledge.version.ingestion',
        after: { path: ['status'], equals: 'failed' },
      },
    });
    expect(failure.after).toMatchObject({ failureCode: 'empty_content', stage: 'parsing' });

    const file = await fileOf(version.id);
    expect((await admin.get(`/files/${file.id}`)).status).toBe(404);
    expect((await admin.get(`/files/${file.id}/url`)).status).toBe(404);
  });

  it('takes a moderately sized document within its limits', async () => {
    const { version } = await fresh(courseNotes(40));
    const started = Date.now();
    const after = await ingestViaApi(version.id);
    const elapsed = Date.now() - started;
    expect(after.status).toBe('chunked');
    const chunks = await chunksOf(version.id);
    const average = chunks.reduce((sum, chunk) => sum + chunk.characterCount, 0) / chunks.length;
    expect(chunks.length).toBeGreaterThan(80);
    expect(average).toBeGreaterThan(600);
    expect(elapsed).toBeLessThan(30_000);
    const done = await prisma.auditLog.findFirstOrThrow({
      where: {
        resourceId: version.id,
        action: 'ai.knowledge.version.ingestion',
        after: { path: ['status'], equals: 'chunked' },
      },
    });
    expect((done.after as { durationMs: number }).durationMs).toBeLessThan(30_000);
  });
});
