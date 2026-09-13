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
