import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type BrandingPublic, validateTokens } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { createTestApp } from './setup/app.js';
import { problemCode, Session } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const DEFAULT_PRIMARY = '#0B6E4F';

/** Phase 1 exit criterion: branding changes re-theme without redeploy; settings are validated and audited. */
describe('branding and settings', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let session: Session;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    session = new Session(app);
    expect((await session.login(TEST_ACCOUNTS.superAdmin.email, inject('password'))).status).toBe(
      200,
    );
  });
  afterAll(async () => {
    await session.patch('/branding', { primaryColor: DEFAULT_PRIMARY, tagline: '' });
    await app.close();
  });

  it('serves public branding with an ETag and honours If-None-Match', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const first = await request(server).get('/api/v1/branding/public');
    expect(first.status).toBe(200);
    expect(first.headers.etag).toMatch(/^"branding-v\d+"$/);
    const body = first.body as BrandingPublic;
    expect(body.tokens.light['--brand-primary']).toBeDefined();
    expect(body.tokens.dark['--bg']).toBeDefined();
    const second = await request(server)
      .get('/api/v1/branding/public')
      .set('If-None-Match', first.headers.etag!);
    expect(second.status).toBe(304);
  });

  it('re-derives tokens for a new primary colour, bumps the version and audits the change', async () => {
    const before = (await session.get('/branding/public')).body as BrandingPublic;
    const res = await session.patch('/branding', {
      primaryColor: '#1D4ED8',
      tagline: 'Retheme test',
    });
    expect(res.status).toBe(200);
    const after = res.body as BrandingPublic;
    expect(after.version).toBe(before.version + 1);
    expect(after.tagline).toBe('Retheme test');
    expect(after.tokens.light['--brand-primary']).not.toBe(before.tokens.light['--brand-primary']);
    expect(validateTokens(after.tokens)).toEqual([]);
    const publicView = (await session.get('/branding/public')).body as BrandingPublic;
    expect(publicView.version).toBe(after.version);
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'branding.updated' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit?.summary).toContain(`v${after.version}`);
  });

  it('previews without saving and rejects invalid colours', async () => {
    const preview = await session.post('/branding/preview', { primaryColor: '#DC2626' });
    expect(preview.status).toBe(200);
    expect(preview.body.issues).toEqual([]);
    expect(preview.body.tokens.light['--brand-primary']).toBeDefined();
    const invalid = await session.patch('/branding', { primaryColor: 'red' });
    expect(invalid.status).toBe(400);
    expect(problemCode(invalid)).toBe('validation_failed');
    expect(invalid.body.errors[0].path).toBe('primaryColor');
  });

  it('validates and persists settings sections', async () => {
    const current = (await session.get('/settings')).body as {
      general: { instituteName: string };
      academic: { attendanceThresholdPct: number };
    };
    const bad = await session.patch('/settings', { academic: { attendanceThresholdPct: 140 } });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0].path).toBe('academic.attendanceThresholdPct');
    const ok = await session.patch('/settings', { academic: { attendanceThresholdPct: 80 } });
    expect(ok.status).toBe(200);
    expect(ok.body.academic.attendanceThresholdPct).toBe(80);
    expect(ok.body.general.instituteName).toBe(current.general.instituteName);
    const restored = await session.patch('/settings', {
      academic: { attendanceThresholdPct: current.academic.attendanceThresholdPct },
    });
    expect(restored.status).toBe(200);
  });

  it('reports service health to settings managers only', async () => {
    const res = await session.get('/admin/health');
    expect(res.status).toBe(200);
    expect(res.body.checks.db.ok).toBe(true);
    expect(res.body.execution).toEqual({ driver: 'browser-sandbox', serverExecution: false });
  });
});
