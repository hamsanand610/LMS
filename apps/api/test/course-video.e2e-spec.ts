import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { VIDEO_UPLOAD_MAX_BYTES, type CourseDetail, type CourseSummary } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../src/core/storage/storage.driver.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

const HOUR = 3_600_000;

/** The first bytes of an MP4 file: a box size, then "ftyp" and a brand, which is what the API sniffs. */
function mp4Bytes(length = 64): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set([0x00, 0x00, 0x00, 0x18], 0);
  bytes.set(new TextEncoder().encode('ftypisom'), 4);
  return bytes;
}

/**
 * Recorded classes through the API: a lesson video and a class recording are uploaded (MP4 or WebM,
 * up to 2000 MB, the real type checked), a lesson plays its video through a signed link that
 * expires, a recording keeps its own measured length, and an outline saved without resources (as
 * the course builder saves it) keeps every lesson's attachments.
 */
describe('recorded classes', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageDriver;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  let batchId = '';
  let courseId = '';

  /** Uploads `bytes` as a video in `context` through the three-step flow; returns the file id. */
  async function uploadVideo(session: Session, context: string, name: string): Promise<string> {
    const bytes = mp4Bytes();
    const created = expectStatus(
      await session.post('/files/uploads', {
        context,
        filename: name,
        mime: 'video/mp4',
        size: bytes.byteLength,
      }),
      201,
    ).body as { fileId: string };
    const row = await prisma.file.findUniqueOrThrow({ where: { id: created.fileId } });
    await storage.put('private', row.key, bytes, 'video/mp4');
    expectStatus(await session.post(`/files/uploads/${created.fileId}/complete`, {}), 200);
    return created.fileId;
  }

  async function lessonsOf(id: string) {
    return (expectStatus(await admin.get(`/courses/${id}`), 200).body as CourseDetail).modules[0]!
      .lessons;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storage = app.get<StorageDriver>(STORAGE_DRIVER);
    admin = new Session(app);
    trainer = new Session(app);
    student = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.admin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);
    batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
    courseId = (
      expectStatus(
        await admin.post('/courses', {
          title: `Recorded classes ${unique}`,
          level: 'beginner',
          subject: 'core-java',
        }),
        201,
      ).body as CourseSummary
    ).id;
  });

  afterAll(async () => {
    expectStatus(await admin.delete(`/courses/${courseId}`), 200);
    await prisma.liveSession.deleteMany({ where: { title: { endsWith: unique } } });
    await app.close();
  });

  it('takes a video up to 2000 MB and refuses a larger one', async () => {
    for (const [session, context] of [
      [admin, 'lesson-video'],
      [trainer, 'session-recording'],
    ] as const) {
      expectStatus(
        await session.post('/files/uploads', {
          context,
          filename: 'class.mp4',
          mime: 'video/mp4',
          size: VIDEO_UPLOAD_MAX_BYTES,
        }),
        201,
      );
      const larger = await session.post('/files/uploads', {
        context,
        filename: 'class.mp4',
        mime: 'video/mp4',
        size: VIDEO_UPLOAD_MAX_BYTES + 1,
      });
      expect(larger.status, context).toBe(400);
      const notVideo = await session.post('/files/uploads', {
        context,
        filename: 'class.pdf',
        mime: 'application/pdf',
        size: 1000,
      });
      expect(notVideo.status, context).toBe(400);
    }
  });

  it('refuses an upload the store holds under another type than the one declared', async () => {
    const bytes = mp4Bytes();
    const created = expectStatus(
      await admin.post('/files/uploads', {
        context: 'lesson-video',
        filename: `retyped-${unique}.mp4`,
        mime: 'video/mp4',
        size: bytes.byteLength,
      }),
      201,
    ).body as { fileId: string };
    const row = await prisma.file.findUniqueOrThrow({ where: { id: created.fileId } });
    // The bytes are a video's, but the store would serve them as a web page (Step 6 audit).
    await storage.put('private', row.key, bytes, 'text/html');
    const refused = await admin.post(`/files/uploads/${created.fileId}/complete`, {});
    expect(refused.status).toBe(422);
    expect((refused.body as { code?: string }).code).toBe('upload_type_mismatch');
    expect((await prisma.file.findUniqueOrThrow({ where: { id: created.fileId } })).status).toBe(
      'failed',
    );
  });

  it('plays an uploaded lesson video to an enrolled learner through a signed link that expires', async () => {
    const fileId = await uploadVideo(admin, 'lesson-video', `lesson-${unique}.mp4`);
    expectStatus(
      await admin.put(`/courses/${courseId}/outline`, {
        modules: [
          {
            title: 'Recordings',
            unlockRule: { type: 'always' },
            lessons: [
              {
                title: 'Week one, recorded',
                type: 'video',
                durationSeconds: 95,
                content: {
                  html: '',
                  video: { driver: 'storage-file', key: fileId, durationSeconds: 95 },
                  questionId: null,
                },
              },
            ],
          },
        ],
      }),
      200,
    );
    expectStatus(
      await admin.post(`/courses/${courseId}/publish`, { scopeType: 'batch', scopeId: batchId }),
      201,
    );
    const [lesson] = await lessonsOf(courseId);
    expect(lesson!.durationSeconds).toBe(95);
    const playback = expectStatus(await student.get(`/lessons/${lesson!.id}/playback`), 200)
      .body as { url: string; expiresAt: string };
    expect(playback.url).toContain('lms-test-private');
    const lifetime = new Date(playback.expiresAt).getTime() - Date.now();
    expect(lifetime).toBeGreaterThan(HOUR);
    expect(lifetime).toBeLessThanOrEqual(2 * HOUR);
  });

  it('keeps a lesson’s resources when an outline is saved without them', async () => {
    const [video] = await lessonsOf(courseId);
    const moduleId = (await prisma.lesson.findUniqueOrThrow({ where: { id: video!.id } })).moduleId;
    const save = (resources?: { title: string; url: string }[]) =>
      admin.put(`/courses/${courseId}/outline`, {
        modules: [
          {
            id: moduleId,
            title: 'Recordings',
            unlockRule: { type: 'always' },
            lessons: [
              {
                id: video!.id,
                title: 'Week one, recorded',
                type: 'video',
                durationSeconds: 95,
                ...(resources ? { resources } : {}),
              },
            ],
          },
        ],
      });
    expectStatus(
      await save([{ title: 'Slides', url: 'https://slides.example.test/week-one' }]),
      200,
    );
    expect(await prisma.lessonResource.count({ where: { lessonId: video!.id } })).toBe(1);
    // The course builder sends no resources: the attachment stays, and so does the video.
    expectStatus(await save(), 200);
    expect(await prisma.lessonResource.count({ where: { lessonId: video!.id } })).toBe(1);
    const stored = await prisma.lesson.findUniqueOrThrow({ where: { id: video!.id } });
    expect((stored.content as { video: { key: string } | null }).video).not.toBeNull();
    // Sending an empty list is what removes them.
    expectStatus(await save([]), 200);
    expect(await prisma.lessonResource.count({ where: { lessonId: video!.id } })).toBe(0);
  });

  it('gives an uploaded class recording its own measured length', async () => {
    const at = new Date(Date.now() - 3 * HOUR);
    const session = await prisma.liveSession.create({
      data: {
        batchId,
        subject: 'Core Java',
        title: `Recorded class ${unique}`,
        startsAt: at,
        endsAt: new Date(at.getTime() + HOUR),
        status: 'completed',
      },
    });
    const fileId = await uploadVideo(trainer, 'session-recording', `class-${unique}.mp4`);
    const attached = expectStatus(
      await trainer.post(`/sessions/${session.id}/recording`, {
        fileId,
        courseId,
        // A trainer who is not the course's staff files recordings in a module of their own.
        moduleTitle: 'Class recordings',
        durationSeconds: 2_400,
      }),
      201,
    ).body as { lessonId: string };
    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: attached.lessonId } });
    expect(lesson.type).toBe('video');
    expect(lesson.completionRule).toBe('watch');
    // 40 minutes measured, not the hour the class was scheduled for.
    expect(lesson.durationSeconds).toBe(2_400);
    expect((lesson.content as { video: { durationSeconds: number } }).video.durationSeconds).toBe(
      2_400,
    );
    const playback = expectStatus(await student.get(`/lessons/${lesson.id}/playback`), 200)
      .body as { url: string };
    expect(playback.url).toContain('lms-test-private');
  });
});
