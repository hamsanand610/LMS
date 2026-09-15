import { describe, expect, it } from 'vitest';
import { attendancePercentage, countByStatus, summarise } from './attendance-math.js';

describe('attendance percentage (plan FR-05.3, AC-05.3)', () => {
  it('counts present, late and excused against every marked class by default', () => {
    // A known dataset: 20 classes marked — 14 present, 2 late, 1 excused, 3 absent.
    const summary = summarise({
      counts: { present: 14, late: 2, excused: 1, absent: 3 },
      countedStatuses: ['present', 'late', 'excused'],
      thresholdPct: 75,
    });
    expect(summary.conducted).toBe(20);
    expect(summary.attended).toBe(17);
    expect(summary.percentage).toBe(85);
    expect(summary.belowThreshold).toBe(false);
  });

  it('follows the institute when it refuses to count lateness', () => {
    const summary = summarise({
      counts: { present: 14, late: 2, excused: 1, absent: 3 },
      countedStatuses: ['present'],
      thresholdPct: 75,
    });
    expect(summary.attended).toBe(14);
    expect(summary.percentage).toBe(70);
    expect(summary.belowThreshold).toBe(true);
  });

  it('has no percentage before a class has been conducted, and flags nobody', () => {
    const summary = summarise({
      counts: {},
      countedStatuses: ['present', 'late', 'excused'],
      thresholdPct: 75,
    });
    expect(summary.conducted).toBe(0);
    expect(summary.percentage).toBeNull();
    expect(summary.belowThreshold).toBe(false);
  });

  it('is exactly at the threshold rather than below it', () => {
    const summary = summarise({
      counts: { present: 3, absent: 1 },
      countedStatuses: ['present', 'late', 'excused'],
      thresholdPct: 75,
    });
    expect(summary.percentage).toBe(75);
    expect(summary.belowThreshold).toBe(false);
  });

  it('rounds to whole numbers', () => {
    expect(attendancePercentage(2, 3)).toBe(67);
    expect(attendancePercentage(1, 3)).toBe(33);
    expect(attendancePercentage(0, 0)).toBeNull();
  });

  it('counts a list of marks without losing a status', () => {
    const counts = countByStatus(['present', 'absent', 'present', 'late']);
    expect(counts).toEqual({ present: 2, absent: 1, late: 1, excused: 0 });
  });
});
