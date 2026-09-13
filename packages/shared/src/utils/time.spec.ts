import { describe, expect, it } from 'vitest';
import {
  addDaysToDateKey,
  dateKeysBetween,
  formatDateTime,
  toLocalDateKey,
  weekdayOfDateKey,
  zonedDateTimeToUtc,
} from './time.js';

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

describe('zonedDateTimeToUtc', () => {
  it('reads the time as institute wall-clock, not UTC', () => {
    // 09:30 in IST (UTC+05:30) is 04:00 UTC on the same day.
    expect(zonedDateTimeToUtc('2026-09-02', '09:30', 'Asia/Kolkata').toISOString()).toBe(
      '2026-09-02T04:00:00.000Z',
    );
    expect(zonedDateTimeToUtc('2026-09-02', '09:30', 'UTC').toISOString()).toBe(
      '2026-09-02T09:30:00.000Z',
    );
  });

  it('handles a zone that changes offset during the year', () => {
    // London is UTC+01:00 in July and UTC+00:00 in January.
    expect(zonedDateTimeToUtc('2026-07-01', '09:00', 'Europe/London').toISOString()).toBe(
      '2026-07-01T08:00:00.000Z',
    );
    expect(zonedDateTimeToUtc('2026-01-01', '09:00', 'Europe/London').toISOString()).toBe(
      '2026-01-01T09:00:00.000Z',
    );
  });

  it('round-trips back to the same calendar date in that zone', () => {
    const instant = zonedDateTimeToUtc('2026-12-31', '23:30', 'Asia/Kolkata');
    expect(toLocalDateKey(instant, 'Asia/Kolkata')).toBe('2026-12-31');
  });

  it('refuses input that is not a date and a time', () => {
    expect(() => zonedDateTimeToUtc('31-12-2026', '09:00')).toThrow(/calendar date/);
    expect(() => zonedDateTimeToUtc('2026-12-31', '9am')).toThrow(/24-hour time/);
  });
});

describe('weekdayOfDateKey and dateKeysBetween', () => {
  it('names the weekday of a calendar date', () => {
    expect(weekdayOfDateKey('2026-09-13')).toBe('sun');
    expect(weekdayOfDateKey('2026-09-14')).toBe('mon');
  });

  it('lists every date in the range, both ends included', () => {
    expect(dateKeysBetween('2026-09-01', '2026-09-04')).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
    ]);
    expect(dateKeysBetween('2026-09-01', '2026-08-31')).toEqual([]);
  });

  it('shifts a date by whole days across a month boundary', () => {
    expect(addDaysToDateKey('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysToDateKey('2026-09-01', -1)).toBe('2026-08-31');
  });
});
