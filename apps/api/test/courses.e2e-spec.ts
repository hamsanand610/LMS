import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type {
  CourseDetail,
  CourseProgress,
  CourseSummary,
  LessonDetail,
  Paginated,
  ProgressOverview,
  PublicationRecord,
  StudentDashboard,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/**
 * J-03: an admin builds a course, publishes it to a batch, and the learner in that batch finds it,
 * works through it and sees their progress. Also covers what the gating and the withdrawal do.
 */
describe('courses, lessons and progress', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);

  let courseId = '';
  let batchId = '';
  let firstLessonId = '';
  let secondModuleLessonId = '';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = new Session(app);
    trainer = new Session(app);
    student = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);
    batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('creates a course from a title and gives it a slug', async () => {
    const response = expectStatus(
      await admin.post('/courses', {
        title: `Test Course ${unique}`,
        description: 'A course created by the API tests.',
        level: 'beginner',
        subject: 'core-java',
        estimatedMinutes: 120,
      }),
      201,
    );
    const course = response.body as CourseSummary;
    courseId = course.id;
    expect(course.slug).toContain('test-course');
    expect(course.status).toBe('draft');
    expect(course.lessonCount).toBe(0);
  });

  it('refuses a level that is not one of the institute terms', async () => {
    const response = await admin.post('/courses', {
      title: `Bad Level ${unique}`,
      level: 'wizard',
    });
    expect(response.status).toBe(400);
    expect(problemCode(response)).toBe('validation_failed');
  });

  it('saves an outline of modules and lessons', async () => {
    const response = expectStatus(
      await admin.put(`/courses/${courseId}/outline`, {
        modules: [
          {
            title: 'Getting started',
            unlockRule: { type: 'always' },
            lessons: [
              {
                title: 'Welcome',
                type: 'article',
                // Written by staff, rendered in every learner's browser: stored without the parts
                // that could run there.
                content: {
                  html: '<p>Hello</p><img src="x" onerror="alert(1)"><script>alert(2)</script>',
                },
              },
              {
                title: 'Set up your machine',
                type: 'article',
                content: { html: '<p>Install</p>' },
              },
            ],
          },
          {
            title: 'Going further',
            unlockRule: { type: 'after_previous', minPercent: 100 },
            lessons: [{ title: 'Next steps', type: 'article', content: { html: '<p>More</p>' } }],
          },
        ],
      }),
      200,
    );
    const detail = response.body as CourseDetail;
    expect(detail.modules).toHaveLength(2);
    expect(detail.lessonCount).toBe(3);
    firstLessonId = detail.modules[0]!.lessons[0]!.id;
    secondModuleLessonId = detail.modules[1]!.lessons[0]!.id;

    const stored = await prisma.lesson.findUniqueOrThrow({ where: { id: firstLessonId } });
    const html = (stored.content as { html: string }).html;
    expect(html).toContain('<p>Hello</p>');
    expect(html).not.toMatch(/onerror|<script/i);
  });

  it('keeps lesson ids when the outline is reordered, so progress survives an edit', async () => {
    const before = (expectStatus(await admin.get(`/courses/${courseId}`), 200).body as CourseDetail)
      .modules[0]!;
    const reordered = expectStatus(
      await admin.put(`/courses/${courseId}/outline`, {
        modules: [
          {
            id: before.id,
            title: 'Getting started',
            unlockRule: { type: 'always' },
            lessons: [
              { id: before.lessons[1]!.id, title: 'Set up your machine', type: 'article' },
              { id: before.lessons[0]!.id, title: 'Welcome', type: 'article' },
            ],
          },
        ],
      }),
      200,
    );
    const after = (reordered.body as CourseDetail).modules[0]!;
    expect(after.lessons.map((l) => l.id)).toEqual([before.lessons[1]!.id, before.lessons[0]!.id]);
    // The second module was left out of the save, so it is gone.
    expect((reordered.body as CourseDetail).modules).toHaveLength(1);

    // Put the two-module shape back for the rest of the journey.
    const restored = expectStatus(
      await admin.put(`/courses/${courseId}/outline`, {
        modules: [
          {
            id: before.id,
            title: 'Getting started',
            unlockRule: { type: 'always' },
            lessons: [
              { id: before.lessons[0]!.id, title: 'Welcome', type: 'article' },
              { id: before.lessons[1]!.id, title: 'Set up your machine', type: 'article' },
            ],
          },
          {
            title: 'Going further',
            unlockRule: { type: 'after_previous', minPercent: 100 },
            lessons: [{ title: 'Next steps', type: 'article' }],
          },
        ],
      }),
      200,
    );
    const detail = restored.body as CourseDetail;
    firstLessonId = detail.modules[0]!.lessons[0]!.id;
    secondModuleLessonId = detail.modules[1]!.lessons[0]!.id;

    const stored = await prisma.lesson.findUniqueOrThrow({ where: { id: firstLessonId } });
    const html = (stored.content as { html: string }).html;
    expect(html).toContain('<p>Hello</p>');
    expect(html).not.toMatch(/onerror|<script/i);
  });

  it('hides an unpublished course from the learner', async () => {
    const list = expectStatus(await student.get('/courses'), 200).body as Paginated<CourseSummary>;
    expect(list.data.map((c) => c.id)).not.toContain(courseId);
    expect((await student.get(`/courses/${courseId}`)).status).toBe(403);
  });

  it('publishes to a batch and enrols everyone in it', async () => {
    const response = expectStatus(
      await admin.post(`/courses/${courseId}/publish`, {
        scopeType: 'batch',
        scopeId: batchId,
        note: 'First release',
      }),
      201,
    );
    const publication = response.body as PublicationRecord;
    expect(publication.scopeLabel).toContain(TEST_FIXTURES.assignedBatchCode);
    expect(publication.enrolled).toBeGreaterThan(0);

    const enrolments = await prisma.enrollment.count({ where: { courseId } });
    expect(enrolments).toBe(publication.enrolled);
  });

  it('refuses to publish the same course to the same audience twice', async () => {
    const response = await admin.post(`/courses/${courseId}/publish`, {
      scopeType: 'batch',
      scopeId: batchId,
    });
    expect(response.status).toBe(409);
    expect(problemCode(response)).toBe('already_published');
  });

  it('shows the published course to the learner, with the second module locked', async () => {
    const mine = expectStatus(await student.get('/me/courses'), 200).body as CourseProgress[];
    expect(mine.map((c) => c.courseId)).toContain(courseId);

    const detail = expectStatus(await student.get(`/courses/${courseId}`), 200)
      .body as CourseDetail;
    expect(detail.enrolled).toBe(true);
    expect(detail.progressPct).toBe(0);
    expect(detail.modules[0]!.unlocked).toBe(true);
    expect(detail.modules[1]!.unlocked).toBe(false);
    expect(detail.modules[1]!.lockReason).toMatch(/previous module/i);
  });

  it('refuses a lesson inside a locked module', async () => {
    const response = await student.get(`/lessons/${secondModuleLessonId}`);
    expect(response.status).toBe(403);
    expect(problemCode(response)).toBe('module_locked');
  });

  it('records completion and recomputes the course percentage', async () => {
    const lesson = expectStatus(await student.get(`/lessons/${firstLessonId}`), 200)
      .body as LessonDetail;
    expect(lesson.courseId).toBe(courseId);
    expect(lesson.status).toBe('not_started');
    expect(lesson.nextLessonId).not.toBeNull();

    const completed = expectStatus(await student.post(`/lessons/${firstLessonId}/complete`), 201)
      .body as { status: string; coursePct: number };
    expect(completed.status).toBe('completed');
    expect(completed.coursePct).toBe(33);

    const second = (
      expectStatus(await student.get(`/courses/${courseId}`), 200).body as CourseDetail
    ).modules[0]!.lessons[1]!;
    expectStatus(await student.post(`/lessons/${second.id}/complete`), 201);

    const detail = expectStatus(await student.get(`/courses/${courseId}`), 200)
      .body as CourseDetail;
    expect(detail.progressPct).toBe(67);
    expect(detail.modules[1]!.unlocked, 'the first module is finished, so the next one opens').toBe(
      true,
    );
  });

  it('reports the same figures on the progress page and the dashboard', async () => {
    const overview = expectStatus(await student.get('/me/progress'), 200).body as ProgressOverview;
    const course = overview.courses.find((c) => c.courseId === courseId)!;
    expect(course.progressPct).toBe(67);
    expect(course.completedLessons).toBe(2);
    expect(course.nextLessonTitle).toBe('Next steps');
    expect(overview.activity.some((a) => a.type === 'lesson.completed')).toBe(true);
    // Attendance became measurable in Phase 5, so nothing on the progress page is pending now.
    expect(overview.pending).toEqual([]);

    const dashboard = expectStatus(await student.get('/me/dashboard'), 200)
      .body as StudentDashboard;
    expect(dashboard.progress.completedLessons).toBe(overview.overall.completedLessons);
    expect(dashboard.continueLearning.some((c) => c.courseId === courseId)).toBe(true);
  });

  it('completes the course once the last lesson is done', async () => {
    expectStatus(await student.post(`/lessons/${secondModuleLessonId}/complete`), 201);
    const detail = expectStatus(await student.get(`/courses/${courseId}`), 200)
      .body as CourseDetail;
    expect(detail.progressPct).toBe(100);
    const enrolment = await prisma.enrollment.findFirstOrThrow({
      where: { courseId, progressPct: 100 },
    });
    expect(enrolment.status).toBe('completed');
    expect(enrolment.completedAt).not.toBeNull();
  });

  it('lets staff read a learner progress record within their scope', async () => {
    const studentProfile = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email: TEST_ACCOUNTS.student.email } },
    });
    const asAdmin = expectStatus(await admin.get(`/students/${studentProfile.id}/progress`), 200)
      .body as ProgressOverview;
    expect(asAdmin.courses.find((c) => c.courseId === courseId)?.progressPct).toBe(100);

    const asTrainer = await trainer.get(`/students/${studentProfile.id}/progress`);
    expect(asTrainer.status, 'the learner is in the batch this trainer teaches').toBe(200);
  });

  it('lists a course’s audiences to staff only', async () => {
    // A learner enrolled in the course still has no business reading who else it went to.
    expect((await student.get(`/courses/${courseId}/publications`)).status).toBe(403);
    // A trainer sees the audiences that reach the batches they teach.
    const asTrainer = expectStatus(await trainer.get(`/courses/${courseId}/publications`), 200)
      .body as PublicationRecord[];
    expect(asTrainer).toHaveLength(1);
  });

  it('keeps a learner who has started when the publication is withdrawn', async () => {
    const publications = expectStatus(await admin.get(`/courses/${courseId}/publications`), 200)
      .body as PublicationRecord[];
    expect(publications).toHaveLength(1);

    const before = await prisma.enrollment.count({ where: { courseId } });
    const response = expectStatus(
      await admin.delete(`/courses/${courseId}/publications/${publications[0]!.id}`),
      200,
    );
    const removed = (response.body as { removed: number }).removed;
    const after = await prisma.enrollment.count({ where: { courseId } });
    expect(after).toBe(before - removed);
    expect(
      await prisma.enrollment.count({ where: { courseId, progressPct: { gt: 0 } } }),
      'progress that was already made is not thrown away',
    ).toBeGreaterThan(0);

    const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(course.status, 'nobody can reach it any more, so it is a draft again').toBe('draft');
  });

  it('refuses publishing to a trainer who only reads courses', async () => {
    const response = await trainer.post(`/courses/${courseId}/publish`, {
      scopeType: 'batch',
      scopeId: batchId,
    });
    expect(response.status).toBe(403);
  });

  it('refuses to publish a course with no lessons at all', async () => {
    const empty = expectStatus(
      await admin.post('/courses', { title: `Empty ${unique}`, level: 'beginner' }),
      201,
    ).body as CourseSummary;
    const response = await admin.post(`/courses/${empty.id}/publish`, { scopeType: 'all' });
    expect(response.status).toBe(422);
    expect(problemCode(response)).toBe('course_has_no_lessons');
  });
});
