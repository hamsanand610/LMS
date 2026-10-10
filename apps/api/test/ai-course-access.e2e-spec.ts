import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  AI_FEATURE_FLAGS,
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  SYSTEM_ROLES,
  moduleFlagKey,
  type KnowledgeRetrieval,
  type KnowledgeSourceView,
  type KnowledgeVersionView,
} from '@lms/shared';
import { AuthContextService } from '../src/core/auth/auth-context.service.js';
import type { AuthUser } from '../src/core/auth/auth-user.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { KnowledgeReachService } from '../src/modules/ai/knowledge/knowledge-reach.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { CoursesService, LessonsService } from '../src/modules/courses/index.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { emptyKnowledgeBase } from './setup/knowledge-base.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const AI_ENV = {
  AI_PROVIDER: 'fake',
  AI_TIMEOUT_MS: '3000',
  AI_DATA_CLASSES: 'public,course',
};
const FLAGS = [AI_MODULE_FLAG, AI_FEATURE_FLAGS.assistant, AI_KNOWLEDGE_FLAG];
const COURSES_MODULE = moduleFlagKey('courses');

/**
 * SI Academy AI reads a course only as the course routes would let the person read it (pre-9B
 * hardening). The assistant beside a course or lesson, and the knowledge base's course material,
 * used to ask only whether the course reached the person — an enrolment — and never whether they
 * hold `courses:read` or have the Courses module switched on, which every course route asks first.
 * Now each of those paths asks both, before any reach; institute-wide knowledge, which is no
 * course's, is unchanged, and so is everything a person who may read courses could reach.
 */
