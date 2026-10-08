import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { CourseSummary } from '@lms/shared';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

/**
 * Who may create a course (`POST /courses`, `courses:manage`): the Super Admin (every permission)
 * and an administrator; a trainer and a learner are refused with 403, and nothing is created. The
 * production "You do not have access to this resource" of 8 October 2026 was this refusal, for a
 * learner's session in a tab still showing the Super Admin's pages (web: lib/auth/session-sync).
 */
describe('creating a course', () => {
  let app: INestApplication;
  const sessions: Record<'superAdmin' | 'admin' | 'trainer' | 'student', Session> = {} as never;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  const created: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    for (const key of ['superAdmin', 'admin', 'trainer', 'student'] as const) {
      sessions[key] = new Session(app);
      expectStatus(await sessions[key].login(TEST_ACCOUNTS[key].email, password), 200);
    }
  });

  afterAll(async () => {
    for (const id of created) expectStatus(await sessions.admin.delete(`/courses/${id}`), 200);
    await app.close();
  });

  it('is allowed to the Super Admin and to an administrator', async () => {
    for (const key of ['superAdmin', 'admin'] as const) {
      const title = `JAVA FULL STACK ${key} ${unique}`;
      const course = expectStatus(
        await sessions[key].post('/courses', { title, subject: 'core-java', level: 'beginner' }),
        201,
      ).body as CourseSummary;
      created.push(course.id);
      expect(course).toMatchObject({ title, subject: 'core-java', level: 'beginner' });
      const listed = expectStatus(await sessions[key].get(`/courses/${course.id}`), 200);
      expect((listed.body as CourseSummary).title).toBe(title);
    }
  });

  it('is refused to a trainer and to a learner, who create nothing', async () => {
    for (const key of ['trainer', 'student'] as const) {
      const title = `Refused course ${key} ${unique}`;
      const refused = await sessions[key].post('/courses', {
        title,
        subject: 'core-java',
        level: 'beginner',
      });
      expect(refused.status, key).toBe(403);
      expect(problemCode(refused), key).toBe('forbidden');
      const listed = expectStatus(await sessions.admin.get('/courses?pageSize=100'), 200).body as {
        data: CourseSummary[];
      };
      expect(listed.data.map((c) => c.title)).not.toContain(title);
    }
  });
});
