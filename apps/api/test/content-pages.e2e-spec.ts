import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { API_PREFIX, type ContentPageRecord, type PublicContentPage } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { BUILT_IN_PAGES } from '../src/modules/settings/built-in-pages.js';
import { createTestApp } from './setup/app.js';
import { Session } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

/**
 * The institute's own pages and the two built in (Phase 10 closure): the sign-in page and the
 * invitation link to /pages/privacy and /pages/terms, so a visitor always finds a Privacy Policy and
 * Terms of Service there — the built-in drafts until the institute publishes its own text, which then
 * replaces them. Nobody needs to sign in to read them; only a settings manager may change them.
 */
describe('content pages: the built-in Privacy Policy and Terms of Service', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let trainer: Session;
  const anonymous = (path: string) =>
    request(app.getHttpServer() as Parameters<typeof request>[0]).get(`${API_PREFIX}${path}`);

  /** The test database's own page at an address, if a run left one: removed before and after. */
  async function clear(slug: string): Promise<void> {
    await prisma.contentPage.deleteMany({ where: { slug } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = new Session(app);
    trainer = new Session(app);
    expect((await admin.login(TEST_ACCOUNTS.superAdmin.email, inject('password'))).status).toBe(
      200,
    );
    expect((await trainer.login(TEST_ACCOUNTS.trainer.email, inject('password'))).status).toBe(200);
    await clear('privacy');
    await clear('terms');
  });
  afterAll(async () => {
    await clear('privacy');
    await clear('terms');
    await app.close();
  });

  it('serves both built-in pages to a visitor who has not signed in', async () => {
    for (const [slug, title] of [
      ['privacy', 'Privacy Policy'],
      ['terms', 'Terms of Service'],
    ] as const) {
      const res = await anonymous(`/pages/${slug}`);
      expect(res.status, slug).toBe(200);
      const page = res.body as PublicContentPage;
      expect(page.slug).toBe(slug);
      expect(page.title).toBe(title);
      expect(page.body).toBe(BUILT_IN_PAGES.get(slug)!.body);
      expect(Number.isNaN(Date.parse(page.updatedAt))).toBe(false);
    }
  });

  it('marks itself a draft and names what is still to be confirmed', () => {
    for (const slug of ['privacy', 'terms']) {
      const { body } = BUILT_IN_PAGES.get(slug)!;
      expect(body.startsWith('**Draft for review.**'), slug).toBe(true);
      expect(body, slug).toContain('[To be confirmed: ');
      // The schema's limit for a page the institute writes itself: the text can be pasted in whole.
      expect(body.length, slug).toBeLessThan(50_000);
    }
    // What the code does, said where a learner reads it: AI providers, and what is kept off.
    const privacy = BUILT_IN_PAGES.get('privacy')!.body;
    expect(privacy).toContain('Google (Gemini)');
    expect(privacy).toContain('Groq');
    expect(privacy).toContain('switched off');
  });

  it('finds no built-in page at any other address, however it is spelled', async () => {
    for (const slug of ['no-such-page', 'constructor', 'to-string', 'privacy-policy']) {
      expect((await anonymous(`/pages/${slug}`)).status, slug).toBe(404);
    }
  });

  it('shows the institute’s own published page instead, and the built-in one again when it is withdrawn', async () => {
    const created = await admin.post('/content-pages', {
      slug: 'privacy',
      title: 'SI Academy privacy',
      body: 'The institute’s own words.',
      isPublished: false,
    });
    expect(created.status).toBe(201);
    const own = created.body as ContentPageRecord;

    // A draft does not replace the built-in page.
    expect(((await anonymous('/pages/privacy')).body as PublicContentPage).title).toBe(
      'Privacy Policy',
    );

    expect((await admin.patch(`/content-pages/${own.id}`, { isPublished: true })).status).toBe(200);
    const published = (await anonymous('/pages/privacy')).body as PublicContentPage;
    expect(published).toMatchObject({
      title: 'SI Academy privacy',
      body: 'The institute’s own words.',
    });

    expect((await admin.delete(`/content-pages/${own.id}`)).status).toBe(200);
    expect(((await anonymous('/pages/privacy')).body as PublicContentPage).title).toBe(
      'Privacy Policy',
    );
  });

  it('lets only a settings manager write a page', async () => {
    const refused = await trainer.post('/content-pages', {
      slug: 'terms',
      title: 'Not the trainer’s to write',
      body: '',
      isPublished: true,
    });
    expect(refused.status).toBe(403);
    expect(((await anonymous('/pages/terms')).body as PublicContentPage).title).toBe(
      'Terms of Service',
    );
  });
});
