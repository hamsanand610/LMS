import { describe, expect, it } from 'vitest';
import { findConflicts, findInternalConflicts, generateOccurrences } from './recurrence.js';

const IST = 'Asia/Kolkata';

const base = {
  weekdays: ['mon', 'wed'] as ('mon' | 'wed')[],
  startsTime: '09:30',
  endsTime: '11:00',
  fromDate: '2026-09-01',
  untilDate: '2026-09-30',
  skipDates: [] as string[],
};

describe('generateOccurrences', () => {
  it('places a class on each chosen weekday inside the range', () => {
    const occurrences = generateOccurrences(base, IST);
    expect(occurrences).toHaveLength(9);
    expect(occurrences[0]?.dateKey).toBe('2026-09-02'); // the first Wednesday
    expect(occurrences.at(-1)?.dateKey).toBe('2026-09-30');
  });

  it('writes the instant that the institute wall-clock time refers to', () => {
    const [first] = generateOccurrences(base, IST);
    // 09:30 in IST (UTC+05:30) is 04:00 UTC.
    expect(first?.startsAt.toISOString()).toBe('2026-09-02T04:00:00.000Z');
    expect(first?.endsAt.toISOString()).toBe('2026-09-02T05:30:00.000Z');
  });

  it('respects the timezone it is given', () => {
    const [first] = generateOccurrences(base, 'UTC');
    expect(first?.startsAt.toISOString()).toBe('2026-09-02T09:30:00.000Z');
  });

  it('leaves out the dates the timetable marks as holidays', () => {
    const occurrences = generateOccurrences(
      { ...base, skipDates: ['2026-09-02', '2026-09-07'] },
      IST,
    );
    expect(occurrences.map((o) => o.dateKey)).not.toContain('2026-09-02');
    expect(occurrences.map((o) => o.dateKey)).not.toContain('2026-09-07');
    expect(occurrences).toHaveLength(7);
  });

  it('produces nothing when the chosen days never fall inside the range', () => {
    const occurrences = generateOccurrences(
      { ...base, weekdays: ['sun'], fromDate: '2026-09-01', untilDate: '2026-09-05' },
      IST,
    );
    expect(occurrences).toHaveLength(0);
  });
});

describe('findConflicts', () => {
  const occurrences = generateOccurrences(base, IST);

  it('reports an overlap with something already scheduled', () => {
    const clash = {
      id: 'existing-1',
      startsAt: new Date('2026-09-02T04:30:00.000Z'),
      endsAt: new Date('2026-09-02T05:00:00.000Z'),
      label: 'The batch already has SQL at that time',
    };
    const conflicts = findConflicts(occurrences, [clash]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.withSessionId).toBe('existing-1');
    expect(conflicts[0]?.reason).toContain('SQL');
  });

  it('does not treat a class that ends as another begins as a clash', () => {
    const touching = {
      id: 'existing-2',
      startsAt: new Date('2026-09-02T05:30:00.000Z'),
      endsAt: new Date('2026-09-02T06:30:00.000Z'),
      label: 'Back-to-back',
    };
    expect(findConflicts(occurrences, [touching])).toHaveLength(0);
  });

  it('finds two classes of one series landing on the same slot', () => {
    const duplicated = [...occurrences.slice(0, 1), ...occurrences.slice(0, 1)];
    expect(findInternalConflicts(duplicated)).toHaveLength(1);
    expect(findInternalConflicts(occurrences)).toHaveLength(0);
  });
});
