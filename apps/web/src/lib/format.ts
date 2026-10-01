import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, humaniseKey, toLocalDateKey } from '@lms/shared';

/*
 * Every date and time on screen goes through here (operating rule 33): the institute's time zone
 * (IST), the en-IN conventions ("27 Sept 2026", "9:30 am"), one style everywhere. Pinning the zone
 * also means the server and the browser print the same text, so a server-rendered date can never
 * mismatch on hydration — which is what broke both Schedule pages.
 */

export type DateInput = string | number | Date;

const toDate = (value: DateInput): Date => (value instanceof Date ? value : new Date(value));

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let existing = formatters.get(key);
  if (!existing) {
    existing = new Intl.DateTimeFormat(DEFAULT_LOCALE, { timeZone: DEFAULT_TIMEZONE, ...options });
    formatters.set(key, existing);
  }
  return existing;
}

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

/** 27 Sept 2026 */
export function formatDate(value: DateInput): string {
  return formatter(DATE).format(toDate(value));
}

/** 27 Sept */
export function formatDayMonth(value: DateInput): string {
  return formatter({ day: 'numeric', month: 'short' }).format(toDate(value));
}

/** Sun, 27 Sept */
export function formatWeekdayDate(value: DateInput): string {
  return formatter({ weekday: 'short', day: 'numeric', month: 'short' }).format(toDate(value));
}

/** 9:30 am */
export function formatTime(value: DateInput): string {
  return formatter(TIME).format(toDate(value));
}

/** 9:30:15 am — only where the seconds say something is fresh (autosave, a live monitor). */
export function formatTimeWithSeconds(value: DateInput): string {
  return formatter({ ...TIME, second: '2-digit' }).format(toDate(value));
}

/** 27 Sept 2026, 9:30 am */
export function formatDateTime(value: DateInput): string {
  return formatter({ ...DATE, ...TIME }).format(toDate(value));
}

/** Sun, 27 Sept, 9:30 am */
export function formatWeekdayDateTime(value: DateInput): string {
  return formatter({ weekday: 'short', day: 'numeric', month: 'short', ...TIME }).format(
    toDate(value),
  );
}

/** 9:30 – 11:00 am (the shared half is written once). */
export function formatTimeRange(start: DateInput, end: DateInput): string {
  return formatter(TIME).formatRange(toDate(start), toDate(end));
}

/** 21–27 Sept 2026, or 28 Sept – 4 Oct 2026: the shared month and year written once. */
export function formatDateRange(start: DateInput, end: DateInput): string {
  return formatter(DATE).formatRange(toDate(start), toDate(end));
}

/** A calendar date key (YYYY-MM-DD) as "27 Sept 2026", with no time zone arithmetic to go wrong. */
export function formatDateKey(dateKey: string): string {
  return formatter({ ...DATE, timeZone: 'UTC' }).format(new Date(`${dateKey}T12:00:00Z`));
}

/** Month and year, for calendars: "September 2026". */
export function formatMonthYear(value: DateInput): string {
  return formatter({ month: 'long', year: 'numeric' }).format(toDate(value));
}

const relative = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: 'auto' });

/** Whole calendar days from `now` to `value`, counted in the institute's time zone. */
export function daysFrom(now: number, value: DateInput): number {
  const a = toLocalDateKey(new Date(now));
  const b = toLocalDateKey(toDate(value));
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** "today", "tomorrow", "in 3 days", "2 days ago" — by calendar day in the institute's zone. */
export function formatRelativeDay(value: DateInput, now: number): string {
  return relative.format(daysFrom(now, value), 'day');
}

/** A plain count with the institute's digit grouping: 12,345 (en-IN groups lakhs: 1,23,456). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE).format(value);
}

/**
 * A stored key in words for a label: `mock_test` → "Mock test", `core-java` → "Core Java",
 * `sql` → "SQL". The same rule the API uses (`humaniseKey` in @lms/shared).
 */
export function humanise(value: string): string {
  return humaniseKey(value);
}

/** A calendar date key (YYYY-MM-DD) as "27 Sept", for chart axes and compact lists. */
export function formatDateKeyShort(dateKey: string): string {
  return formatter({ day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${dateKey}T12:00:00Z`),
  );
}

/** Sun */
export function formatWeekday(value: DateInput): string {
  return formatter({ weekday: 'short' }).format(toDate(value));
}

/** A calendar date key (YYYY-MM-DD) as "Sun, 27 Sept". */
export function formatDateKeyWeekday(dateKey: string): string {
  return formatter({ weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${dateKey}T12:00:00Z`),
  );
}

/** A duration in minutes as "45 min", "6 h" or "12 h 30 min". */
export function formatMinutes(total: number): string {
  const minutes = Math.max(0, Math.round(total));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "1 day", "3 days": a count with its noun, singular when it is one. */
export function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${formatNumber(count)} ${count === 1 ? noun : pluralNoun}`;
}
