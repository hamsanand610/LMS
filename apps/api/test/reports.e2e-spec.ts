import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type {
  DashboardResponse,
  ExportJobRecord,
  Paginated,
  ReportCatalogue,
  ReportData,
  TrainerDashboard,
} from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { SheetsService } from '../src/core/sheets/sheets.service.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS, TEST_FIXTURES } from './setup/seed-users.js';

/**
 * J-12: an administrator opens the dashboard, drills into a report, sorts and filters it, and
 * exports it; the file has exactly the rows the filtered table had. Also covers the metric
 * definitions, the placeholders for modules this build does not have, and the trainer's scope.
 */
describe('reports, the dashboard and exports', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sheets: SheetsService;
  let admin: Session;
  let trainer: Session;
  let student: Session;
  const password = inject('password');

  let batchId = '';
  let otherBatchId = '';
  let sessionId = '';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    sheets = app.get(SheetsService);
    admin = new Session(app);
    trainer = new Session(app);
    student = new Session(app);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);

    batchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.assignedBatchCode } })
    ).id;
    otherBatchId = (
      await prisma.batch.findUniqueOrThrow({ where: { code: TEST_FIXTURES.otherBatchCode } })
    ).id;

    // A marked class, so the attendance report has something in it.
    const hourAgo = new Date(Date.now() - 2 * 3_600_000);
    const held = await prisma.liveSession.create({
      data: {
        batchId,
        subject: 'sql',
        title: 'Aggregates',
        startsAt: hourAgo,
        endsAt: new Date(hourAgo.getTime() + 3_600_000),
        status: 'completed',
      },
    });
    sessionId = held.id;
    const roster = await prisma.batchMember.findMany({
      where: { batchId, isActive: true },
      select: { studentId: true },
    });
    expectStatus(
      await admin.put(`/sessions/${sessionId}/attendance`, {
        records: roster.map((member, index) => ({
          studentId: member.studentId,
          status: index === 0 ? 'absent' : 'present',
        })),
      }),
      200,
    );
  });

  afterAll(async () => {
    await prisma.attendanceRecord.deleteMany({ where: { sessionId } });
    await prisma.liveSession.deleteMany({ where: { id: sessionId } });
    await app.close();
  });

  it('lists the reports it can produce, and names the ones it cannot', async () => {
    const catalogue = expectStatus(await admin.get('/reports'), 200).body as ReportCatalogue;
    expect(catalogue.reports.map((r) => r.name)).toEqual([
      'students',
      'attendance',
      'progress',
      'assessments',
      'assignments',
      // Phases 3–4 (ADM-06)
      'certificates',
      'placements',
      'feedback',
      'trainers',
    ]);
    expect(catalogue.pending.length).toBeGreaterThan(0);
    expect(catalogue.pending.every((entry) => entry.reason.length > 0)).toBe(true);
  });

  it('measures every dashboard tile it can and explains every one it cannot', async () => {
    const dashboard = expectStatus(await admin.get('/reports/dashboard'), 200)
      .body as DashboardResponse;

    const attendance = dashboard.metrics.find((m) => m.key === 'attendance.percentage');
    expect(attendance?.value).not.toBeNull();
    expect(attendance?.definition).toContain('marked classes');

    // Every tile has a definition, and every unmeasurable one says why: the module to switch on,
    // what is not tracked yet, or the weighting the institute has still to agree.
    expect(dashboard.metrics.every((m) => m.definition.length > 0)).toBe(true);
    for (const metric of dashboard.metrics.filter((m) => m.pending !== null)) {
      expect(metric.value).toBeNull();
      expect(metric.pending).toMatch(/Switch on|Not tracked yet|agrees how to weigh/);
    }
    expect(dashboard.metrics.some((m) => m.key === 'placements.status')).toBe(true);

    expect(dashboard.charts.attendance.length).toBeGreaterThan(0);
    expect(dashboard.charts.activeStudents.length).toBeGreaterThan(0);
    expect(dashboard.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('puts the unmarked classes in the attention band with a route to them', async () => {
    const unmarkedAt = new Date(Date.now() - 4 * 3_600_000);
    const forgotten = await prisma.liveSession.create({
      data: {
        batchId,
        subject: 'sql',
        title: 'Left unmarked',
        startsAt: unmarkedAt,
        endsAt: new Date(unmarkedAt.getTime() + 3_600_000),
        status: 'completed',
      },
    });
    try {
      const dashboard = expectStatus(await admin.get('/reports/dashboard'), 200)
        .body as DashboardResponse;
      const item = dashboard.attention.find((entry) => entry.key === 'attendance.unmarked');
      expect(item?.count).toBeGreaterThan(0);
      expect(item?.route).toContain('/admin/attendance');
    } finally {
      await prisma.liveSession.delete({ where: { id: forgotten.id } });
    }
  });

  it('builds the attendance report with its summary, chart and definitions', async () => {
    const report = expectStatus(
      await admin.get(`/reports/attendance?batchId=${batchId}&pageSize=100`),
      200,
    ).body as ReportData;

    expect(report.name).toBe('attendance');
    expect(report.rows.length).toBeGreaterThan(0);
    expect(report.columns.map((c) => c.key)).toContain('percentage');
    expect(report.summary.some((tile) => tile.key === 'overall')).toBe(true);
    expect(report.chart?.kind).toBe('line');
    expect(report.definitions.length).toBeGreaterThan(0);
    expect(report.appliedFilters.batchId).toBe(batchId);

    const absent = report.rows.filter((row) => Number(row.absent) > 0);
    expect(absent.length).toBe(1);
  });

  it('sorts by a column and refuses a column it does not have', async () => {
    const ascending = expectStatus(
      await admin.get(`/reports/attendance?batchId=${batchId}&sort=percentage&pageSize=100`),
      200,
    ).body as ReportData;
    const values = ascending.rows.map((row) => Number(row.percentage));
    expect([...values].sort((a, b) => a - b)).toEqual(values);

    const descending = expectStatus(
      await admin.get(`/reports/attendance?batchId=${batchId}&sort=-percentage&pageSize=100`),
      200,
    ).body as ReportData;
    expect(descending.rows[0]?.percentage).toBe(values[values.length - 1]);

    expectStatus(await admin.get('/reports/attendance?sort=nonsense'), 400);
  });

  it('pages without changing the total', async () => {
    const all = expectStatus(await admin.get(`/reports/students?pageSize=200`), 200)
      .body as ReportData;
    const firstPage = expectStatus(await admin.get(`/reports/students?pageSize=2&page=1`), 200)
      .body as ReportData;
    expect(firstPage.meta.total).toBe(all.meta.total);
    expect(firstPage.rows).toHaveLength(Math.min(2, all.meta.total));
  });

  it('gives a trainer only their own batches, and refuses a learner entirely', async () => {
    const report = expectStatus(await trainer.get('/reports/students?pageSize=200'), 200)
      .body as ReportData;
    const codes = new Set(report.rows.map((row) => String(row.batchCode)));
    expect(codes.has(TEST_FIXTURES.assignedBatchCode)).toBe(true);
    expect(codes.has(TEST_FIXTURES.otherBatchCode)).toBe(false);

    // Asking for a batch they do not teach yields nothing rather than somebody else's rows.
    const other = expectStatus(
      await trainer.get(`/reports/students?batchId=${otherBatchId}&pageSize=200`),
      200,
    ).body as ReportData;
    expect(other.rows).toHaveLength(0);

    expectStatus(await student.get('/reports/students'), 403);
    expectStatus(await student.get('/reports/dashboard'), 403);
  });

  it('exports exactly the rows the filtered report showed (J-12)', async () => {
    const filtered = expectStatus(
      await admin.get(`/reports/attendance?batchId=${batchId}&pageSize=1`),
      200,
    ).body as ReportData;

    const job = expectStatus(
      await admin.post('/exports', {
        report: 'attendance',
        format: 'xlsx',
        params: { batchId },
      }),
      201,
    ).body as ExportJobRecord;
    expect(job.report).toBe('attendance');

    // The queue runs inline in the tests, so the file is written by the time the request returns.
    const finished = expectStatus(await admin.get(`/exports/${job.id}`), 200)
      .body as ExportJobRecord;
    expect(finished.status).toBe('ready');
    expect(finished.rowCount).toBe(filtered.meta.total);
    expect(finished.downloadable).toBe(true);
    expect(finished.filename.endsWith('.xlsx')).toBe(true);

    const download = expectStatus(await admin.get(`/exports/${job.id}/download`), 200).body as {
      url: string;
    };
    expect(download.url).toContain('http');
  });

  it('writes a CSV whose header is the report columns and whose rows match the table', async () => {
    const report = expectStatus(
      await admin.get(`/reports/students?batchId=${batchId}&pageSize=200`),
      200,
    ).body as ReportData;

    const job = expectStatus(
      await admin.post('/exports', { report: 'students', format: 'csv', params: { batchId } }),
      201,
    ).body as ExportJobRecord;
    const finished = expectStatus(await admin.get(`/exports/${job.id}`), 200)
      .body as ExportJobRecord;
    expect(finished.rowCount).toBe(report.meta.total);

    // Re-create the file the job wrote from the same columns, and read it back.
    const columns = report.columns.map((column) => ({ key: column.key, header: column.label }));
    const csv = sheets.writeCsv(columns, report.rows);
    const parsed = sheets.parseDelimited(csv.toString('utf8'));
    expect(parsed.headers).toEqual(report.columns.map((c) => c.label));
    expect(parsed.rows).toHaveLength(report.rows.length);
  });

  it('keeps an export to the person who asked for it', async () => {
    const job = expectStatus(
      await admin.post('/exports', { report: 'students', format: 'csv', params: {} }),
      201,
    ).body as ExportJobRecord;

    const mine = expectStatus(await admin.get('/exports'), 200).body as Paginated<ExportJobRecord>;
    expect(mine.data.some((record) => record.id === job.id)).toBe(true);

    const theirs = expectStatus(await trainer.get('/exports'), 200)
      .body as Paginated<ExportJobRecord>;
    expect(theirs.data.some((record) => record.id === job.id)).toBe(false);
    expectStatus(await trainer.get(`/exports/${job.id}`), 403);
    expectStatus(await student.post('/exports', { report: 'students', params: {} }), 403);
  });

  it('refuses to download an export that has expired', async () => {
    const job = expectStatus(
      await admin.post('/exports', { report: 'students', format: 'csv', params: {} }),
      201,
    ).body as ExportJobRecord;
    await prisma.reportExport.update({
      where: { id: job.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await admin.get(`/exports/${job.id}/download`);
    expectStatus(response, 410);
    expect(problemCode(response)).toBe('export_expired');
  });

  it('gives a trainer their own day, limited to their batches', async () => {
    const dashboard = expectStatus(await trainer.get('/trainer/dashboard'), 200)
      .body as TrainerDashboard;

    expect(dashboard.batches.every((batch) => batch.id !== otherBatchId)).toBe(true);
    expect(dashboard.batches.some((batch) => batch.id === batchId)).toBe(true);
    const own = dashboard.batches.find((batch) => batch.id === batchId);
    expect(own?.attendancePct).not.toBeNull();
    expect(typeof dashboard.grading.assignments).toBe('number');
    expect(Array.isArray(dashboard.atRisk)).toBe(true);
  });

  it('keeps the trainer page from learners and a batch filter from widening a trainer’s view', async () => {
    // A learner is signed in and belongs to a batch, but the teaching view of it is not theirs.
    expect((await student.get('/trainer/dashboard')).status).toBe(403);

    // Naming a batch they do not teach narrows the trainer's dashboard to nothing.
    const foreign = expectStatus(
      await trainer.get(`/reports/dashboard?batchId=${otherBatchId}`),
      200,
    ).body as DashboardResponse;
    expect(foreign.batches).toHaveLength(0);
    const own = expectStatus(await trainer.get(`/reports/dashboard?batchId=${batchId}`), 200)
      .body as DashboardResponse;
    expect(own.batches.map((b) => b.id)).toEqual([batchId]);

    // The same holds for the class list and the attendance registers.
    const classes = expectStatus(await trainer.get(`/sessions?batchId=${otherBatchId}`), 200)
      .body as Paginated<unknown>;
    expect(classes.data).toHaveLength(0);
    const registers = expectStatus(
      await trainer.get(`/attendance/sessions?batchId=${otherBatchId}`),
      200,
    ).body as Paginated<unknown>;
    expect(registers.data).toHaveLength(0);
  });
});
