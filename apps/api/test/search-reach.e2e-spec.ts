import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SYSTEM_ROLES, type CourseSummary, type SearchResponse } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

/**
 * Phase 5: search finds labs and questions for staff as their list pages show them, and a
 * learner's own documents and the files of what they reach — never a question's answers, another
 * learner's papers, or a file behind a signed link.
 */
describe('search: staff labs and questions, learners’ documents', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  let otherTrainer: Session;
  let content: Session;
  let learner: Session;
  let outsider: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  const term = `zq${unique}`;
  const secret = `Hidden answer ${unique}`;

  let organizationId = '';
  let practiceWasOn = true;
  let batchId = '';
  let otherBatchId = '';
  let learnerId = '';
  let outsiderId = '';
  const ids: Record<string, string> = {};
  const courses: string[] = [];

  async function account(label: string, roleKey: string) {
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key: roleKey } });
    const email = `search-${label}-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: `Search ${label}`,
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    const session = new Session(app);
    expectStatus(await session.login(email, password), 200);
    return { session, userId: user.id };
  }

  async function question(label: string, authorId: string, type: string, status: string) {
    const row = await prisma.question.create({
      data: {
        organizationId,
        slug: `search-${label}-${unique}`,
        title: `${label} ${term}`,
        body: `Which is right? ${term}`,
        type: type as 'mcq_single',
        status: status as 'draft',
        authorId,
        explanation: secret,
      },
    });
    ids[label] = row.id;
  }

  async function file(ownerId: string, key: string) {
    return prisma.file.create({
      data: {
        organizationId,
        ownerType: 'student-document',
        ownerId,
        driver: 's3',
        bucket: 'lms-private',
        key,
        originalName: 'paper.pdf',
        mime: 'application/pdf',
        size: 10,
        visibility: 'private',
        status: 'ready',
      },
    });
  }

  async function course(label: string, scopeId: string): Promise<string> {
    const id = (
      expectStatus(
        await admin.post('/courses', { title: `${label} course ${unique}`, level: 'beginner' }),
        201,
      ).body as CourseSummary
    ).id;
    courses.push(id);
    expectStatus(
      await admin.put(`/courses/${id}/outline`, {
        modules: [
          {
            title: 'Basics',
            unlockRule: { type: 'always' },
            lessons: [
              { title: `${label} lesson`, type: 'article', content: { html: '<p>Hi</p>' } },
            ],
          },
        ],
      }),
      200,
    );
    expectStatus(await admin.post(`/courses/${id}/publish`, { scopeType: 'batch', scopeId }), 201);
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { module: { courseId: id } } });
    await prisma.lessonResource.create({
      data: { lessonId: lesson.id, title: `${label} syllabus ${term}`, url: 'https://example.com' },
    });
    return id;
  }

  const hits = (response: SearchResponse, type: string) =>
    response.groups.find((g) => g.type === type)?.hits ?? [];
  const search = async (session: Session) =>
    expectStatus(await session.get(`/search?q=${term}&limit=20`), 200).body as SearchResponse;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (await prisma.organization.findFirstOrThrow()).id;
    admin = new Session(app);
    trainer = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    const flag = await prisma.featureFlag.findFirst({
      where: { organizationId, key: 'module.practice' },
    });
    practiceWasOn = flag?.enabled ?? false;
    if (!practiceWasOn) {
      expectStatus(await admin.patch('/flags/module.practice', { enabled: true }), 200);
    }

    const trainerUser = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_ACCOUNTS.trainer.email },
    });
    const other = await account('trainer2', SYSTEM_ROLES.TRAINER);
    otherTrainer = other.session;
    content = (await account('content', SYSTEM_ROLES.CONTENT_MANAGER)).session;

    // Questions and labs, each with an explanation no search hit may carry.
    await question('Own question', trainerUser.id, 'mcq_single', 'draft');
    await question('Other question', other.userId, 'mcq_single', 'draft');
    await question('Own lab', trainerUser.id, 'coding', 'draft');
    await question('Other draft lab', other.userId, 'coding', 'draft');
    await question('Published lab', other.userId, 'coding', 'published');

    // Two learners in two batches, each with papers of their own.
    const programId = (
      expectStatus(
        await admin.post('/programs', {
          code: `SRCH-${unique}`,
          name: `Search ${unique}`,
          durationWeeks: 12,
        }),
        201,
      ).body as { id: string }
    ).id;
    const batch = async (code: string) =>
      (
        expectStatus(
          await admin.post('/batches', {
            programId,
            code: `SRCH-${unique}-${code}`,
            name: `Search ${code}`,
            startDate: '2026-01-05',
            endDate: '2026-12-18',
          }),
          201,
        ).body as { id: string }
      ).id;
    batchId = await batch('B1');
    otherBatchId = await batch('B2');
    for (const [label, into] of [
      ['learner', batchId],
      ['outsider', otherBatchId],
    ] as const) {
      const person = await account(label, SYSTEM_ROLES.STUDENT);
      const profile = await prisma.studentProfile.create({
        data: {
          userId: person.userId,
          studentCode: `STU-SRCH-${label}-${unique}`,
          status: 'active',
        },
      });
      expectStatus(await admin.post(`/batches/${into}/members`, { studentIds: [profile.id] }), 201);
      const paper = await file(profile.id, `test/search/${unique}/${label}.pdf`);
      await prisma.document.create({
        data: {
          studentId: profile.id,
          type: 'id_proof',
          title: `${label} passport ${term}`,
          fileId: paper.id,
        },
      });
      const cv = await file(profile.id, `test/search/${unique}/${label}-cv.pdf`);
      await prisma.resume.create({
        data: { studentId: profile.id, title: `${label} résumé ${term}`, fileId: cv.id },
      });
      if (label === 'learner') {
        learner = person.session;
        learnerId = profile.id;
      } else {
        outsider = person.session;
        outsiderId = profile.id;
      }
    }
    const reached = await course('Reached', batchId);
    await course('Unreached', otherBatchId);
    for (const [studentId, status, label] of [
      [learnerId, 'issued', 'Issued'],
      [learnerId, 'revoked', 'Revoked'],
      [outsiderId, 'issued', 'Outsider'],
    ] as const) {
      await prisma.certificate
        .create({
          data: {
            organizationId,
            studentId,
            courseId: reached,
            code: `S${unique}${label.slice(0, 3).toUpperCase()}${status === 'issued' ? 'I' : 'R'}`.slice(
              0,
              16,
            ),
            learnerName: label,
            courseTitle: `${label} certificate ${term}`,
            institute: 'SI Academy',
            completedAt: new Date(),
            status,
            objectKey: `test/search/${unique}/${label}-certificate.pdf`,
          },
        })
        .catch(async (error: unknown) => {
          // One certificate per learner and course: the revoked one gets a course of its own.
          if ((error as { code?: string }).code !== 'P2002') throw error;
          const another = await course(`${label} extra`, otherBatchId);
          await prisma.certificate.create({
            data: {
              organizationId,
              studentId,
              courseId: another,
              code: `S${unique}${label.slice(0, 3).toUpperCase()}X`.slice(0, 16),
              learnerName: label,
              courseTitle: `${label} certificate ${term}`,
              institute: 'SI Academy',
              completedAt: new Date(),
              status,
              objectKey: `test/search/${unique}/${label}-certificate.pdf`,
            },
          });
        });
    }
    // An assignment with a brief, given to the learner's batch, and one given only elsewhere.
    for (const [label, into] of [
      ['Reached', batchId],
      ['Unreached', otherBatchId],
    ] as const) {
      const assignment = expectStatus(
        await admin.post('/assignments', {
          title: `${label} assignment ${unique}`,
          subject: 'javascript',
          difficulty: 'beginner',
          kind: 'mixed',
        }),
        201,
      ).body as { id: string };
      ids[`${label} assignment`] = assignment.id;
      await prisma.assignmentResource.create({
        data: {
          assignmentId: assignment.id,
          title: `${label} brief ${term}`,
          position: 0,
          url: 'https://example.com/brief',
        },
      });
      await prisma.assignmentPublication.create({
        data: {
          assignmentId: assignment.id,
          batchId: into,
          opensAt: new Date(Date.now() - 60_000),
        },
      });
      await prisma.assignment.update({
        where: { id: assignment.id },
        data: { status: 'published' },
      });
    }
  });

  afterAll(async () => {
    for (const id of courses) await admin.delete(`/courses/${id}`);
    for (const key of ['Reached assignment', 'Unreached assignment']) {
      if (ids[key]) await admin.delete(`/assignments/${ids[key]}`);
    }
    await prisma.question.updateMany({
      where: { slug: { endsWith: `-${unique}` } },
      data: { deletedAt: new Date() },
    });
    if (!practiceWasOn) await admin.patch('/flags/module.practice', { enabled: false });
    await app.close();
  });

  it('finds a trainer only their own questions, and labs as their labs page shows them', async () => {
    const found = await search(trainer);
    expect(hits(found, 'question').map((h) => h.id)).toEqual([ids['Own question']]);
    expect(hits(found, 'question')[0]!.route).toBe(`/trainer/question-bank/${ids['Own question']}`);
    const labs = hits(found, 'practice').map((h) => h.id);
    expect(labs).toContain(ids['Own lab']);
    expect(labs).toContain(ids['Published lab']);
    expect(labs).not.toContain(ids['Other draft lab']);
    expect(hits(found, 'practice').find((h) => h.id === ids['Own lab'])?.route).toBe(
      `/trainer/labs/${ids['Own lab']}/preview`,
    );
    // A lab is listed once, with the labs, not again in the bank.
    expect(hits(found, 'question').map((h) => h.id)).not.toContain(ids['Own lab']);
    // The other trainer finds theirs, not this one's.
    const theirs = await search(otherTrainer);
    expect(hits(theirs, 'question').map((h) => h.id)).toEqual([ids['Other question']]);
    expect(hits(theirs, 'practice').map((h) => h.id)).not.toContain(ids['Own lab']);
  });

  it('finds content managers and administrators every question and lab, in the admin portal', async () => {
    for (const session of [content, admin]) {
      const found = await search(session);
      const questions = hits(found, 'question');
      expect(questions.map((h) => h.id).sort()).toEqual(
        [ids['Own question']!, ids['Other question']!].sort(),
      );
      expect(questions.every((h) => h.route.startsWith('/admin/question-bank/'))).toBe(true);
      expect(hits(found, 'practice').map((h) => h.id)).toEqual(
        expect.arrayContaining([ids['Own lab'], ids['Other draft lab'], ids['Published lab']]),
      );
    }
  });

  it('never carries a question’s answers, and gives learners no staff hits', async () => {
    for (const session of [trainer, content, admin]) {
      expect(JSON.stringify(await search(session))).not.toContain(secret);
    }
    const found = await search(learner);
    expect(hits(found, 'question')).toEqual([]);
    expect(hits(found, 'practice').map((h) => h.id)).not.toContain(ids['Own lab']);
  });

  it('finds a learner their own papers and the files of what they reach, and nobody else’s', async () => {
    const found = hits(await search(learner), 'document');
    const titles = found.map((h) => h.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        `learner passport ${term}`,
        `learner résumé ${term}`,
        `Certificate: Issued certificate ${term}`,
        `Reached syllabus ${term}`,
        `Reached brief ${term}`,
      ]),
    );
    for (const absent of [
      'outsider',
      'Revoked',
      'Outsider certificate',
      'Unreached syllabus',
      'Unreached brief',
    ]) {
      expect(titles.some((t) => t.includes(absent))).toBe(false);
    }
    // Each hit opens a page that checks again and signs any download itself.
    const body = JSON.stringify(found);
    expect(body).not.toContain('test/search/');
    expect(body).not.toContain('https://');
    expect(new Set(found.map((h) => h.route.split('/')[1]))).toEqual(
      new Set(['profile', 'certificates', 'courses', 'assignments']),
    );
    // The other learner finds their own, not this one's.
    const theirs = hits(await search(outsider), 'document').map((h) => h.title);
    expect(theirs).toContain(`outsider passport ${term}`);
    expect(theirs.some((t) => t.startsWith('learner '))).toBe(false);
  });

  it('stops finding a course’s files once the course no longer reaches the learner', async () => {
    expectStatus(await admin.delete(`/batches/${batchId}/members/${learnerId}`), 204);
    const found = hits(await search(learner), 'document').map((h) => h.title);
    expect(found).not.toContain(`Reached syllabus ${term}`);
    expect(found).not.toContain(`Reached brief ${term}`);
    // Their own papers are still theirs.
    expect(found).toContain(`learner passport ${term}`);
  });
});
