import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  SYSTEM_ROLES,
  type KnowledgeSourceDetail,
  type KnowledgeSourceView,
  type KnowledgeStatus,
  type KnowledgeVersionView,
} from '@lms/shared';
import { AuthContextService } from '../src/core/auth/auth-context.service.js';
import type { AuthUser } from '../src/core/auth/auth-user.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../src/core/storage/storage.driver.js';
import { knowledgeContentHash } from '../src/modules/ai/knowledge/content-hash.js';
import { KnowledgeReachService } from '../src/modules/ai/knowledge/knowledge-reach.service.js';
import { KnowledgeService } from '../src/modules/ai/knowledge/knowledge.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import {
  JAVA_INHERITANCE_SECTIONS,
  JAVA_INHERITANCE_TEXT,
} from './fixtures/java-inheritance-basics.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { emptyKnowledgeBase } from './setup/knowledge-base.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const FLAGS = [AI_MODULE_FLAG, AI_KNOWLEDGE_FLAG];
/** Words of the fixture: no audit entry, status or listing may ever carry them. */
const CONTENT_MARKER = 'Inheritance lets one class';

/**
 * Phase 8A: SI Academy AI's knowledge base, end to end. Its management (permission, flags, the
 * institute's own), sources, documents and versions with their stored content and hashes, ingestion
 * states, provenance held by the database, the rule that decides who may draw on a chunk, privacy,
 * and vector readiness. Nothing is retrieved or sent to any provider here; embedding, which Phase 8C
 * added, is tested on its own (ai-knowledge-embeddings).
 */
