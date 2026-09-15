import { z } from 'zod';

/**
 * The reports the demo measures. Every one of them is a filtered table with a summary and a
 * chart over the same rows, so one page and one export job serve all five (plan DP-A24, DP-A25).
 */
export const REPORT_NAMES = [
  'students',
  'attendance',
  'progress',
  'assessments',
  'assignments',
] as const;
export type ReportName = (typeof REPORT_NAMES)[number];

/**
 * One filter bar for every report. A report ignores the filters that do not apply to it and says
 * so in `appliedFilters`, rather than silently dropping them.
 */
export const reportFilterSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  programId: z.uuid().optional(),
  batchId: z.uuid().optional(),
  courseId: z.uuid().optional(),
  trainerId: z.uuid().optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
export type ReportFilter = z.infer<typeof reportFilterSchema>;

/** The filters an export carries. It has no page of its own: an export is the whole filtered set. */
export const reportExportParamsSchema = reportFilterSchema.omit({ page: true, pageSize: true });
export type ReportExportParams = z.infer<typeof reportExportParamsSchema>;

export const REPORT_FILTER_KEYS = [
  'from',
  'to',
  'programId',
  'batchId',
  'courseId',
  'trainerId',
  'q',
] as const;
export type ReportFilterKey = (typeof REPORT_FILTER_KEYS)[number];

export type ReportCellType = 'text' | 'number' | 'percent' | 'date' | 'status';

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportCellType;
  sortable: boolean;
  /** Columns a narrow screen hides first, and the column chooser starts with unticked. */
  optional: boolean;
}

export type ReportCell = string | number | null;
export type ReportRow = Record<string, ReportCell>;

export interface ReportTile {
  key: string;
  label: string;
  value: number | null;
  unit: 'count' | 'percent' | 'marks';
  definition: string;
}

export interface ReportChart {
  kind: 'bar' | 'line';
  title: string;
  /** The row key each point is labelled by. */
  xKey: string;
  series: { key: string; label: string }[];
  data: ReportRow[];
  /** Said out loud under the chart, because a chart of 8 batches is not a chart of 60 students. */
  note: string;
}

export interface ReportDefinition {
  term: string;
  text: string;
}

export interface ReportDescriptor {
  name: ReportName;
  title: string;
  description: string;
  /** Which of the shared filters change this report's rows. */
  filters: ReportFilterKey[];
  route: string;
}

export interface ReportCatalogue {
  reports: ReportDescriptor[];
  /** Reports whose module is not in this build, listed so the page says what is coming. */
  pending: { name: string; title: string; reason: string }[];
}

export interface ReportData extends ReportDescriptor {
  columns: ReportColumn[];
  summary: ReportTile[];
  chart: ReportChart | null;
  rows: ReportRow[];
  meta: { page: number; pageSize: number; total: number };
  /** The filters the report actually used, echoed so the export can be asked for the same set. */
  appliedFilters: Partial<Record<ReportFilterKey, string>>;
  definitions: ReportDefinition[];
  asOf: string;
}

// ───────────────────────── exports ─────────────────────────

export const EXPORT_FORMATS = ['csv', 'xlsx'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_STATUSES = ['queued', 'running', 'ready', 'failed', 'expired'] as const;
export type ExportStatus = (typeof EXPORT_STATUSES)[number];

export const exportCreateSchema = z.object({
  report: z.enum(REPORT_NAMES),
  format: z.enum(EXPORT_FORMATS).default('xlsx'),
  params: reportExportParamsSchema.default({}),
});
export type ExportCreateInput = z.infer<typeof exportCreateSchema>;

export interface ExportJobRecord {
  id: string;
  report: ReportName;
  reportTitle: string;
  format: ExportFormat;
  status: ExportStatus;
  /** Rows written; equals the filtered total the report page showed. */
  rowCount: number | null;
  sizeBytes: number | null;
  filename: string;
  requestedByName: string | null;
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  error: string | null;
  /** False once the file has expired or the job failed. */
  downloadable: boolean;
}

export interface ExportDownload {
  url: string;
  filename: string;
  expiresAt: string;
}
