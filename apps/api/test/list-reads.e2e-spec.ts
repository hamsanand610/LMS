import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/**
 * Phase 5: a list page and its total are independent reads. They used to run as one array
 * transaction, which under PostgreSQL's READ COMMITTED gave them no shared snapshot — only one
 * connection, one statement after the other, and Prisma's 5-second transaction limit, which a
 * starved machine exceeded (two assignment-list reads failed with 500). Every list now reads its
 * rows and total side by side, outside any transaction; this spec keeps it that way.
 */
describe('list reads', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Session;
  let learner: Session;
  let batchId = '';
  const password = inject('password');

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = new Session(app);
    learner = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await learner.login(TEST_ACCOUNTS.student.email, password), 200);
    batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  const staffLists = () => [
    '/assignments',
    '/submissions',
    '/attendance/sessions',
    '/audit-logs',
    '/batches',
    `/batches/${batchId}/members`,
    '/programs',
    '/certificates',
    '/courses',
    '/feedback/forms',
    '/announcements',
    '/practice/labs',
    '/questions',
    '/reports/dashboard',
    '/exports',
    '/sessions',
    '/students',
    '/tests',
    '/trainers',
    '/users',
  ];

  it('reads every staff list and its total without opening a transaction', async () => {
    const transactions = vi.spyOn(prisma, '$transaction');
    for (const path of staffLists()) {
      transactions.mockClear();
      const response = expectStatus(await admin.get(path), 200);
      expect({ path, transactions: transactions.mock.calls.length }).toEqual({
        path,
        transactions: 0,
      });
      const body = response.body as { data?: unknown[]; meta?: { total?: number } };
      if (Array.isArray(body.data) && typeof body.meta?.total === 'number') {
        // The total is counted over the same filter as the page.
        expect(body.meta.total).toBeGreaterThanOrEqual(body.data.length);
      }
    }
    transactions.mockRestore();
  });

  it('reads the learner’s practice list without opening a transaction', async () => {
    const transactions = vi.spyOn(prisma, '$transaction');
    expectStatus(await learner.get('/practice/problems'), 200);
    expect(transactions).not.toHaveBeenCalled();
    transactions.mockRestore();
  });

  it('keeps a page and its total in agreement', async () => {
    type Page = { data: unknown[]; meta: { total: number } };
    const all = expectStatus(await admin.get('/users?page=1&pageSize=100'), 200).body as Page;
    const firstTwo = expectStatus(await admin.get('/users?page=1&pageSize=2'), 200).body as Page;
    expect(all.meta.total).toBeGreaterThan(2);
    expect(firstTwo.meta.total).toBe(all.meta.total);
    expect(firstTwo.data).toHaveLength(2);
  });
});
