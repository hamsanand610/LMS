import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  ExportCreateInput,
  ExportDownload,
  ExportFormat,
  ExportJobRecord,
  ExportStatus,
  Paginated,
  ReportExportParams,
  ReportName,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { AuthContextService } from '../../core/auth/auth-context.service.js';
import { type AuthUser, hasPermission, scopeFor } from '../../core/auth/auth-user.js';
import {
  AppError,
  DomainRuleError,
  ForbiddenError,
  GoneError,
  NotFoundError,
} from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { SheetsService } from '../../core/sheets/sheets.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { NotificationsService } from '../notifications/index.js';
import { ReportsService } from './reports.service.js';

export const EXPORT_JOB = 'reports.export';

/** How long a file stays downloadable (plan DP-A26). */
const EXPIRY_DAYS = 7;

/** How many exports one person may have running or queued at once. */
const CONCURRENT_LIMIT = 3;

interface ExportJobPayload {
  exportId: string;
  userId: string;
}

const MIME: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Export jobs. The request returns at once with an id; a job builds the file from the same rows
 * the report page showed, writes it to private storage and tells the person it is ready
 * (journey J-12). Re-running a job is safe: a file that already exists is simply rewritten.
 */
@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly auth: AuthContextService,
    private readonly jobs: JobsService,
    private readonly reports: ReportsService,
    private readonly sheets: SheetsService,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {
    this.jobs.register<ExportJobPayload>(EXPORT_JOB, async (payload) => {
      await this.run(payload.exportId, payload.userId);
    });
  }

  /** Queues an export of exactly the rows the caller's filters select. */
  async create(input: ExportCreateInput, user: AuthUser): Promise<ExportJobRecord> {
    const org = await this.tenant.getOrganization();
    const running = await this.prisma.reportExport.count({
      where: {
        organizationId: org.id,
        requestedById: user.id,
        status: { in: ['queued', 'running'] },
      },
    });
    if (running >= CONCURRENT_LIMIT) {
      throw new DomainRuleError(
        `You already have ${running} exports running. Wait for one to finish.`,
        'too_many_exports',
      );
    }

    const title =
      this.reports.catalogue().reports.find((r) => r.name === input.report)?.title ?? input.report;
    const stamp = new Date().toISOString().slice(0, 10);
    const record = await this.prisma.reportExport.create({
      data: {
        organizationId: org.id,
        report: input.report,
        format: input.format,
        params: input.params as object,
        status: 'queued',
        filename: `${input.report}-${stamp}.${input.format}`,
        requestedById: user.id,
      },
      include: { requestedBy: { select: { name: true } } },
    });

    await this.audit.record({
      action: 'export.requested',
      resourceType: 'report_export',
      resourceId: record.id,
      summary: `${title} as ${input.format.toUpperCase()}`,
      after: { report: input.report, format: input.format, params: input.params },
    });
    await this.jobs.enqueue<ExportJobPayload>(EXPORT_JOB, { exportId: record.id, userId: user.id });

    return toRecord(record, title);
  }

  async list(
    query: { page: number; pageSize: number },
    user: AuthUser,
  ): Promise<Paginated<ExportJobRecord>> {
    const org = await this.tenant.getOrganization();
    const where = { organizationId: org.id, requestedById: user.id };
    const [total, rows] = await Promise.all([
      this.prisma.reportExport.count({ where }),
      this.prisma.reportExport.findMany({
        where,
        include: { requestedBy: { select: { name: true } } },
        orderBy: { requestedAt: 'desc' },
        ...skipTake(query),
      }),
    ]);
    const titles = this.titles();
    return paginate(
      rows.map((row) => toRecord(row, titles.get(row.report) ?? row.report)),
      total,
      query,
    );
  }

  async get(id: string, user: AuthUser): Promise<ExportJobRecord> {
    const record = await this.require(id, user);
    return toRecord(record, this.titles().get(record.report) ?? record.report);
  }

  /** A short-lived link to the file. The object itself expires after a week. */
  async download(id: string, user: AuthUser): Promise<ExportDownload> {
    const record = await this.require(id, user);
    if (record.status !== 'ready' || !record.objectKey) {
      throw new DomainRuleError('That export is not ready to download.', 'export_not_ready');
    }
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      await this.prisma.reportExport.update({
        where: { id },
        data: { status: 'expired' },
      });
      throw new GoneError('That export has expired. Ask for it again.', 'export_expired');
    }

    const url = await this.storage.presignDownload(
      'private',
      record.objectKey,
      300,
      record.filename,
    );
    await this.audit.record({
      action: 'export.downloaded',
      resourceType: 'report_export',
      resourceId: id,
      summary: record.filename,
    });
    return {
      url,
      filename: record.filename,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };
  }

  /**
   * Builds the file. Runs in the worker (or inline when the queue is off), as the person who
   * asked for it, so the rows are exactly the ones their permissions allow.
   */
  async run(exportId: string, userId: string): Promise<void> {
    const record = await this.prisma.reportExport.findUnique({ where: { id: exportId } });
    if (!record || record.status === 'ready') return;

    await this.prisma.reportExport.update({
      where: { id: exportId },
      data: { status: 'running', startedAt: new Date(), error: '' },
    });

    try {
      const user = await this.authUserFor(userId);
      const report = record.report as ReportName;
      const params = record.params as ReportExportParams;
      const { rows, title } = await this.reports.allRows(report, params, user);
      const columns = this.reports.columnsFor(report).map((column) => ({
        key: column.key,
        header: column.label,
      }));

      const format = record.format as ExportFormat;
      const body =
        format === 'csv'
          ? this.sheets.writeCsv(columns, rows)
          : await this.sheets.writeWorkbook(title, columns, rows);

      const key = `exports/${record.organizationId}/${exportId}/${record.filename}`;
      await this.storage.put('private', key, body, MIME[format]);

      const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 86_400_000);
      await this.prisma.reportExport.update({
        where: { id: exportId },
        data: {
          status: 'ready',
          rowCount: rows.length,
          sizeBytes: body.byteLength,
          objectKey: key,
          completedAt: new Date(),
          expiresAt,
        },
      });

      await this.notifications.deliver({
        category: 'account',
        type: 'export.ready',
        title: `${title} export is ready`,
        body: `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}. The file is kept for ${EXPIRY_DAYS} days.`,
        link: await this.exportsPage(userId),
        channels: ['in_app'],
        userIds: [userId],
      });
      this.logger.log(`Export ${exportId} wrote ${rows.length} rows`);
    } catch (error) {
      // A domain error was written for people to read; anything else (a database or storage
      // fault) stays in the log, and the person who asked gets a plain sentence.
      const detail =
        error instanceof AppError
          ? (error.detail ?? error.title)
          : 'Something went wrong while building the file. Try again, and tell an administrator if it keeps happening.';
      await this.prisma.reportExport.update({
        where: { id: exportId },
        data: { status: 'failed', error: detail.slice(0, 500), completedAt: new Date() },
      });
      this.logger.error({ err: error, exportId }, 'An export failed');
      await this.notifications.deliver({
        category: 'account',
        type: 'export.failed',
        title: 'An export could not be produced',
        body: detail.slice(0, 200),
        link: await this.exportsPage(userId),
        channels: ['in_app'],
        userIds: [userId],
      });
    }
  }

  private titles(): Map<string, string> {
    return new Map(this.reports.catalogue().reports.map((r) => [r.name, r.title]));
  }

  private async require(id: string, user: AuthUser) {
    const org = await this.tenant.getOrganization();
    const record = await this.prisma.reportExport.findFirst({
      where: { id, organizationId: org.id },
      include: { requestedBy: { select: { name: true } } },
    });
    if (!record) throw new NotFoundError('Export');
    if (record.requestedById !== user.id) {
      throw new ForbiddenError('That export belongs to somebody else.');
    }
    return record;
  }

  /**
   * Rebuilds the requester's permissions for the job, because a job has no request of its own
   * and the rows must be the ones that person may see.
   */
  /**
   * Where the person who asked keeps their exports: the administrator's page for institute-wide
   * exporters, the trainer's for someone exporting their own batches (a link to the other is a 403).
   */
  private async exportsPage(userId: string): Promise<string> {
    const user = await this.auth.load(userId);
    return user && scopeFor({ ...user, sessionId: null }, 'reports:export') === 'all'
      ? '/admin/exports'
      : '/trainer/exports';
  }

  private async authUserFor(userId: string): Promise<AuthUser> {
    const context = await this.auth.load(userId);
    if (!context) throw new NotFoundError('User');
    // Built for the person as they are now, not as they were when they asked: an account switched
    // off, or a permission withdrawn, in between gets no file (Phase 6).
    const user: AuthUser = { ...context, sessionId: null };
    if (context.status !== 'active' || !hasPermission(user, 'reports:export')) {
      throw new ForbiddenError('This account can no longer export reports.');
    }
    return user;
  }
}

function toRecord(
  row: {
    id: string;
    report: string;
    format: string;
    status: string;
    rowCount: number | null;
    sizeBytes: number | null;
    filename: string;
    objectKey: string;
    error: string;
    requestedAt: Date;
    completedAt: Date | null;
    expiresAt: Date | null;
    requestedBy?: { name: string } | null;
  },
  title: string,
): ExportJobRecord {
  const expired = row.expiresAt !== null && row.expiresAt.getTime() < Date.now();
  const status = (expired && row.status === 'ready' ? 'expired' : row.status) as ExportStatus;
  return {
    id: row.id,
    report: row.report as ReportName,
    reportTitle: title,
    format: row.format as ExportFormat,
    status,
    rowCount: row.rowCount,
    sizeBytes: row.sizeBytes,
    filename: row.filename,
    requestedByName: row.requestedBy?.name ?? null,
    requestedAt: row.requestedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    error: row.error || null,
    downloadable: status === 'ready' && row.objectKey.length > 0,
  };
}
