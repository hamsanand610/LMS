import { writeFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  AI_KNOWLEDGE_ANSWERS_FLAG,
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  KNOWLEDGE_EMBEDDING_DIMENSION,
  KNOWLEDGE_EMBEDDING_VERSION,
  SYSTEM_ROLES,
  type KnowledgeAnswer,
  type KnowledgeRetrieval,
  type KnowledgeSourceView,
  type KnowledgeVersionView,
} from '@lms/shared';
import { AuthContextService } from '../src/core/auth/auth-context.service.js';
import type { AuthUser } from '../src/core/auth/auth-user.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../src/core/storage/storage.driver.js';
import { KnowledgeAnswerService } from '../src/modules/ai/knowledge/answers/answer.service.js';
import { knowledgeContentHash } from '../src/modules/ai/knowledge/content-hash.js';
import { KnowledgeReachService } from '../src/modules/ai/knowledge/knowledge-reach.service.js';
import { KnowledgeRetrievalService } from '../src/modules/ai/knowledge/retrieval/retrieval.service.js';
import { FAKE_EMBEDDING_MODEL, fakeEmbedding } from '../src/modules/ai/providers/fake.provider.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, allAnswered, expectStatus, problemCode } from './setup/http.js';
import { emptyKnowledgeBase } from './setup/knowledge-base.js';
import { ScriptedGroundedProvider } from './setup/scripted-grounded.provider.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const AI_ENV = {
  AI_PROVIDER: 'fake',
  AI_TIMEOUT_MS: '5000',
  AI_DATA_CLASSES: 'public,course',
  AI_USER_DAILY_REQUESTS: '500',
};
const FLAGS = [AI_MODULE_FLAG, AI_KNOWLEDGE_FLAG, AI_KNOWLEDGE_ANSWERS_FLAG];

const percentile = (xs: number[], p: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
};

/**
 * Phase 8F: a bounded, synthetic load on retrieval and answers in the test database — many people
 * at once, in two courses and two institutes. What must hold under it is what holds for one:
 * nobody is given what they may not draw on, the answers' bounds (eight at once in a process, one
 * at a time each) and the rate limits are kept, no request fails for want of a connection, and the
 * process's memory stays in bounds. Not a benchmark of production: one machine, the fake model.
 */
