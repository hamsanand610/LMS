import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from '@lms/shared';

/** "Good morning" / "Good afternoon" / "Good evening" by the institute's clock. Server-side only. */
export function greetingFor(instant: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat(DEFAULT_LOCALE, {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: DEFAULT_TIMEZONE,
    }).format(instant),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "Sunday, 27 September", for a dashboard's eyebrow. */
export function longDate(instant: Date): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: DEFAULT_TIMEZONE,
  }).format(instant);
}

export function firstName(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? 'there';
}
