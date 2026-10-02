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

/**
 * A link someone types for others to open (a class's join link, a portfolio). Web addresses only:
 * a `javascript:` or `data:` link would run in the browser of whoever clicks it.
 */
export function webUrlSchema(max: number) {
  return z
    .url({ protocol: /^https?$/, error: 'Use a web address starting with https://' })
    .max(max);
}

/** A web address, or an empty string for "none". */
export function webUrlOrEmptySchema(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .pipe(z.union([z.literal(''), webUrlSchema(max)]));
}

/** The same, empty when the field is left out. */
export function optionalWebUrlSchema(max: number) {
  return webUrlOrEmptySchema(max).default('');
}

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

/** A field schema without the default it may carry, however deeply it is wrapped in defaults. */
type WithoutDefault<T> = T extends z.ZodDefault<infer Inner> ? WithoutDefault<Inner> : T;

/**
 * The schema of a change to some of a record's fields (a PATCH): every field optional, and a
 * field left out stays left out. Zod 4 fills a field's default even under `.partial()` and
 * `.optional()`, so a plain `.partial()` of a create schema resets every field the request did
 * not mention — the course a trainer retitles would lose its tags and picture, a test its
 * settings. A field that is sent is still checked by its own schema.
 */
export function patchSchemaOf<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
): z.ZodObject<{ [K in keyof Shape]: z.ZodOptional<WithoutDefault<Shape[K]>> }> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    let inner = field as z.ZodType;
    while (inner instanceof z.ZodDefault) inner = inner.unwrap() as z.ZodType;
    shape[key] = inner.optional();
  }
  return z.object(shape) as unknown as z.ZodObject<{
    [K in keyof Shape]: z.ZodOptional<WithoutDefault<Shape[K]>>;
  }>;
}

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
