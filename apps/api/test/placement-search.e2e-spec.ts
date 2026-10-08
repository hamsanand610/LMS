import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { CompanyCard, CompanyDetail, DriveCard, DriveDetail, Paginated } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const DAY = 86_400_000;

/**
 * Placement search as a learner uses it: drives found by role or company name, by company and by
 * view (open, closed, all), companies by name or industry, by technology and among favourites —
 * never a draft drive, and nothing at all while the placement module is off.
 */
describe('placement search and filters', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: Session;
  let admin: Session;
  let student: Session;
  let trainer: Session;
  const password = inject('password');
  const u = String(Date.now()).slice(-7);
  let placementWasOn = false;
  const companies: Record<'alpha' | 'beta', string> = { alpha: '', beta: '' };
  const drives: Record<'backend' | 'frontend' | 'closed' | 'draft', string> = {
    backend: '',
    frontend: '',
    closed: '',
    draft: '',
  };

  const drivesSeen = async (query: string) =>
    (
      expectStatus(await student.get(`/drives?pageSize=100&${query}`), 200)
        .body as Paginated<DriveCard>
    ).data.map((d) => d.id);
  const companiesSeen = async (query: string) =>
    (expectStatus(await student.get(`/companies?${query}`), 200).body as CompanyCard[]).map(
      (c) => c.id,
    );

  async function drive(company: string, role: string, status: 'open' | 'closed' | 'draft') {
    const created = expectStatus(
      await admin.post('/drives', {
        companyId: company,
        role,
        applyBy: new Date(Date.now() + 5 * DAY).toISOString(),
      }),
      201,
    ).body as DriveDetail;
    if (status !== 'draft')
      expectStatus(await admin.post(`/drives/${created.id}/status`, { status }), 200);
    return created.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    superAdmin = new Session(app);
    admin = new Session(app);
    student = new Session(app);
    trainer = new Session(app);
    expectStatus(await superAdmin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await admin.login(TEST_ACCOUNTS.admin.email, password), 200);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    placementWasOn = Boolean(
      (await prisma.featureFlag.findFirst({ where: { key: 'module.placement' } }))?.enabled,
    );
    expectStatus(await superAdmin.patch('/flags/module.placement', { enabled: true }), 200);

    companies.alpha = (
      expectStatus(
        await admin.post('/companies', {
          name: `Search Alpha ${u}`,
          industry: `Fintech ${u}`,
          technologies: ['java', `sql-${u}`],
        }),
        201,
      ).body as CompanyDetail
    ).id;
    companies.beta = (
      expectStatus(
        await admin.post('/companies', {
          name: `Search Beta ${u}`,
          industry: 'Retail technology',
          technologies: [`react-${u}`],
        }),
        201,
      ).body as CompanyDetail
    ).id;
    drives.backend = await drive(companies.alpha, `Backend Engineer ${u}`, 'open');
    drives.frontend = await drive(companies.beta, `Frontend Engineer ${u}`, 'open');
    drives.closed = await drive(companies.alpha, `Data Intern ${u}`, 'closed');
    drives.draft = await drive(companies.beta, `Unannounced role ${u}`, 'draft');
  });

  afterAll(async () => {
    const ids = Object.values(companies).filter(Boolean);
    await prisma.companyFavourite.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.placementDrive.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.company.deleteMany({ where: { id: { in: ids } } });
    expectStatus(
      await superAdmin.patch('/flags/module.placement', { enabled: placementWasOn }),
      200,
    );
    await app.close();
  });

  it('finds drives by role and by company name, and never a draft', async () => {
    expect(await drivesSeen(`q=${encodeURIComponent(`Backend Engineer ${u}`)}`)).toEqual([
      drives.backend,
    ]);
    // A company's name finds its drives; its draft stays hidden.
    expect(await drivesSeen(`q=${encodeURIComponent(`Search Beta ${u}`)}`)).toEqual([
      drives.frontend,
    ]);
    const all = await drivesSeen(`view=all&q=${u}`);
    expect(all.sort()).toEqual([drives.backend, drives.frontend, drives.closed].sort());
    expect(all).not.toContain(drives.draft);
    expectStatus(await student.get(`/drives/${drives.draft}`), 404);
  });

  it('narrows drives by company and by view', async () => {
    expect((await drivesSeen(`view=all&companyId=${companies.alpha}`)).sort()).toEqual(
      [drives.backend, drives.closed].sort(),
    );
    expect((await drivesSeen(`view=open&q=${u}`)).sort()).toEqual(
      [drives.backend, drives.frontend].sort(),
    );
    expect(await drivesSeen(`view=closed&q=${u}`)).toEqual([drives.closed]);
    // Staff see the draft, by status.
    const staff = (
      expectStatus(await admin.get(`/drives?pageSize=100&status=draft&q=${u}`), 200)
        .body as Paginated<DriveCard>
    ).data.map((d) => d.id);
    expect(staff).toEqual([drives.draft]);
  });

  it('finds companies by name or industry, by technology and among favourites', async () => {
    expect(await companiesSeen(`q=${encodeURIComponent(`Search Alpha ${u}`)}`)).toEqual([
      companies.alpha,
    ]);
    expect(await companiesSeen(`q=${encodeURIComponent(`Fintech ${u}`)}`)).toEqual([
      companies.alpha,
    ]);
    expect(await companiesSeen(`technology=${encodeURIComponent(`react-${u}`)}`)).toEqual([
      companies.beta,
    ]);
    expectStatus(await student.put(`/companies/${companies.beta}/favourite`, {}), 200);
    const favourites = await companiesSeen('view=favourites');
    expect(favourites).toContain(companies.beta);
    expect(favourites).not.toContain(companies.alpha);
    expectStatus(await student.delete(`/companies/${companies.beta}/favourite`), 200);
    expect(await companiesSeen('view=favourites')).not.toContain(companies.beta);
  });

  it('is closed to trainers, and to everyone while the module is off', async () => {
    expectStatus(await trainer.get(`/drives?q=${u}`), 403);
    expectStatus(await trainer.get(`/companies?q=${u}`), 403);
    expectStatus(await superAdmin.patch('/flags/module.placement', { enabled: false }), 200);
    try {
      expectStatus(await student.get(`/drives?q=${u}`), 403);
      expectStatus(await student.get(`/companies?q=${u}`), 403);
    } finally {
      expectStatus(await superAdmin.patch('/flags/module.placement', { enabled: true }), 200);
    }
  });
});
