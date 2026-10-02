import { describe, expect, it } from 'vitest';
import { feedbackFormCreateSchema, weeklyFeedbackRound } from './feedback.js';

const ZONE = 'Asia/Kolkata';

describe('the weekly feedback round (AC-13.1)', () => {
  it('opens on Friday and is named by it', () => {
    // Friday 2 October 2026, 10:00 in Kolkata.
    expect(weeklyFeedbackRound(new Date('2026-10-02T04:30:00Z'), ZONE)).toEqual({
      period: '2026-10-02',
      opensAt: new Date('2026-10-01T18:30:00Z'),
      closesAt: new Date('2026-10-04T18:30:00Z'),
    });
  });

  it('stays open until Sunday ends, in the institute’s time', () => {
    expect(weeklyFeedbackRound(new Date('2026-10-04T18:29:00Z'), ZONE)?.period).toBe('2026-10-02');
    expect(weeklyFeedbackRound(new Date('2026-10-04T18:30:00Z'), ZONE)).toBeNull();
  });

  it('is closed from Monday to Thursday', () => {
    expect(weeklyFeedbackRound(new Date('2026-10-01T18:29:00Z'), ZONE)).toBeNull();
  });
});

describe('a feedback form', () => {
  const base = {
    title: 'Week one',
    batchId: '00000000-0000-4000-8000-000000000001',
    opensAt: '2026-10-02T00:00:00.000Z',
    questions: [{ id: 'pace', kind: 'rating', prompt: 'How was the pace?' }],
  };

  it('closes when it is given once, and after it opens', () => {
    expect(feedbackFormCreateSchema.safeParse(base).success).toBe(false);
    expect(
      feedbackFormCreateSchema.safeParse({ ...base, closesAt: '2026-10-01T00:00:00.000Z' }).success,
    ).toBe(false);
    expect(
      feedbackFormCreateSchema.safeParse({ ...base, closesAt: '2026-10-05T00:00:00.000Z' }).success,
    ).toBe(true);
    expect(feedbackFormCreateSchema.safeParse({ ...base, cadence: 'weekly' }).success).toBe(true);
  });

  it('is anonymous unless it says otherwise', () => {
    const parsed = feedbackFormCreateSchema.parse({ ...base, cadence: 'weekly' });
    expect(parsed.anonymous).toBe(true);
  });

  it('gives a choice at least two options and nothing else any', () => {
    const choice = { id: 'best', kind: 'choice', prompt: 'Best part?', options: ['Labs'] };
    expect(
      feedbackFormCreateSchema.safeParse({ ...base, cadence: 'weekly', questions: [choice] })
        .success,
    ).toBe(false);
  });
});
