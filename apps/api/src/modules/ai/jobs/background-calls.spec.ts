import { describe, expect, it } from 'vitest';
import { mostSensitive } from './background-calls.js';

describe('the data class of a background call (Phase 7D)', () => {
  it('is that of the most sensitive message it carries', () => {
    expect(mostSensitive([])).toBe('public');
    expect(mostSensitive(['public', null, 'public'])).toBe('public');
    expect(mostSensitive(['public', 'course'])).toBe('course');
    expect(mostSensitive(['personal', 'public', 'course'])).toBe('personal');
    expect(mostSensitive(['public', 'restricted'])).toBe('restricted');
  });

  it('treats a class it does not know as the most sensitive', () => {
    expect(mostSensitive(['public', 'something-new'])).toBe('restricted');
  });
});
