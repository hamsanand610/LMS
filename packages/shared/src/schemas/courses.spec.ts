import { describe, expect, it } from 'vitest';
import {
  ALLOWED_COMPLETION_RULES,
  COMPLETION_RULES,
  DEFAULT_COMPLETION_RULE,
  LESSON_TYPES,
  lessonInputSchema,
} from './courses.js';

const lesson = (type: (typeof LESSON_TYPES)[number], completionRule?: string) => ({
  title: 'Arrays in practice',
  type,
  completionRule,
  ...(type === 'lab' ? { content: { questionId: '00000000-0000-4000-8000-000000000001' } } : {}),
});

describe('completion rules per lesson type (Phase 2, D3)', () => {
  it('gives every type a default it can actually meet', () => {
    for (const type of LESSON_TYPES) {
      expect(ALLOWED_COMPLETION_RULES[type]).toContain(DEFAULT_COMPLETION_RULE[type]);
    }
  });

  it('accepts exactly the rules a type can meet, and names the problem otherwise', () => {
    for (const type of LESSON_TYPES) {
      for (const rule of COMPLETION_RULES) {
        const result = lessonInputSchema.safeParse(lesson(type, rule));
        const allowed = ALLOWED_COMPLETION_RULES[type].includes(rule);
        expect(result.success, `${type} with ${rule}`).toBe(allowed);
        if (!allowed && !result.success) {
          expect(result.error.issues[0]?.path).toEqual(['completionRule']);
        }
      }
    }
  });

  it('lets practice and lab lessons complete only by being passed', () => {
    expect(ALLOWED_COMPLETION_RULES.practice).toEqual(['pass']);
    expect(ALLOWED_COMPLETION_RULES.lab).toEqual(['pass']);
    expect(lessonInputSchema.safeParse(lesson('practice', 'manual')).success).toBe(false);
  });

  it('never lets a reading lesson wait for a video to be watched', () => {
    expect(lessonInputSchema.safeParse(lesson('article', 'watch')).success).toBe(false);
    expect(lessonInputSchema.safeParse(lesson('resources', 'pass')).success).toBe(false);
  });

  it('leaves the rule to the default when the author does not choose one', () => {
    expect(lessonInputSchema.safeParse(lesson('video')).success).toBe(true);
  });
});
