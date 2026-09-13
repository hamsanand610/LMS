import { describe, expect, it } from 'vitest';
import { formatDateTime, toLocalDateKey } from './time.js';

describe('toLocalDateKey', () => {
  it('uses the institute timezone (IST by default), not UTC', () => {
    // 19:30 UTC on 31 December is already 01:00 on 1 January in Asia/Kolkata (+05:30).
    expect(toLocalDateKey('2026-12-31T19:30:00Z')).toBe('2027-01-01');
    expect(toLocalDateKey('2026-12-31T18:29:59Z')).toBe('2026-12-31');
    expect(toLocalDateKey('2026-12-31T19:30:00Z', 'UTC')).toBe('2026-12-31');
  });

  it('accepts Date instances', () => {
    expect(toLocalDateKey(new Date('2026-03-01T00:00:00Z'))).toBe('2026-03-01');
  });
});

describe('formatDateTime', () => {
  it('formats in the requested timezone and locale', () => {
    const iso = '2026-09-13T12:30:00Z';
    expect(formatDateTime(iso, { timeZone: 'Asia/Kolkata', locale: 'en-GB' })).toMatch(
      /13 Sept 2026, 18:00/,
    );
    expect(formatDateTime(iso, { timeZone: 'UTC', locale: 'en-GB', timeStyle: 'medium' })).toMatch(
      /12:30:00/,
    );
  });
});