describe('SI Academy AI — the knowledge base (Phase 8A)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let organizationId = '';
  let knowledge: KnowledgeService;
  let reach: KnowledgeReachService;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;

  async function signedIn(roleKey: string, label: string) {
    counter += 1;
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key: roleKey } });
    const email = `ai8a-${label}-${counter}-${unique}@test.local`;
    const learner = roleKey === SYSTEM_ROLES.STUDENT;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI 8A ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
        ...(learner
          ? {
              studentProfile: {
                create: { studentCode: `STU-AI8A-${counter}-${unique}`, status: 'active' },
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
      email,
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

  const sourceBody = (overrides: object = {}) => ({
    name: `Knowledge ${++counter}`,
    type: 'authored',
    audience: 'institute',
    dataClass: 'public',
    ...overrides,
  });

  async function newSource(overrides: object = {}) {
    return expectStatus(await admin.post('/ai/knowledge/sources', sourceBody(overrides)), 201)
      .body as KnowledgeSourceView;
  }

  async function newDocument(sourceId: string, overrides: object = {}) {
    return (
      expectStatus(
        await admin.post(`/ai/knowledge/sources/${sourceId}/documents`, {
          title: 'Java Inheritance Basics',
          canonicalRef: `authored:java-inheritance-${++counter}`,
          ...overrides,
        }),
        201,
      ).body as { id: string }
    ).id;
  }

  async function newVersion(documentId: string, content = JAVA_INHERITANCE_TEXT) {
    return expectStatus(
      await admin.post(`/ai/knowledge/documents/${documentId}/versions`, { content }),
      201,
    ).body as KnowledgeVersionView;
  }

  /** What Phase 8B's ingestion will do: take the version, record its chunks. */
  async function ingest(versionId: string) {
    expect(await knowledge.claimForIngestion(versionId)).toBe(true);
    await knowledge.recordChunks(versionId, JAVA_INHERITANCE_SECTIONS);
    return prisma.knowledgeChunk.findMany({ where: { versionId }, orderBy: { position: 'asc' } });
  }

  /** A published source with one document whose current version is chunked: its first chunk. */
  async function retrievable(overrides: object = {}, document: object = {}) {
    const source = await newSource(overrides);
    const documentId = await newDocument(source.id, document);
    const [chunk] = await ingest((await newVersion(documentId)).id);
    expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/publish`), 200);
    return { source, documentId, chunk: chunk! };
  }

  /** A published course with an open module and a second one locked behind it. */
  async function course(label: string) {
    counter += 1;
    return prisma.course.create({
      data: {
        organizationId,
        slug: `ai8a-${label}-${counter}-${unique}`,
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
            {
              title: 'Locked',
              position: 1,
              unlockRule: { type: 'after_previous', minPercent: 100 },
              lessons: {
                create: [
                  {
                    title: 'Second',
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

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    knowledge = app.get(KnowledgeService);
    reach = app.get(KnowledgeReachService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    for (const key of FLAGS) await setFlag(key, true);
    await emptyKnowledgeBase(admin);
  });
  afterAll(async () => {
    for (const key of FLAGS) await setFlag(key, false);
    await app.close();
  });

  describe('who manages it', () => {
    it('opens to ai:knowledge_manage alone, and only while module.ai and ai.knowledge are both on', async () => {
      for (const role of [SYSTEM_ROLES.STUDENT, SYSTEM_ROLES.TRAINER, SYSTEM_ROLES.ADMIN]) {
        const { session } = await signedIn(role, `manage-${role}`);
        for (const res of [
          await session.get('/ai/knowledge/status'),
          await session.get('/ai/knowledge/sources'),
          await session.post('/ai/knowledge/sources', sourceBody()),
        ]) {
          expect(res.status, role).toBe(403);
          expect(problemCode(res), role).toBe('forbidden');
        }
      }
      expectStatus(await admin.get('/ai/knowledge/sources'), 200);
      await withFlag(AI_KNOWLEDGE_FLAG, false, async () => {
        const off = await admin.get('/ai/knowledge/sources');
        expect(off.status).toBe(403);
        expect(problemCode(off)).toBe('ai_feature_disabled');
        expect(problemCode(await admin.post('/ai/knowledge/sources', sourceBody()))).toBe(
          'ai_feature_disabled',
        );
      });
      await withFlag(AI_MODULE_FLAG, false, async () => {
        expect(problemCode(await admin.get('/ai/knowledge/sources'))).toBe('module_disabled');
      });
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      expect((await request(server).get('/api/v1/ai/knowledge/sources')).status).toBe(401);
    });
  });

  describe('sources, documents and versions', () => {
    it('keeps a version’s content through the storage driver as the institute’s own, hashed, and audits by ids', async () => {
      const source = await newSource();
      expect(source).toMatchObject({ status: 'draft', audience: 'institute', documentCount: 0 });
      const documentId = await newDocument(source.id);
      const version = await newVersion(documentId);
      const hash = knowledgeContentHash(JAVA_INHERITANCE_TEXT);
      expect(version).toMatchObject({
        version: 1,
        status: 'pending',
        isCurrent: false,
        contentHash: hash,
      });

      const row = await prisma.knowledgeDocumentVersion.findUniqueOrThrow({
        where: { id: version.id },
        include: { file: true },
      });
      // A private file the institute owns: no person uploaded it, so no erasure takes it.
      expect(row.file).toMatchObject({
        ownerType: 'knowledge-version',
        ownerId: version.id,
        uploadedById: null,
        checksum: hash,
        mime: 'text/markdown',
        visibility: 'private',
        status: 'ready',
      });
      const stored = await app
        .get<StorageDriver>(STORAGE_DRIVER)
        .readHead('private', row.file.key, 1_000_000);
      expect(Buffer.from(stored!).toString('utf8')).toBe(JAVA_INHERITANCE_TEXT);
      // The version's table holds no content: only where it is, and its hash.
      expect(Object.keys(row)).not.toContain('content');

      const detail = expectStatus(await admin.get(`/ai/knowledge/sources/${source.id}`), 200)
        .body as KnowledgeSourceDetail;
      expect(detail.documents[0]!.versions.map((v) => v.id)).toEqual([version.id]);
      expect(JSON.stringify(detail)).not.toContain(CONTENT_MARKER);

      const audit = await prisma.auditLog.findMany({
        where: { resourceId: { in: [source.id, documentId, version.id] } },
        orderBy: { occurredAt: 'asc' },
      });
      expect(audit.map((entry) => entry.action)).toEqual([
        'ai.knowledge.source.created',
        'ai.knowledge.document.created',
        'ai.knowledge.version.created',
      ]);
      expect(JSON.stringify(audit)).not.toContain(CONTENT_MARKER);

      // Never by id through the files API: not for the roles that may read every file, nor for the
      // Super Admin. A knowledge version's text is reached through the knowledge base alone. The
      // same row in an upload context is readable, so the refusal is the rule's, not the route's.
      const { id: _id, createdAt: _created, updatedAt: _updated, ...fileData } = row.file;
      const control = await prisma.file.create({
        data: {
          ...fileData,
          key: `${row.file.key}.control`,
          ownerType: 'lesson-resource',
          ownerId: null,
        },
      });
      try {
        for (const role of [SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.CONTENT_MANAGER]) {
          const { session } = await signedIn(role, `files-${role}`);
          expectStatus(await session.get(`/files/${control.id}`), 200);
          for (const path of [`/files/${row.file.id}`, `/files/${row.file.id}/url`]) {
            expect((await session.get(path)).status, `${role} ${path}`).toBe(404);
          }
        }
        expectStatus(await admin.get(`/files/${control.id}`), 200);
        expect((await admin.get(`/files/${row.file.id}/url`)).status).toBe(404);
      } finally {
        await prisma.file.delete({ where: { id: control.id } });
      }
    });

    it('never keeps the same content twice: the same text in another form is refused, a change is the next version', async () => {
      const source = await newSource();
      const documentId = await newDocument(source.id);
      await newVersion(documentId);
      const sameInAnotherForm = `\r\n${JAVA_INHERITANCE_TEXT.replaceAll('\n', '  \r\n')}\r\n\r\n`;
      const again = await admin.post(`/ai/knowledge/documents/${documentId}/versions`, {
        content: sameInAnotherForm,
      });
      expect(again.status).toBe(409);
      expect(problemCode(again)).toBe('knowledge_version_duplicate');
      const second = await newVersion(
        documentId,
        `${JAVA_INHERITANCE_TEXT}\n\n## Summary\n\nReuse.`,
      );
      expect(second.version).toBe(2);
      const ref = (await prisma.knowledgeDocument.findUniqueOrThrow({ where: { id: documentId } }))
        .canonicalRef;
      const twin = await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
        title: 'Again',
        canonicalRef: ref,
      });
      expect(problemCode(twin)).toBe('knowledge_document_exists');
    });

    it('publishes a draft once, settles who it is for first, and archives for good', async () => {
      const source = await newSource();
      expectStatus(
        await admin.patch(`/ai/knowledge/sources/${source.id}`, { audience: 'staff' }),
        200,
      );
      expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/publish`), 200);
      expect(problemCode(await admin.post(`/ai/knowledge/sources/${source.id}/publish`))).toBe(
        'knowledge_source_already_published',
      );
      const widen = await admin.patch(`/ai/knowledge/sources/${source.id}`, {
        audience: 'institute',
      });
      expect(widen.status).toBe(409);
      expect(problemCode(widen)).toBe('knowledge_source_published');
      expectStatus(
        await admin.patch(`/ai/knowledge/sources/${source.id}`, { name: 'Renamed' }),
        200,
      );
      const documentId = await newDocument(source.id);

      expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/archive`), 200);
      for (const res of [
        await admin.post(`/ai/knowledge/sources/${source.id}/publish`),
        await admin.post(`/ai/knowledge/sources/${source.id}/archive`),
        await admin.patch(`/ai/knowledge/sources/${source.id}`, { name: 'Back' }),
        await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
          title: 'Late',
          canonicalRef: `authored:late-${unique}`,
        }),
        await admin.post(`/ai/knowledge/documents/${documentId}/versions`, {
          content: 'Late text',
        }),
      ]) {
        expect(res.status).toBe(409);
        expect(problemCode(res)).toBe('knowledge_source_archived');
      }
      const row = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } });
      expect(row.status).toBe('archived');
      expect(row.archivedAt).not.toBeNull();
    });

    it('holds a course source to its course, and a document’s lesson to that course', async () => {
      const own = await course('own');
      const other = await course('other');
      const missingCourse = await admin.post(
        '/ai/knowledge/sources',
        sourceBody({ audience: 'course' }),
      );
      expect(missingCourse.status).toBe(400);
      const strayCourse = await admin.post(
        '/ai/knowledge/sources',
        sourceBody({ audience: 'institute', courseId: own.id }),
      );
      expect(strayCourse.status).toBe(400);
      const source = await newSource({ audience: 'course', courseId: own.id, dataClass: 'course' });
      const stranger = await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
        title: 'Elsewhere',
        canonicalRef: `lesson:${other.modules[0]!.lessons[0]!.id}`,
        lessonId: other.modules[0]!.lessons[0]!.id,
      });
      expect(stranger.status).toBe(400);
      await newDocument(source.id, { lessonId: own.modules[0]!.lessons[0]!.id });
    });
  });

  describe('ingestion states and provenance', () => {
    it('records chunks only for a version taken by one ingestion, with their provenance; the newest chunked is current', async () => {
      const source = await newSource();
      const documentId = await newDocument(source.id);
      const first = await newVersion(documentId);
      await expect(
        knowledge.recordChunks(first.id, JAVA_INHERITANCE_SECTIONS),
      ).rejects.toMatchObject({
        code: 'knowledge_version_not_processing',
      });
      expect(await knowledge.claimForIngestion(first.id)).toBe(true);
      // One taker: a second claim, a duplicate job, gets nothing.
      expect(await knowledge.claimForIngestion(first.id)).toBe(false);
      await knowledge.recordChunks(first.id, JAVA_INHERITANCE_SECTIONS);
      const chunks = await prisma.knowledgeChunk.findMany({
        where: { versionId: first.id },
        orderBy: { position: 'asc' },
      });
      expect(chunks).toHaveLength(JAVA_INHERITANCE_SECTIONS.length);
      chunks.forEach((chunk, position) => {
        expect(chunk).toMatchObject({
          organizationId,
          sourceId: source.id,
          documentId,
          versionId: first.id,
          position,
          heading: JAVA_INHERITANCE_SECTIONS[position]!.heading,
          contentHash: knowledgeContentHash(JAVA_INHERITANCE_SECTIONS[position]!.content),
        });
        expect(chunk.tokenEstimate).toBeGreaterThan(0);
      });
      expect(
        await prisma.knowledgeDocumentVersion.findUniqueOrThrow({ where: { id: first.id } }),
      ).toMatchObject({
        status: 'chunked',
        chunkCount: JAVA_INHERITANCE_SECTIONS.length,
        isCurrent: true,
      });
      // Recorded chunks are final: no second recording of the same version.
      await expect(
        knowledge.recordChunks(first.id, JAVA_INHERITANCE_SECTIONS),
      ).rejects.toMatchObject({
        code: 'knowledge_version_not_processing',
      });

      const second = await newVersion(documentId, `${JAVA_INHERITANCE_TEXT}\n\nMore.`);
      await ingest(second.id);
      const versions = await prisma.knowledgeDocumentVersion.findMany({
        where: { documentId },
        orderBy: { version: 'asc' },
      });
      expect(versions.map((v) => [v.version, v.isCurrent])).toEqual([
        [1, false],
        [2, true],
      ]);

      const third = await newVersion(documentId, `${JAVA_INHERITANCE_TEXT}\n\nYet more.`);
      expect(await knowledge.claimForIngestion(third.id)).toBe(true);
      await knowledge.failIngestion(third.id, 'PARSE_FAILED');
      expect(
        await prisma.knowledgeDocumentVersion.findUniqueOrThrow({ where: { id: third.id } }),
      ).toMatchObject({
        status: 'failed',
        failureCode: 'PARSE_FAILED',
        isCurrent: false,
      });
      // A failed version may be taken again.
      expect(await knowledge.claimForIngestion(third.id)).toBe(true);

      const states = await prisma.auditLog.findMany({
        where: {
          resourceId: { in: [first.id, third.id] },
          action: { startsWith: 'ai.knowledge.' },
        },
      });
      expect(new Set(states.map((s) => s.action))).toEqual(
        new Set([
          'ai.knowledge.version.created',
          'ai.knowledge.version.ingestion',
          'ai.knowledge.chunks.recorded',
        ]),
      );
      expect(JSON.stringify(states)).not.toContain(CONTENT_MARKER);
    });

    it('is held by the database to its provenance, its current version and its rules', async () => {
      const { chunk, documentId } = await retrievable();
      const otherDocument = await newDocument((await newSource()).id);
      const base = {
        organizationId: chunk.organizationId,
        sourceId: chunk.sourceId,
        documentId: chunk.documentId,
        versionId: chunk.versionId,
        position: 99,
        content: 'Orphan',
        contentHash: knowledgeContentHash('Orphan'),
        characterCount: 6,
        tokenEstimate: 2,
      };
      const orgB = await prisma.organization.create({
        data: { key: `ai8a-b-${unique}`, name: 'Institute B' },
      });
      for (const [label, wrong] of [
        ['another document', { documentId: otherDocument }],
        ['another source', { sourceId: (await newSource()).id }],
        ['another institute', { organizationId: orgB.id }],
      ] as const) {
        await expect(
          prisma.knowledgeChunk.create({ data: { ...base, ...wrong } }),
          label,
        ).rejects.toThrow();
      }
      const pending = await newVersion(documentId, `${JAVA_INHERITANCE_TEXT}\n\nPending.`);
      await expect(
        prisma.knowledgeDocumentVersion.update({
          where: { id: pending.id },
          data: { isCurrent: true },
        }),
        'a version not chunked made current',
      ).rejects.toThrow();
      await expect(
        prisma.knowledgeSource.create({
          data: {
            organizationId,
            name: 'No course',
            type: 'authored',
            audience: 'course',
            dataClass: 'course',
          },
        }),
        'a course audience without its course',
      ).rejects.toThrow();
      await expect(
        prisma.knowledgeSource.create({
          data: {
            organizationId,
            name: 'Secret',
            type: 'authored',
            audience: 'institute',
            dataClass: 'restricted',
          },
        }),
        'restricted data',
      ).rejects.toThrow();
      await expect(
        prisma.knowledgeChunk.create({ data: { ...base, contentHash: 'not-a-hash' } }),
        'a malformed hash',
      ).rejects.toThrow();
    });
  });

  describe('who may draw on it — the rule retrieval will filter by (Phase 8D)', () => {
    it('stays in its own institute: learner A never reaches institute B’s knowledge', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'org-a');
      const orgB = await prisma.organization.create({
        data: { key: `ai8a-iso-${unique}`, name: 'Institute B' },
      });
      const source = await prisma.knowledgeSource.create({
        data: {
          organizationId: orgB.id,
          name: 'B’s handbook',
          type: 'authored',
          audience: 'institute',
          dataClass: 'public',
          status: 'published',
          publishedAt: new Date(),
        },
      });
      const document = await prisma.knowledgeDocument.create({
        data: {
          organizationId: orgB.id,
          sourceId: source.id,
          title: 'B',
          canonicalRef: 'authored:b',
        },
      });
      const file = await prisma.file.create({
        data: {
          organizationId: orgB.id,
          ownerType: 'knowledge-version',
          driver: 'memory',
          bucket: 'private',
          key: `ai8a-b/${unique}.md`,
          originalName: 'b.md',
          mime: 'text/markdown',
          size: 1,
          status: 'ready',
        },
      });
      const version = await prisma.knowledgeDocumentVersion.create({
        data: {
          organizationId: orgB.id,
          sourceId: source.id,
          documentId: document.id,
          version: 1,
          contentHash: knowledgeContentHash('B'),
          fileId: file.id,
          characterCount: 1,
          status: 'chunked',
          isCurrent: true,
        },
      });
      const chunk = await prisma.knowledgeChunk.create({
        data: {
          organizationId: orgB.id,
          sourceId: source.id,
          documentId: document.id,
          versionId: version.id,
          position: 0,
          content: 'B only',
          contentHash: knowledgeContentHash('B only'),
          characterCount: 6,
          tokenEstimate: 2,
        },
      });
      expect(await reach.mayRetrieve(learner.auth, chunk.id)).toBe(false);
      expect((await reach.reachOf(learner.auth)).sourceIds).not.toContain(source.id);
      // Institute B's knowledge is not found by institute A's knowledge managers either.
      for (const res of [
        await admin.get(`/ai/knowledge/sources/${source.id}`),
        await admin.patch(`/ai/knowledge/sources/${source.id}`, { name: 'Mine now' }),
        await admin.post(`/ai/knowledge/sources/${source.id}/publish`),
        await admin.post(`/ai/knowledge/sources/${source.id}/archive`),
        await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
          title: 'Into B',
          canonicalRef: 'authored:into-b',
        }),
        await admin.post(`/ai/knowledge/documents/${document.id}/versions`, { content: 'Into B' }),
      ]) {
        expect(res.status).toBe(404);
      }
      const listed = expectStatus(await admin.get('/ai/knowledge/sources'), 200)
        .body as KnowledgeSourceView[];
      expect(listed.map((s) => s.id)).not.toContain(source.id);
    });

    it('never a draft or archived source, an archived document, an old or unfinished version, or personal data', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'states');
      const source = await newSource();
      const documentId = await newDocument(source.id);
      const [chunk] = await ingest((await newVersion(documentId)).id);
      expect(await reach.mayRetrieve(learner.auth, chunk!.id), 'a draft').toBe(false);
      expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/publish`), 200);
      expect(await reach.mayRetrieve(learner.auth, chunk!.id), 'published').toBe(true);

      const [newer] = await ingest(
        (await newVersion(documentId, `${JAVA_INHERITANCE_TEXT}\n\nNew.`)).id,
      );
      expect(await reach.mayRetrieve(learner.auth, chunk!.id), 'an older version').toBe(false);
      expect(await reach.mayRetrieve(learner.auth, newer!.id), 'the current version').toBe(true);

      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'archived' },
      });
      expect(await reach.mayRetrieve(learner.auth, newer!.id), 'an archived document').toBe(false);
      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: 'active' },
      });

      expectStatus(await admin.post(`/ai/knowledge/sources/${source.id}/archive`), 200);
      expect(await reach.mayRetrieve(learner.auth, newer!.id), 'an archived source').toBe(false);

      const personal = await retrievable({ dataClass: 'personal' });
      expect(await reach.mayRetrieve(learner.auth, personal.chunk.id), 'personal data').toBe(false);
      const staff = await signedIn(SYSTEM_ROLES.TRAINER, 'states-staff');
      expect(await reach.mayRetrieve(staff.auth, personal.chunk.id), 'personal data, staff').toBe(
        false,
      );
    });

    it('reaches the institute, staff alone, or the people a course reaches — down to the lesson', async () => {
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'aud-learner');
      const outsider = await signedIn(SYSTEM_ROLES.STUDENT, 'aud-outsider');
      const trainer = await signedIn(SYSTEM_ROLES.TRAINER, 'aud-trainer');

      const everyone = await retrievable();
      for (const person of [learner, outsider, trainer]) {
        expect(await reach.mayRetrieve(person.auth, everyone.chunk.id)).toBe(true);
      }
      const staffOnly = await retrievable({ audience: 'staff' });
      expect(await reach.mayRetrieve(trainer.auth, staffOnly.chunk.id), 'staff').toBe(true);
      expect(await reach.mayRetrieve(learner.auth, staffOnly.chunk.id), 'a learner').toBe(false);

      const java = await course('java');
      const enrolment = await prisma.enrollment.create({
        data: { studentId: learner.studentId, courseId: java.id },
      });
      const courseSource = { audience: 'course', courseId: java.id, dataClass: 'course' };
      const whole = await retrievable(courseSource);
      expect(await reach.mayRetrieve(learner.auth, whole.chunk.id), 'enrolled').toBe(true);
      expect(await reach.mayRetrieve(outsider.auth, whole.chunk.id), 'not enrolled').toBe(false);
      expect(
        await reach.mayRetrieve(trainer.auth, whole.chunk.id),
        'a trainer not teaching it',
      ).toBe(false);

      const lockedLesson = java.modules[1]!.lessons[0]!;
      const aboutLocked = await retrievable(courseSource, { lessonId: lockedLesson.id });
      expect(await reach.mayRetrieve(learner.auth, aboutLocked.chunk.id), 'a locked lesson').toBe(
        false,
      );
      await prisma.lessonProgress.create({
        data: {
          studentId: learner.studentId,
          lessonId: java.modules[0]!.lessons[0]!.id,
          status: 'completed',
        },
      });
      expect(await reach.mayRetrieve(learner.auth, aboutLocked.chunk.id), 'unlocked since').toBe(
        true,
      );

      await prisma.enrollment.update({
        where: { id: enrolment.id },
        data: { status: 'withdrawn' },
      });
      expect(await reach.mayRetrieve(learner.auth, whole.chunk.id), 'withdrawn').toBe(false);
      await prisma.enrollment.update({ where: { id: enrolment.id }, data: { status: 'active' } });
      await prisma.course.update({ where: { id: java.id }, data: { status: 'archived' } });
      expect(await reach.mayRetrieve(learner.auth, whole.chunk.id), 'an archived course').toBe(
        false,
      );
    });
  });

  describe('privacy', () => {
    it('keeps the knowledge base the institute’s: erasing a learner leaves it, and its files, whole', async () => {
      const { source } = await retrievable();
      const counts = async () => ({
        sources: await prisma.knowledgeSource.count({ where: { organizationId } }),
        versions: await prisma.knowledgeDocumentVersion.count({ where: { organizationId } }),
        chunks: await prisma.knowledgeChunk.count({ where: { organizationId } }),
        files: await prisma.file.count({ where: { ownerType: 'knowledge-version' } }),
      });
      const before = await counts();
      const learner = await signedIn(SYSTEM_ROLES.STUDENT, 'erase');
      expectStatus(
        await admin.post(`/users/${learner.user.id}/privacy/erase`, {
          confirmEmail: learner.email,
          reason: 'At the learner’s request',
        }),
        200,
      );
      expect(await counts()).toEqual(before);
      expect(
        (await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: source.id } })).status,
      ).toBe('published');
      // No knowledge file is any person's upload, so no erasure can take one.
      expect(
        await prisma.file.count({
          where: { ownerType: 'knowledge-version', uploadedById: { not: null } },
        }),
      ).toBe(0);
    });
  });

  describe('vector readiness and the embedding boundary', () => {
    it('says truthfully what the database holds vectors with, and keeps them off the chunks', async () => {
      const status = expectStatus(await admin.get('/ai/knowledge/status'), 200)
        .body as KnowledgeStatus;
      // Phase 8C's migration installs pgvector (ADR-0026, ADR-0035); the status reads the catalogue.
      const [installed] = await prisma.$queryRaw<{ extversion: string }[]>`
        SELECT extversion FROM pg_extension WHERE extname = 'vector'`;
      expect(installed?.extversion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(status.vector).toEqual({
        extension: 'vector',
        available: true,
        installed: true,
        version: installed!.extversion,
      });
      expect(status.chunks).toBe(await prisma.knowledgeChunk.count({ where: { organizationId } }));
      expect(JSON.stringify(status)).not.toContain(CONTENT_MARKER);
      // One vector column, in the embeddings' own table, and none on the chunks (Phase 8C).
      const vectors = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
        SELECT table_name::text, column_name::text FROM information_schema.columns
        WHERE udt_name IN ('vector', 'halfvec') ORDER BY 1, 2`;
      expect(vectors).toEqual([
        { table_name: 'knowledge_chunk_embeddings', column_name: 'embedding' },
      ]);
      const columns = await prisma.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_chunks'`;
      expect(columns.map((c) => c.column_name).filter((name) => /embed|vector/.test(name))).toEqual(
        [],
      );
    });

    it('embeds nothing while no provider can: the request is refused, and no vector is counted', async () => {
      // No AI provider is configured for this spec, so there is no embedding contract (Phase 8C).
      const refused = await admin.post(
        '/ai/knowledge/versions/00000000-0000-4000-8000-000000000000/embed',
      );
      expect(refused.status).toBe(409);
      expect(problemCode(refused)).toBe('knowledge_embeddings_unavailable');
      const status = expectStatus(await admin.get('/ai/knowledge/status'), 200)
        .body as KnowledgeStatus;
      expect(status.embeddings).toBe(0);
      // Nor can a question be embedded, so nothing is retrieved (Phase 8D).
      const retrieval = await admin.post('/ai/knowledge/retrieve', { query: 'What is a loop?' });
      expect(retrieval.status).toBe(503);
      expect(problemCode(retrieval)).toBe('knowledge_retrieval_unavailable');
    });
  });
});
