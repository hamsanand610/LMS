import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { SettingsService } from '../settings/settings.service.js';

export const RETENTION_JOB = 'retention.sweep';

/** Finished import sheets keep their rows this long, for the import report, and no longer. */
const IMPORT_SHEET_DAYS = 30;

/**
 * Retention (Phases 3–4, ADM-12): an export file goes when its link expires; a finished import
 * keeps its counts but not, after thirty days, the rows it was given (names, e-mails, numbers);
 * audit entries are removed after the period the Super Admin sets, never under three years, and
 * by default never. Each sweep that removes anything records what it removed.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {
    this.jobs.register(
      RETENTION_JOB,
      async () => {
        await this.sweep();
      },
      { cron: '30 2 * * *' },
    );
  }

  async sweep(
    now = new Date(),
  ): Promise<{ exports: number; imports: number; auditEntries: number }> {
    const expired = await this.prisma.reportExport.findMany({
      where: { status: 'ready', expiresAt: { lt: now } },
      select: { id: true, objectKey: true },
      take: 500,
    });
    for (const row of expired) {
      if (row.objectKey) await this.storage.delete('private', row.objectKey);
      await this.prisma.reportExport.update({
        where: { id: row.id },
        data: { status: 'expired', objectKey: '' },
      });
    }

    const sheetsBefore = new Date(now.getTime() - IMPORT_SHEET_DAYS * 86_400_000);
    const imports = await this.prisma.importJob.updateMany({
      where: {
        finishedAt: { lt: sheetsBefore },
        NOT: { params: { equals: {} } },
      },
      data: { params: {}, errors: [] },
    });

    const { auditRetentionDays } = await this.settings.getSection('records');
    let auditEntries = 0;
    if (auditRetentionDays !== null) {
      const result = await this.prisma.auditLog.deleteMany({
        where: { occurredAt: { lt: new Date(now.getTime() - auditRetentionDays * 86_400_000) } },
      });
      auditEntries = result.count;
    }

    const removed = { exports: expired.length, imports: imports.count, auditEntries };
    if (removed.exports + removed.imports + removed.auditEntries > 0) {
      await this.audit.record({
        action: 'retention.swept',
        resourceType: 'retention',
        resourceId: null,
        summary: `Retention removed ${removed.exports} export file(s), ${removed.imports} import sheet(s) and ${removed.auditEntries} audit entr(ies)`,
        after: removed,
        actorId: null,
      });
      this.logger.log(removed, 'Retention sweep');
    }
    return removed;
  }
}
