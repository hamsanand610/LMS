import type { Paginated, PaginationQuery } from '@lms/shared';
import { ValidationError } from './errors.js';

/** Parses `?sort=-createdAt,name` against a whitelist into Prisma orderBy entries. */
export function parseSort<T extends string>(
  sort: string | undefined,
  allowed: readonly T[],
  fallback: { field: T; direction: 'asc' | 'desc' },
): { field: T; direction: 'asc' | 'desc' }[] {
  if (!sort) return [fallback];
  const entries = sort
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((token) => {
      const direction = token.startsWith('-') ? 'desc' : 'asc';
      const field = (token.startsWith('-') ? token.slice(1) : token) as T;
      if (!allowed.includes(field)) {
        throw new ValidationError([{ path: 'sort', message: `Unsupported sort field "${field}"` }]);
      }
      return { field, direction } as const;
    });
  return entries.length ? entries : [fallback];
}

export function paginate<T>(
  data: T[],
  total: number,
  query: Pick<PaginationQuery, 'page' | 'pageSize'>,
): Paginated<T> {
  return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export function skipTake(query: Pick<PaginationQuery, 'page' | 'pageSize'>): {
  skip: number;
  take: number;
} {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}