describe('SI Academy AI — course access follows courses:read and the Courses module', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let courses: CoursesService;
  let lessons: LessonsService;
  let reach: KnowledgeReachService;
  let admin: Session;
  let organizationId = '';
  let courseId = '';
  let lessonId = '';
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  const tag = `coursegate${unique}`;
  const query = `${tag} where does the observatory open its dome?`;
  let counter = 0;
  let inCourse = { documentId: '', chunkId: '' };
  let institute = { documentId: '', chunkId: '' };
  let full: { session: Session; auth: AuthUser };
  let withoutCoursesRead: { session: Session; auth: AuthUser };

  async function setFlag(key: string, enabled: boolean) {
    expectStatus(await admin.patch(`/flags/${key}`, { enabled }), 200);
  }

  /**
   * A learner enrolled in the course. Without `courses:read`, their role is the student role's own
   * grants less that one, so the only difference from a learner who may read courses is that grant.
   */
  async function learner(label: string, coursesRead: boolean) {
    counter += 1;
    const student = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
      include: { permissions: { include: { permission: true } } },
    });
    let roleId = student.id;
    if (!coursesRead) {
      const role = await prisma.role.create({
        data: {
          organizationId,
          key: `student_no_courses_${counter}_${unique}`,
          name: `Student without courses ${counter}`,
          permissions: {
            create: student.permissions
              .filter((grant) => grant.permission.key !== 'courses:read')
              .map((grant) => ({ permissionId: grant.permissionId, scope: grant.scope })),
          },
        },
      });
      roleId = role.id;
    }
    const email = `ai-courses-${label}-${counter}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `AI courses ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId }] },
        studentProfile: {
          create: { studentCode: `STU-AICG-${counter}-${unique}`, status: 'active' },
        },
      },
      include: { studentProfile: true },
    });
    await prisma.enrollment.create({ data: { studentId: user.studentProfile!.id, courseId } });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    const auth = (await app.get(AuthContextService).load(user.id))!;
    return { session, auth: { ...auth, sessionId: '' } as AuthUser };
  }

  /** Knowledge through the platform's own path: created, ingested, published and embedded. */
  async function knowledge(text: string, options: { courseId?: string; lessonId?: string } = {}) {
    counter += 1;
    const source = expectStatus(
      await admin.post('/ai/knowledge/sources', {
        name: `Course gate ${counter}`,
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
          title: `Course gate notes ${counter}`,
          canonicalRef: `authored:course-gate-${counter}-${unique}`,
          ...(options.lessonId ? { lessonId: options.lessonId } : {}),
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
    const chunk = await prisma.knowledgeChunk.findFirstOrThrow({
      where: { versionId: version.id },
    });
    return { documentId, chunkId: chunk.id };
  }

  const documentsOf = (found: KnowledgeRetrieval) => found.results.map((r) => r.document.id);

  async function retrieved(session: Session, context: object = {}) {
    return expectStatus(await session.post('/ai/knowledge/retrieve', { query, ...context }), 200)
      .body as KnowledgeRetrieval;
  }

  beforeAll(async () => {
    Object.assign(process.env, AI_ENV);
    app = await createTestApp();
    prisma = app.get(PrismaService);
    courses = app.get(CoursesService);
    lessons = app.get(LessonsService);
    reach = app.get(KnowledgeReachService);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    for (const key of FLAGS) await setFlag(key, true);
    await emptyKnowledgeBase(admin);

    const course = await prisma.course.create({
      data: {
        organizationId,
        slug: `ai-course-gate-${unique}`,
        title: `Course gate ${unique}`,
        status: 'published',
        modules: {
          create: [
            {
              title: 'Open',
              position: 0,
              lessons: {
                create: [
                  {
                    title: 'The observatory',
                    type: 'article',
                    position: 0,
                    content: { html: '<p>The observatory opens its dome at nine.</p>' },
                  },
                ],
              },
            },
          ],
        },
      },
      include: { modules: { include: { lessons: true } } },
    });
    courseId = course.id;
    lessonId = course.modules[0]!.lessons[0]!.id;
    inCourse = await knowledge(`${tag} the observatory opens its dome at nine for this course.`, {
      courseId,
      lessonId,
    });
    institute = await knowledge(`${tag} the observatory dome opens for visitors on Saturdays.`);
    full = await learner('full', true);
    withoutCoursesRead = await learner('no-courses', false);
  });

  afterAll(async () => {
    for (const key of FLAGS) await setFlag(key, false);
    await app.close();
    for (const key of Object.keys(AI_ENV)) delete process.env[key];
  });

  it('keeps every path to the course for a learner who may read courses', async () => {
    const conversation = expectStatus(
      await full.session.post('/ai/conversations', { purpose: 'assistant', context: { lessonId } }),
      201,
    ).body as { id: string };
    const asked = await full.session.post(`/ai/conversations/${conversation.id}/messages`, {
      content: 'When does the dome open?',
    });
    expect(asked.status).toBe(200);
    expect(asked.text).toContain('event: done');
    expectStatus(
      await full.session.post('/ai/conversations', { purpose: 'assistant', context: { courseId } }),
      201,
    );
    expect(documentsOf(await retrieved(full.session, { lessonId }))).toContain(inCourse.documentId);
    expect(documentsOf(await retrieved(full.session, { courseId }))).toContain(inCourse.documentId);
    const anywhere = documentsOf(await retrieved(full.session));
    expect(anywhere).toEqual(expect.arrayContaining([inCourse.documentId, institute.documentId]));
    expect(await reach.mayRetrieve(full.auth, inCourse.chunkId)).toBe(true);
    expect((await courses.aiContextFor(courseId, full.auth)).courseId).toBe(courseId);
    expect([...(await lessons.openLessonIds(full.auth, [lessonId]))]).toEqual([lessonId]);
  });

  it('without courses:read: no assistant beside a course or lesson, no course knowledge — institute knowledge stays', async () => {
    for (const context of [{ lessonId }, { courseId }]) {
      const refused = await withoutCoursesRead.session.post('/ai/conversations', {
        purpose: 'assistant',
        context,
      });
      expect(refused.status, JSON.stringify(context)).toBe(403);
      const retrieval = await withoutCoursesRead.session.post('/ai/knowledge/retrieve', {
        query,
        ...context,
      });
      expect(retrieval.status, JSON.stringify(context)).toBe(403);
      expect(problemCode(retrieval)).toBe('knowledge_retrieval_forbidden');
    }
    const anywhere = documentsOf(await retrieved(withoutCoursesRead.session));
    expect(anywhere).toContain(institute.documentId);
    expect(anywhere).not.toContain(inCourse.documentId);

    // The services every AI path reads a course through, asked directly.
    await expect(courses.aiContextFor(courseId, withoutCoursesRead.auth)).rejects.toMatchObject({
      status: 403,
    });
    await expect(lessons.aiContextFor(lessonId, withoutCoursesRead.auth)).rejects.toMatchObject({
      status: 403,
    });
    expect([...(await lessons.openLessonIds(withoutCoursesRead.auth, [lessonId]))]).toEqual([]);
    expect(await courses.aiReachableCourseIds(withoutCoursesRead.auth)).toEqual([]);
    expect(await reach.mayRetrieve(withoutCoursesRead.auth, inCourse.chunkId)).toBe(false);
    expect(await reach.mayRetrieve(withoutCoursesRead.auth, institute.chunkId)).toBe(true);
    // Nothing else about them changed: the enrolment still reaches the course for its own routes.
    expect(await courses.reachableCourseIds(withoutCoursesRead.auth)).toContain(courseId);
  });

  it('with the Courses module switched off: the same refusals, a conversation begun before included, and all back when it is on', async () => {
    const conversation = expectStatus(
      await full.session.post('/ai/conversations', { purpose: 'assistant', context: { lessonId } }),
      201,
    ).body as { id: string };
    await setFlag(COURSES_MODULE, false);
    try {
      const asked = await full.session.post(`/ai/conversations/${conversation.id}/messages`, {
        content: 'When does the dome open?',
      });
      expect(asked.status).toBe(403);
      expect(
        (
          await full.session.post('/ai/conversations', {
            purpose: 'assistant',
            context: { courseId },
          })
        ).status,
      ).toBe(403);
      for (const context of [{ lessonId }, { courseId }]) {
        const retrieval = await full.session.post('/ai/knowledge/retrieve', { query, ...context });
        expect(retrieval.status, JSON.stringify(context)).toBe(403);
        expect(problemCode(retrieval)).toBe('knowledge_retrieval_forbidden');
      }
      const anywhere = documentsOf(await retrieved(full.session));
      expect(anywhere).toContain(institute.documentId);
      expect(anywhere).not.toContain(inCourse.documentId);
      expect(await reach.mayRetrieve(full.auth, inCourse.chunkId)).toBe(false);
      await expect(lessons.aiContextFor(lessonId, full.auth)).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await setFlag(COURSES_MODULE, true);
    }
    const again = await full.session.post(`/ai/conversations/${conversation.id}/messages`, {
      content: 'And on Sundays?',
    });
    expect(again.status).toBe(200);
    expect(documentsOf(await retrieved(full.session, { lessonId }))).toContain(inCourse.documentId);
  });
});