describe('SI Academy AI — knowledge under load (Phase 8F)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageDriver;
  let reach: KnowledgeReachService;
  let retrieval: KnowledgeRetrievalService;
  let answers: KnowledgeAnswerService;
  let admin: Session;
  let organizationId = '';
  const provider = new ScriptedGroundedProvider();
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let counter = 0;
  const report: Record<string, unknown> = {};
  const write = () => {
    const path = process.env['LMS_LOAD_REPORT'];
    if (path) writeFileSync(path, JSON.stringify(report, null, 2));
  };

  /** A learner of an institute, with a session when it is this installation's own. */
  async function learner(label: string, org = organizationId) {
    // Taken once, before any await: learners are made many at a time.
    const n = ++counter;
    const email = `ai8f-load-${label}-${n}-${unique}@test.local`;
    const role = await prisma.role.findFirst({
      where: { organizationId: org, key: SYSTEM_ROLES.STUDENT },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: org,
        email,
        name: `AI 8F load ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        ...(role ? { roles: { create: [{ roleId: role.id }] } } : {}),
        studentProfile: {
          create: { studentCode: `STU-AI8F-L-${n}-${unique}`, status: 'active' },
        },
      },
      include: { studentProfile: true },
    });
    const auth = (await app.get(AuthContextService).load(user.id))!;
    let session: Session | null = null;
    if (org === organizationId) {
      session = new Session(app);
      expectStatus(await session.login(email, password), 200);
    }
    return {
      user,
      session,
      studentId: user.studentProfile!.id,
      auth: { ...auth, sessionId: '' } as AuthUser,
    };
  }

  async function course(label: string) {
    counter += 1;
    return prisma.course.create({
      data: {
        organizationId,
        slug: `ai8f-load-${label}-${counter}-${unique}`,
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
    });
  }

  const enrol = (studentId: string, courseId: string) =>
    prisma.enrollment.create({ data: { studentId, courseId } });

  /** Knowledge of this institute, through the API: created, ingested, published, embedded. */
  async function knowledge(text: string, options: { courseId?: string } = {}) {
    const source = expectStatus(
      await admin.post('/ai/knowledge/sources', {
        name: `Load ${++counter}`,
        type: 'authored',
        audience: options.courseId ? 'course' : 'institute',
        dataClass: options.courseId ? 'course' : 'public',
        ...(options.courseId ? { courseId: options.courseId } : {}),
      }),
      201,
    ).body as KnowledgeSourceView;
    const documentId = (
      expectStatus(
        await admin.post(`/ai/knowledge/sources/${source.id}/documents`, {
          title: `Load notes ${counter}`,
          canonicalRef: `authored:load-${counter}-${unique}`,
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
    return documentId;
  }

  /** Knowledge of another institute, written straight to the database with its vector. */
  async function otherInstitute(text: string, org: string) {
    counter += 1;
    const source = await prisma.knowledgeSource.create({
      data: {
        organizationId: org,
        name: `Institute B ${counter}`,
        type: 'authored',
        audience: 'institute',
        dataClass: 'public',
        status: 'published',
        publishedAt: new Date(),
      },
    });
    const document = await prisma.knowledgeDocument.create({
      data: {
        organizationId: org,
        sourceId: source.id,
        title: `B ${counter}`,
        canonicalRef: `raw:load-${counter}-${unique}`,
      },
    });
    const hash = knowledgeContentHash(text);
    const file = await prisma.file.create({
      data: {
        organizationId: org,
        ownerType: 'knowledge-version',
        driver: storage.name,
        bucket: storage.bucketName('private'),
        key: `ai8f/knowledge/${document.id}/${counter}.md`,
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
        isCurrent: true,
        chunkCount: 1,
        chunkedAt: new Date(),
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
        heading: '',
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
      document.id,
      version.id,
      chunk.id,
      hash,
      FAKE_EMBEDDING_MODEL,
      KNOWLEDGE_EMBEDDING_DIMENSION,
      KNOWLEDGE_EMBEDDING_VERSION,
      `[${fakeEmbedding(text, KNOWLEDGE_EMBEDDING_DIMENSION).join(',')}]`,
    );
    return document.id;
  }

  beforeAll(async () => {
    Object.assign(process.env, AI_ENV);
    app = await createTestApp({ aiProvider: provider });
    prisma = app.get(PrismaService);
    storage = app.get<StorageDriver>(STORAGE_DRIVER);
    reach = app.get(KnowledgeReachService);
    retrieval = app.get(KnowledgeRetrievalService);
    answers = app.get(KnowledgeAnswerService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    for (const key of FLAGS)
      expectStatus(await admin.patch(`/flags/${key}`, { enabled: true }), 200);
    await emptyKnowledgeBase(admin);
  });
  afterAll(async () => {
    for (const key of FLAGS) {
      expectStatus(await admin.patch(`/flags/${key}`, { enabled: false }), 200);
    }
    await app.close();
    for (const key of Object.keys(AI_ENV)) delete process.env[key];
  });

  it('retrieves for many people at once — two courses, two institutes — each only what they may draw on', async () => {
    const tag = `clinicload${unique}`;
    const query = `${tag} when does the campus clinic open each morning?`;
    const shared = await knowledge(
      `${tag} the campus clinic opens at eight each morning for everyone.`,
    );
    const one = await course('One');
    const two = await course('Two');
    const forOne = await knowledge(
      `${tag} the campus clinic opens each morning at seven for course one.`,
      {
        courseId: one.id,
      },
    );
    const forTwo = await knowledge(
      `${tag} the campus clinic opens each morning at nine for course two.`,
      {
        courseId: two.id,
      },
    );
    const orgB = await prisma.organization.create({
      data: { key: `ai8f-b-${unique}`, name: 'Institute B (load)' },
    });
    const ofB = await otherInstitute(
      `${tag} the campus clinic opens each morning at six in institute B.`,
      orgB.id,
    );

    const inOne = await Promise.all([1, 2, 3, 4].map(() => learner('one')));
    const inTwo = await Promise.all([1, 2, 3, 4].map(() => learner('two')));
    for (const person of inOne) await enrol(person.studentId, one.id);
    for (const person of inTwo) await enrol(person.studentId, two.id);
    const inB = await Promise.all([1, 2].map(() => learner('b', orgB.id)));

    const memory = process.memoryUsage();
    const timings: number[] = [];
    const timed = async <T>(work: () => Promise<T>) => {
      const started = performance.now();
      const value = await work();
      timings.push(performance.now() - started);
      return value;
    };
    // Five retrievals each, all at once: 40 through the API, 10 through the service for institute B.
    const [overHttp, forB] = await Promise.all([
      Promise.all(
        [...inOne, ...inTwo].flatMap((person) =>
          [1, 2, 3, 4, 5].map(() =>
            timed(async () => ({
              person,
              res: await person.session!.post('/ai/knowledge/retrieve', { query }),
            })),
          ),
        ),
      ),
      Promise.all(
        inB.flatMap((person) =>
          [1, 2, 3, 4, 5].map(() =>
            timed(async () => ({
              person,
              found: await retrieval.retrieve(
                person.auth,
                { query, topK: 5 },
                new AbortController().signal,
              ),
            })),
          ),
        ),
      ),
    ]);
    const after = process.memoryUsage();

    // Every request served: no connection ran out, nothing failed.
    expect(overHttp.map(({ res }) => res.status).filter((status) => status !== 200)).toEqual([]);
    // Each person drew on their institute's and their own course's knowledge alone.
    let checked = 0;
    for (const { person, res } of overHttp) {
      const found = res.body as KnowledgeRetrieval;
      const documents = new Set(found.results.map((result) => result.document.id));
      const own = inOne.includes(person) ? forOne : forTwo;
      const other = inOne.includes(person) ? forTwo : forOne;
      expect(documents.has(shared)).toBe(true);
      expect(documents.has(own)).toBe(true);
      expect(documents.has(other)).toBe(false);
      expect(documents.has(ofB)).toBe(false);
      for (const result of found.results) {
        expect(await reach.mayRetrieve(person.auth, result.chunkId)).toBe(true);
        checked += 1;
      }
    }
    for (const { person, found } of forB) {
      expect(found.results.map((result) => result.document.id)).toEqual([ofB]);
      for (const result of found.results) {
        expect(await reach.mayRetrieve(person.auth, result.chunkId)).toBe(true);
        checked += 1;
      }
    }
    report['retrieval'] = {
      concurrent: overHttp.length + forB.length,
      institutes: 2,
      courses: 2,
      resultsChecked: checked,
      latencyMs: {
        p50: Math.round(percentile(timings, 50)),
        p95: Math.round(percentile(timings, 95)),
        max: Math.round(Math.max(...timings)),
      },
      rssGrowthMb: Math.round((after.rss - memory.rss) / 1_048_576),
      heapGrowthMb: Math.round((after.heapUsed - memory.heapUsed) / 1_048_576),
    };
    write();
    // No runaway memory: 50 retrievals at once stay well within a few hundred megabytes.
    expect(after.rss - memory.rss).toBeLessThan(400 * 1_048_576);
  }, 120_000);

  it('writes answers for many people at once within its bounds: eight at once in the process, one at a time each', async () => {
    const tag = `bellload${unique}`;
    const doc = await knowledge(`${tag} the library bell rings at closing time every evening.`);
    const people = await Promise.all(Array.from({ length: 12 }, () => learner('answer')));
    const question = { query: `${tag} when does the library bell ring? @slow` };

    provider.maxInFlight = 0;
    const started = performance.now();
    const results = await allAnswered(
      people.map((person) => person.session!.post('/ai/knowledge/answer', question)),
    );
    const elapsed = performance.now() - started;
    const served = results.filter((res) => res.status === 200);
    const busy = results.filter((res) => res.status === 503);
    // Never more than eight being written at once; the others told plainly to come back.
    expect(provider.maxInFlight).toBeLessThanOrEqual(8);
    expect(served.length).toBeGreaterThanOrEqual(8);
    expect(served.length + busy.length).toBe(people.length);
    expect(busy.map((res) => problemCode(res)).every((code) => code === 'ai_busy')).toBe(true);
    // Each answer is the asker's own, from what they may draw on.
    for (const [index, res] of results.entries()) {
      if (res.status !== 200) continue;
      const body = res.body as KnowledgeAnswer;
      expect(body.status).toBe('answered');
      expect(body.citations[0]!.documentId).toBe(doc);
      for (const citation of body.citations) {
        expect(await reach.mayRetrieve(people[index]!.auth, citation.chunkId)).toBe(true);
      }
    }

    // One person asking five times at once: one answer written, four told one is in progress.
    const eager = await learner('eager');
    const same = await allAnswered(
      [1, 2, 3, 4, 5].map(() => eager.session!.post('/ai/knowledge/answer', question)),
    );
    expect(same.filter((res) => res.status === 200)).toHaveLength(1);
    expect(same.filter((res) => res.status === 409).map((res) => problemCode(res))).toEqual(
      Array(4).fill('ai_generation_in_progress'),
    );

    // The service's own bound, without HTTP: twelve at once for twelve people, eight admitted.
    provider.maxInFlight = 0;
    const direct = await Promise.allSettled(
      people.map((person) =>
        answers.answer(person.auth, { ...question, stream: false }, new AbortController().signal),
      ),
    );
    expect(provider.maxInFlight).toBeLessThanOrEqual(8);
    expect(
      direct.filter((outcome) => outcome.status === 'fulfilled').length,
    ).toBeGreaterThanOrEqual(8);

    report['answers'] = {
      concurrent: people.length,
      served: served.length,
      busy: busy.length,
      maxInFlight: provider.maxInFlight,
      elapsedMs: Math.round(elapsed),
      samePersonAtOnce: { served: 1, inProgress: 4 },
    };
    write();
  }, 120_000);

  it('holds a person to the rate limit under a burst: 35 retrievals at once, 30 served', async () => {
    const tag = `burstload${unique}`;
    await knowledge(`${tag} the swimming pool opens at six on Sundays.`);
    const person = await learner('burst');
    // Every request answered over HTTP (a reset connection fails here, as that), then exactly the
    // limit's thirty served and the five over it refused as rate-limited.
    const burst = await allAnswered(
      Array.from({ length: 35 }, () =>
        person.session!.post('/ai/knowledge/retrieve', {
          query: `${tag} when does the swimming pool open?`,
        }),
      ),
    );
    expect(burst.filter((res) => res.status === 200)).toHaveLength(30);
    expect(burst.filter((res) => res.status === 429).map((res) => problemCode(res))).toEqual(
      Array(5).fill('rate_limited'),
    );
    report['rateLimit'] = { burst: burst.length, served: 30, limited: 5 };
    write();
  }, 120_000);
});
