import { z } from 'zod';

/**
 * Admin dashboard payload. Metrics that need modules from later phases are returned as `null`
 * with a stated reason, so the page never shows an invented number.
 */
export interface DashboardMetric {
  key: string;
  label: string;
  /** null = not measurable yet; the page shows the `pending` note instead of a figure. */
  value: number | null;
  unit: 'count' | 'percent';
  /** Change against the comparison window, when one can be computed. */
  delta: number | null;
  definition: string;
  pending: string | null;
}

export interface DashboardResponse {
  asOf: string;
  range: { from: string; to: string };
  metrics: DashboardMetric[];
  batches: {
    id: string;
    code: string;
    name: string;
    status: string;
    studentCount: number;
    capacity: number;
    startDate: string;
  }[];
  recentStudents: { id: string; name: string; studentCode: string; createdAt: string }[];
}

export const dashboardQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  programId: z.uuid().optional(),
  batchId: z.uuid().optional(),
});

// ───────────────────────── search ─────────────────────────

export const SEARCH_TYPES = ['student', 'trainer', 'batch', 'program', 'user'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  types: z
    .union([z.array(z.enum(SEARCH_TYPES)), z.string()])
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const list = Array.isArray(v) ? v : v.split(',').map((s) => s.trim());
      return list.filter((t): t is SearchType => (SEARCH_TYPES as readonly string[]).includes(t));
    }),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export interface SearchHit {
  type: SearchType;
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

export interface SearchResponse {
  groups: { type: SearchType; label: string; hits: SearchHit[] }[];
  total: number;
}

// ───────────────────────── student import ─────────────────────────

export const IMPORT_JOB_STATUSES = ['queued', 'running', 'done', 'failed'] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

/** Columns of the student import sheet; `name` and `email` are the only required ones. */
export const STUDENT_IMPORT_COLUMNS = [
  'name',
  'email',
  'mobile',
  'batchCode',
  'status',
  'dateOfBirth',
  'gender',
  'guardianName',
  'guardianMobile',
  'city',
  'state',
  'qualification',
  'institution',
  'yearOfPassing',
] as const;

export const studentImportSchema = z.object({
  /** Raw sheet contents (CSV or TSV, ≤ 5 MB, ≤ 5,000 rows). */
  content: z
    .string()
    .min(1)
    .max(5 * 1024 * 1024),
  filename: z.string().trim().max(200).default('students.csv'),
  batchId: z.uuid().nullable().default(null),
  sendInvitations: z.boolean().default(true),
  /** Validate and report without writing anything. */
  dryRun: z.boolean().default(false),
});
export type StudentImportInput = z.infer<typeof studentImportSchema>;

export interface ImportRowError {
  row: number;
  column: string | null;
  value: string;
  message: string;
}

export interface ImportJobResult {
  id: string;
  status: ImportJobStatus;
  filename: string;
  dryRun: boolean;
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: ImportRowError[];
  startedAt: string | null;
  finishedAt: string | null;
}
