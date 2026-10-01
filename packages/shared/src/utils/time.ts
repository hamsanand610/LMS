import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from '../constants.js';

/** Formats an ISO timestamp for display in the institute's timezone (defaults to IST). */
export function formatDateTime(
  iso: string | Date,
  options: {
    timeZone?: string;
    locale?: string;
    dateStyle?: 'short' | 'medium' | 'long';
    timeStyle?: 'short' | 'medium';
  } = {},
): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(options.locale ?? DEFAULT_LOCALE, {
    timeZone: options.timeZone ?? DEFAULT_TIMEZONE,
    dateStyle: options.dateStyle ?? 'medium',
    timeStyle: options.timeStyle ?? 'short',
  }).format(date);
}

/** Formats the calendar date of an instant in the institute's timezone, e.g. "27 Sept 2026". */
export function formatDate(
  iso: string | Date,
  options: { timeZone?: string; locale?: string; dateStyle?: 'medium' | 'long' | 'full' } = {},
): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(options.locale ?? DEFAULT_LOCALE, {
    timeZone: options.timeZone ?? DEFAULT_TIMEZONE,
    dateStyle: options.dateStyle ?? 'medium',
  }).format(date);
}

/** Formats the time of day of an instant in the institute's timezone, e.g. "2:00 pm". */
export function formatTime(
  iso: string | Date,
  options: { timeZone?: string; locale?: string } = {},
): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(options.locale ?? DEFAULT_LOCALE, {
    timeZone: options.timeZone ?? DEFAULT_TIMEZONE,
    timeStyle: 'short',
  }).format(date);
}

/** Returns the calendar date (YYYY-MM-DD) of an instant in the given timezone. */
export function toLocalDateKey(iso: string | Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Splits `YYYY-MM-DD` into its parts, rejecting anything that is not a calendar date. */
function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new RangeError(`"${dateKey}" is not a calendar date (YYYY-MM-DD)`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Splits `HH:MM` into its parts, rejecting anything that is not a 24-hour time. */
function parseTimeOfDay(time: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new RangeError(`"${time}" is not a 24-hour time (HH:MM)`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** Minutes the zone is ahead of UTC at that instant (negative when behind). */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * Turns a wall-clock date and time in a named zone into the instant it refers to.
 * Everything is stored in UTC; timetables are written in the institute's own time.
 */
export function zonedDateTimeToUtc(
  dateKey: string,
  time: string,
  timeZone: string = DEFAULT_TIMEZONE,
): Date {
  const { year, month, day } = parseDateKey(dateKey);
  const { hour, minute } = parseTimeOfDay(time);
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const first = zoneOffsetMinutes(new Date(naive), timeZone);
  const candidate = naive - first * 60_000;
  // A second pass settles the daylight-saving boundaries, where the offset moves.
  const second = zoneOffsetMinutes(new Date(candidate), timeZone);
  return second === first ? new Date(candidate) : new Date(naive - second * 60_000);
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Weekday of a calendar date key, as the three-letter key timetables use. */
export function weekdayOfDateKey(dateKey: string): WeekdayKey {
  const { year, month, day } = parseDateKey(dateKey);
  const index = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WEEKDAY_KEYS[index] ?? 'sun';
}

/** The most days one range may cover, so a mistyped year cannot generate forever. */
const MAX_RANGE_DAYS = 1500;

/** Every calendar date key from `from` to `to` inclusive. */
export function dateKeysBetween(from: string, to: string): string[] {
  const start = parseDateKey(from);
  const finish = parseDateKey(to);
  const end = Date.UTC(finish.year, finish.month - 1, finish.day);
  const keys: string[] = [];
  for (
    let cursor = Date.UTC(start.year, start.month - 1, start.day);
    cursor <= end && keys.length < MAX_RANGE_DAYS;
    cursor += 24 * 60 * 60 * 1000
  ) {
    keys.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return keys;
}

/** Shifts a calendar date key by whole days. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const shifted = Date.UTC(year, month - 1, day) + days * 24 * 60 * 60 * 1000;
  return new Date(shifted).toISOString().slice(0, 10);
}
