import { describe, expect, it } from 'vitest';
import { ValidationError } from './errors.js';
import { paginate, parseSort, skipTake } from './pagination.js';

const FIELDS = ['name', 'createdAt'] as const;

describe('parseSort', () => {
  it('falls back to the default order when no sort is given', () => {
    expect(parseSort(undefined, FIELDS, { field: 'createdAt', direction: 'desc' })).toEqual([
      { field: 'createdAt', direction: 'desc' },
    ]);
    expect(parseSort(' , ', FIELDS, { field: 'name', direction: 'asc' })).toEqual([
      { field: 'name', direction: 'asc' },
    ]);
  });

  it('parses a leading minus as descending and keeps the order of fields', () => {
    expect(parseSort('-createdAt, name', FIELDS, { field: 'name', direction: 'asc' })).toEqual([
      { field: 'createdAt', direction: 'desc' },
      { field: 'name', direction: 'asc' },
    ]);
  });

  it('rejects fields outside the whitelist with a validation error', () => {
    expect(() => parseSort('passwordHash', FIELDS, { field: 'name', direction: 'asc' })).toThrow(
      ValidationError,
    );
  });
});

describe('paginate and skipTake', () => {
  it('computes offsets from 1-based pages', () => {
    expect(skipTake({ page: 1, pageSize: 25 })).toEqual({ skip: 0, take: 25 });
    expect(skipTake({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 });
  });

  it('wraps rows with metadata', () => {
    expect(paginate(['a'], 41, { page: 2, pageSize: 20 })).toEqual({
      data: ['a'],
      meta: { page: 2, pageSize: 20, total: 41 },
    });
  });
});
