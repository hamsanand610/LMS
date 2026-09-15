import { Injectable } from '@nestjs/common';
import type {
  ReportCatalogue,
  ReportData,
  ReportExportParams,
  ReportFilter,
  ReportFilterKey,
  ReportName,
  ReportRow,
} from '@lms/shared';
import { REPORT_FILTER_KEYS } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { NotFoundError, ValidationError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { AttendanceService } from '../attendance/index.js';
import {
  PENDING_REPORTS,
  REPORT_BUILDERS,
  type ReportContext,
  type ReportResult,
} from './report-builders.js';

/**
 * The report engine. One method builds the rows; the page asks for a slice of them and an export
 * asks for all of them, so a downloaded file cannot disagree with the table it came from
 * (plan DP-A25, journey J-12).
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
    private readonly attendance: AttendanceService,
  ) {}

  catalogue(): ReportCatalogue {
    return {
      reports: Object.values(REPORT_BUILDERS).map((builder) => builder.descriptor),
      pending: PENDING_REPORTS,
    };
  }

  /** One page of a report, with its summary, chart and definitions. */
  async page(name: ReportName, filter: ReportFilter, user: AuthUser): Promise<ReportData> {
    const builder = REPORT_BUILDERS[name];
    if (!builder) throw new NotFoundError('Report');

    const ctx = await this.context(filter, user);
    const result = await builder.build(ctx);
    const sorted = sortRows(result.rows, filter.sort || builder.defaultSort, builder.columns);
    const start = (filter.page - 1) * filter.pageSize;

    return {
      ...builder.descriptor,
      columns: builder.columns,
      summary: result.summary,
      chart: result.chart,
      rows: sorted.slice(start, start + filter.pageSize),
      meta: { page: filter.page, pageSize: filter.pageSize, total: sorted.length },
      appliedFilters: appliedFilters(filter, builder.descriptor.filters),
      definitions: builder.definitions,
      asOf: new Date().toISOString(),
    };
  }

  /**
   * Every row of a report, in the order the page would show them. The export job uses this, so
   * the file it writes has exactly the rows the filtered table had.
   */
  async allRows(
    name: ReportName,
    params: ReportExportParams,
    user: AuthUser,
  ): Promise<{ rows: ReportRow[]; result: ReportResult; title: string }> {
    const builder = REPORT_BUILDERS[name];
    if (!builder) throw new NotFoundError('Report');

    const filter: ReportFilter = { ...params, page: 1, pageSize: 1 };
    const ctx = await this.context(filter, user);
    const result = await builder.build(ctx);
    return {
      rows: sortRows(result.rows, params.sort || builder.defaultSort, builder.columns),
      result,
      title: builder.descriptor.title,
    };
  }

  columnsFor(name: ReportName) {
    const builder = REPORT_BUILDERS[name];
    if (!builder) throw new NotFoundError('Report');
    return builder.columns;
  }

  /**
   * Narrows the batches a report may read to the caller's scope, the chosen batch and the chosen
   * programme, once, so no builder has to repeat it.
   */
  private async context(filter: ReportFilter, user: AuthUser): Promise<ReportContext> {
    const org = await this.tenant.getOrganization();
    const visible = await this.scope.visibleBatchIds(user, 'reports:read');

    let batchIds: string[] | null = visible;
    if (filter.programId) {
      const inProgram = await this.prisma.batch.findMany({
        where: { organizationId: org.id, deletedAt: null, programId: filter.programId },
        select: { id: true },
      });
      const ids = inProgram.map((b) => b.id);
      batchIds = batchIds === null ? ids : batchIds.filter((id) => ids.includes(id));
    }
    if (filter.trainerId) {
      const taught = await this.prisma.batchTrainer.findMany({
        where: { trainerId: filter.trainerId },
        select: { batchId: true },
      });
      const ids = taught.map((b) => b.batchId);
      batchIds = batchIds === null ? ids : batchIds.filter((id) => ids.includes(id));
    }
    if (filter.batchId) {
      batchIds =
        batchIds === null ? [filter.batchId] : batchIds.filter((id) => id === filter.batchId);
    }

    const rules = await this.attendance.rules();
    return {
      prisma: this.prisma,
      organizationId: org.id,
      timezone: org.timezone,
      batchIds,
      filter,
      from: filter.from ? new Date(`${filter.from}T00:00:00.000Z`) : null,
      to: filter.to ? new Date(`${filter.to}T23:59:59.999Z`) : null,
      rules: { countedStatuses: rules.countedStatuses, thresholdPct: rules.thresholdPct },
    };
  }
}

/** Which of the shared filters this report actually used, echoed back for the export. */
function appliedFilters(
  filter: ReportFilter,
  supported: ReportFilterKey[],
): Partial<Record<ReportFilterKey, string>> {
  const applied: Partial<Record<ReportFilterKey, string>> = {};
  for (const key of REPORT_FILTER_KEYS) {
    if (!supported.includes(key)) continue;
    const value = filter[key];
    if (typeof value === 'string' && value.length > 0) applied[key] = value;
  }
  return applied;
}

/**
 * Sorts by one column. Rows are built in memory because they draw on four modules at once, so the
 * sort happens here too and the page and the export are guaranteed the same order.
 */
function sortRows(
  rows: ReportRow[],
  sort: string,
  columns: { key: string; sortable: boolean }[],
): ReportRow[] {
  const descending = sort.startsWith('-');
  const key = descending ? sort.slice(1) : sort;
  const column = columns.find((c) => c.key === key);
  if (!column || !column.sortable) {
    throw new ValidationError([{ path: 'sort', message: `Cannot sort by "${key}"` }]);
  }

  return [...rows].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    // A row with no value sorts last whichever way the column is pointing.
    if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
    if (right === null || right === undefined) return -1;
    const comparison =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));
    return descending ? -comparison : comparison;
  });
}
