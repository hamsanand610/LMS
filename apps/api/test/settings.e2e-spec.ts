import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type BrandingPublic, validateTokens } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { EXECUTION_DRIVER } from '../src/modules/execution/index.js';
import { createTestApp } from './setup/app.js';
import type { FakeExecutionDriver } from './setup/fake-execution.driver.js';
import { problemCode, Session } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const DEFAULT_PRIMARY = '#7F2331';

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
    // The version, plus a fingerprint of the derived tokens (ADR-0013).
    expect(first.headers.etag).toMatch(/^"branding-v\d+-[\w-]{12}"$/);
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
    // The sandbox's own health check is part of the report (the test stand-in answers healthy).
    expect(res.body.execution).toEqual({
      driver: 'runner',
      available: true,
      trust: 'trusted',
      ok: true,
    });
  });

  it('tests the code-execution integration against the driver that is actually running', async () => {
    const list = await session.get('/integrations');
    expect(list.status).toBe(200);
    const execution = (
      list.body as { provider: string; activeDriver: string; drivers: { key: string }[] }[]
    ).find((entry) => entry.provider === 'execution');
    expect(execution?.activeDriver).toBe('runner');
    expect(execution?.drivers.map((d) => d.key)).toEqual(['runner', 'judge0', 'none']);

    const healthy = await session.post('/integrations/execution/test', {});
    expect(healthy.status).toBe(201);
    expect(healthy.body.ok).toBe(true);
    expect(healthy.body.detail).toContain('sandbox runner answered');

    // A sandbox that cannot be reached is reported as such, never as a pass.
    const driver = app.get<FakeExecutionDriver>(EXECUTION_DRIVER);
    const original = driver.healthCheck.bind(driver);
    driver.healthCheck = () =>
      Promise.resolve({ ok: false, detail: 'The runner could not be reached' });
    try {
      const down = await session.post('/integrations/execution/test', {});
      expect(down.status).toBe(201);
      expect(down.body).toEqual({ ok: false, detail: 'The runner could not be reached' });
    } finally {
      driver.healthCheck = original;
    }
  });
});
