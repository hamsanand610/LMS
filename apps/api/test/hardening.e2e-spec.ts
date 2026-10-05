import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SYSTEM_ROLES, type FeatureFlag } from '@lms/shared';
import { APP_CONFIG, type AppConfig } from '../src/core/config/env.js';
import { openSecret, secretKey } from '../src/core/config/secret-box.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../src/core/storage/storage.driver.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/**
 * Phase 6: files go when what holds them goes, only their uploader deletes them through the files
 * route, active content cannot be an SVG; an edit changes only what it names; and a request the
 * caller got wrong is answered as such, not as a server failure.
 */
describe('storage, edits and errors (Phase 6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageDriver;
  let admin: Session;
  let learner: Session;
  let learnerId = '';
  let organizationId = '';
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  const PDF = new TextEncoder().encode('%PDF-1.4\n%phase6\n');
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  /** A file as the upload flow leaves it: a ready row and the object in the store. */
  async function storedFile(
    ownerType: string,
    uploadedById: string,
    visibility: 'public' | 'private',
    mime: string,
    body: Uint8Array,
  ) {
    const bucket = visibility === 'public' ? 'public' : 'private';
    const key = `demo/${ownerType}/${unique}-${Math.random().toString(36).slice(2)}`;
    await storage.put(bucket, key, body, mime);
    return prisma.file.create({
      data: {
        organizationId,
        ownerType,
        driver: storage.name,
        bucket: storage.bucketName(bucket),
        key,
        originalName: `${ownerType}.bin`,
        mime,
        size: body.byteLength,
        visibility,
        status: 'ready',
        uploadedById,
      },
    });
  }

  async function gone(file: { id: string; key: string; visibility: string }) {
    const row = await prisma.file.findUnique({ where: { id: file.id } });
    const object = await storage.head(
      file.visibility === 'public' ? 'public' : 'private',
      file.key,
    );
    return row === null && object === null;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storage = app.get<StorageDriver>(STORAGE_DRIVER);
    organizationId = (
      await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.superAdmin.email } })
    ).organizationId;
    admin = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);

    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId, key: SYSTEM_ROLES.STUDENT },
    });
    const email = `p6-files-${unique}@test.local`;
    const user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: 'Phase Six Learner',
        passwordHash: await hashPassword(password),
        status: 'active',
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }] },
      },
    });
    learnerId = user.id;
    await prisma.studentProfile.create({
      data: { userId: user.id, studentCode: `STU-P6-${unique}`, status: 'active' },
    });
    learner = new Session(app);
    expectStatus(await learner.login(email, password), 200);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('files', () => {
    it('refuses SVG for images shown to everyone, and still takes a PNG', async () => {
      for (const context of ['branding-logo', 'branding-favicon', 'company-logo']) {
        const svg = await admin.post('/files/uploads', {
          context,
          filename: 'logo.svg',
          mime: 'image/svg+xml',
          size: 300,
        });
        expect(svg.status, context).toBe(400);
        expect(problemCode(svg)).toBe('validation_failed');
      }
      expectStatus(
        await admin.post('/files/uploads', {
          context: 'branding-logo',
          filename: 'logo.png',
          mime: 'image/png',
          size: 300,
        }),
        201,
      );
    });

    it('lets only the uploader delete a file through the files route', async () => {
      const file = await storedFile(
        'profile-document',
        learnerId,
        'private',
        'application/pdf',
        PDF,
      );
      // The administrator may read it, which is not owning it.
      expectStatus(await admin.get(`/files/${file.id}`), 200);
      expect((await admin.delete(`/files/${file.id}`)).status).toBe(404);
      expect(await gone(file)).toBe(false);
      expectStatus(await learner.delete(`/files/${file.id}`), 204);
      expect(await gone(file)).toBe(true);
    });

    it('deletes a résumé’s file with the résumé', async () => {
      const file = await storedFile('resume', learnerId, 'private', 'application/pdf', PDF);
      const added = expectStatus(
        await learner.post('/me/resumes', { fileId: file.id, title: 'Main' }),
        201,
      ).body as { id: string; fileId?: string }[];
      const resume = await prisma.resume.findFirstOrThrow({ where: { fileId: file.id } });
      expect(added.length).toBeGreaterThan(0);
      expectStatus(await learner.delete(`/me/resumes/${resume.id}`), 200);
      expect(await gone(file)).toBe(true);
    });

    it('deletes a profile photo when it is replaced or removed', async () => {
      const first = await storedFile('avatar', learnerId, 'public', 'image/png', PNG);
      const second = await storedFile('avatar', learnerId, 'public', 'image/png', PNG);
      expectStatus(await learner.put('/me/profile/photo', { fileId: first.id }), 200);
      expectStatus(await learner.put('/me/profile/photo', { fileId: second.id }), 200);
      expect(await gone(first)).toBe(true);
      expect(await gone(second)).toBe(false);
      expectStatus(await learner.put('/me/profile/photo', { fileId: null }), 200);
      expect(await gone(second)).toBe(true);
    });

    it('never names the internal store in an answer', async () => {
      const me = await learner.get('/me');
      const branding = await request(server()).get('/api/v1/branding');
      for (const res of [me, branding]) {
        expect(JSON.stringify(res.body)).not.toMatch(/minio:9000|localhost:9000/);
      }
    });
  });

  describe('former staff', () => {
    it('no longer lists the batches a former trainer taught on /me', async () => {
      const role = await prisma.role.findFirstOrThrow({
        where: { organizationId, key: SYSTEM_ROLES.TRAINER },
      });
      const email = `p6-former-trainer-${unique}@test.local`;
      const user = await prisma.user.create({
        data: {
          organizationId,
          email,
          name: 'Former Trainer',
          passwordHash: await hashPassword(password),
          status: 'active',
          emailVerifiedAt: new Date(),
          roles: { create: [{ roleId: role.id }] },
        },
      });
      const trainer = await prisma.trainerProfile.create({ data: { userId: user.id } });
      const batch = await prisma.batch.findFirstOrThrow({
        where: { code: TEST_FIXTURES.assignedBatchCode },
      });
      await prisma.batchTrainer.create({
        data: { batchId: batch.id, trainerId: trainer.id, subject: 'Core Java' },
      });
      const teaching = new Session(app);
      expectStatus(await teaching.login(email, password), 200);
      const before = expectStatus(await teaching.get('/me'), 200).body as {
        person: { batchIds: string[] };
      };
      expect(before.person.batchIds).toContain(batch.id);

      expectStatus(
        await admin.put(`/users/${user.id}/roles`, { roleKeys: [SYSTEM_ROLES.CONTENT_MANAGER] }),
        200,
      );
      const after = new Session(app);
      expectStatus(await after.login(email, password), 200);
      const me = expectStatus(await after.get('/me'), 200).body as {
        person: { batchIds: string[] };
      };
      expect(me.person.batchIds).not.toContain(batch.id);
      // Who taught the batch stays on record.
      expect(await prisma.batchTrainer.count({ where: { trainerId: trainer.id } })).toBe(1);
    });
  });

  describe('edits change what they name', () => {
    it('keeps a test’s other settings when one is changed', async () => {
      const created = expectStatus(
        await admin.post('/tests', {
          title: `Settings kept ${unique}`,
          settings: {
            durationMinutes: 45,
            maxAttempts: 2,
            shuffleQuestions: true,
            shuffleOptions: true,
            resultPolicy: 'immediately',
            reviewPolicy: 'score_only',
            trackTabSwitches: false,
            requireFullScreen: true,
            showRank: true,
          },
        }),
        201,
      ).body as { id: string };
      expectStatus(
        await admin.patch(`/tests/${created.id}`, { settings: { maxAttempts: 3 } }),
        200,
      );
      const row = await prisma.test.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.settings).toMatchObject({
        durationMinutes: 45,
        maxAttempts: 3,
        shuffleQuestions: true,
        resultPolicy: 'immediately',
        reviewPolicy: 'score_only',
        trackTabSwitches: false,
        requireFullScreen: true,
        showRank: true,
      });
    });

    it('keeps an assignment’s other settings when one is changed', async () => {
      const created = expectStatus(
        await admin.post('/assignments', {
          title: `Settings kept ${unique}`,
          settings: {
            attemptsPerQuestion: 5,
            explanationPolicy: 'never',
            duePolicy: 'block_late',
            gradingMethod: 'latest',
          },
        }),
        201,
      ).body as { id: string };
      expectStatus(
        await admin.patch(`/assignments/${created.id}`, { settings: { attemptsPerQuestion: 2 } }),
        200,
      );
      const row = await prisma.assignment.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.settings).toMatchObject({
        attemptsPerQuestion: 2,
        explanationPolicy: 'never',
        duePolicy: 'block_late',
        gradingMethod: 'latest',
      });
    });

    it('keeps a flag’s batches when only its roles change', async () => {
      const flags = expectStatus(await admin.get('/flags'), 200).body as FeatureFlag[];
      const flag =
        flags.find((f) => f.kind === 'option' && !f.locked) ?? flags.find((f) => !f.locked);
      expect(flag).toBeDefined();
      const batch = await prisma.batch.findFirstOrThrow({
        where: { code: TEST_FIXTURES.assignedBatchCode },
      });
      try {
        expectStatus(
          await admin.patch(`/flags/${flag!.key}`, {
            audience: { roleKeys: [SYSTEM_ROLES.TRAINER], batchIds: [batch.id] },
          }),
          200,
        );
        const changed = expectStatus(
          await admin.patch(`/flags/${flag!.key}`, {
            audience: { roleKeys: [SYSTEM_ROLES.ADMIN] },
          }),
          200,
        ).body as FeatureFlag;
        expect(changed.audience).toEqual({ roleKeys: [SYSTEM_ROLES.ADMIN], batchIds: [batch.id] });
      } finally {
        expectStatus(
          await admin.patch(`/flags/${flag!.key}`, {
            enabled: flag!.enabled,
            audience: flag!.audience,
          }),
          200,
        );
      }
    });

    it('previews a branding change to one field of a section with the section’s other fields', async () => {
      const current = expectStatus(await admin.get('/branding'), 200).body as {
        seeds: { login: Record<string, unknown>; email: Record<string, unknown> };
      };
      const preview = expectStatus(
        await admin.post('/branding/preview', { login: { welcomeTitle: `Hello ${unique}` } }),
        200,
      ).body as { seeds: { login: Record<string, unknown> } };
      expect(preview.seeds.login).toEqual({
        ...current.seeds.login,
        welcomeTitle: `Hello ${unique}`,
      });
    });

    it('keeps an integration’s secret and settings when they are not sent', async () => {
      const before = await prisma.integrationConfig.findFirst({ where: { provider: 'video' } });
      try {
        expectStatus(
          await admin.patch('/integrations/video', {
            driver: 'none',
            config: { url: 'https://video.example.com' },
            secret: 'phase-six-secret',
          }),
          200,
        );
        // The form sends an empty secret when the field was left alone.
        expectStatus(await admin.patch('/integrations/video', { driver: 'none', secret: '' }), 200);
        const row = await prisma.integrationConfig.findFirstOrThrow({
          where: { provider: 'video' },
        });
        // Kept, and sealed: the stored text is not the password.
        expect(row.secret).not.toContain('phase-six-secret');
        expect(openSecret(row.secret, secretKey(app.get<AppConfig>(APP_CONFIG)))).toBe(
          'phase-six-secret',
        );
        expect(row.config).toEqual({ url: 'https://video.example.com' });
        expectStatus(
          await admin.patch('/integrations/video', { driver: 'none', secret: null }),
          200,
        );
        expect(
          (await prisma.integrationConfig.findFirstOrThrow({ where: { provider: 'video' } }))
            .secret,
        ).toBe('');
      } finally {
        if (before) {
          await prisma.integrationConfig.update({
            where: { id: before.id },
            data: {
              driver: before.driver,
              config: before.config as object,
              secret: before.secret,
            },
          });
        } else {
          await prisma.integrationConfig.deleteMany({ where: { provider: 'video' } });
        }
      }
    });

    it('refuses an announcement edit that moves the end before the stored start', async () => {
      const startsAt = new Date(Date.now() + 2 * 86_400_000);
      const created = expectStatus(
        await admin.post('/announcements', {
          title: `Window ${unique}`,
          body: 'Body',
          startsAt: startsAt.toISOString(),
          endsAt: new Date(startsAt.getTime() + 86_400_000).toISOString(),
        }),
        201,
      ).body as { id: string };
      const res = await admin.patch(`/announcements/${created.id}`, {
        endsAt: new Date(startsAt.getTime() - 3_600_000).toISOString(),
      });
      expect(res.status).toBe(400);
      expect(problemCode(res)).toBe('validation_failed');
    });
  });

  describe('errors', () => {
    it('answers a body that is not JSON with 400, not 500', async () => {
      const res = await request(server())
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "a@test.local", "password":');
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/problem\+json/);
      expect(res.body.detail).toBe('The request body is not valid JSON.');
    });

    it('keeps API answers out of shared and browser caches', async () => {
      const res = await learner.get('/me');
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('does not read a chunked body with no declared length outside the imports', async () => {
      // supertest always declares a length, so the request is written by hand.
      const listening = app.getHttpServer() as http.Server;
      try {
        const { port } = listening.address() as AddressInfo;
        const status = await new Promise<number>((resolve, reject) => {
          const req = http.request(
            {
              host: '127.0.0.1',
              port,
              method: 'POST',
              path: '/api/v1/auth/login',
              agent: false,
              headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked' },
            },
            (res) => {
              res.resume();
              resolve(res.statusCode ?? 0);
            },
          );
          req.on('error', reject);
          req.write('{"email":"a@test.local",');
          req.end('"password":"x"}');
        });
        expect(status).toBe(413);
      } finally {
        // The hand-written request's connection, should the server not have closed it yet.
        listening.closeAllConnections();
      }
    });
  });
});
