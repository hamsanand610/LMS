import { z } from 'zod';

export const idSchema = z.string().min(1).max(64);

/** Trimmed and lower-cased before validation so a stray space never blocks a sign-in. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** Indian mobile numbers are the default; international numbers allowed with a leading +. */
export const mobileSchema = z
  .string()
  .trim()
  .regex(
    /^(\+?[1-9]\d{6,14})$/,
    'Enter a valid mobile number with country code, e.g. +919876543210',
  );

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters');

export const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'Use a 6-digit hex colour like #0B6E4F');

export const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and hyphens');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().max(100).optional(),
  q: z.string().max(200).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

/**
 * How an uploaded sheet reaches the API. `text` is a CSV or TSV file read as text; `base64` is a
 * binary workbook (`.xlsx`), which JSON cannot carry any other way.
 */
export const SHEET_ENCODINGS = ['text', 'base64'] as const;
export type SheetEncoding = (typeof SHEET_ENCODINGS)[number];
