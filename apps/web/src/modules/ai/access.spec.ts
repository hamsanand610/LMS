import { describe, expect, it } from 'vitest';
import { canUseAi } from './access';

const chat = { key: 'ai:chat', scope: 'own' as const };
const hints = { key: 'ai:hints', scope: 'own' as const };

describe('showing SI Academy AI in the web app (Phase 7A)', () => {
  it('needs module.ai, the surface flag and the permission, all three', () => {
    const allOn = { 'module.ai': true, 'ai.workspace': true, 'ai.lab_hints': true };
    expect(canUseAi({ flags: allOn, permissions: [chat] }, 'workspace')).toBe(true);
    expect(canUseAi({ flags: allOn, permissions: [] }, 'workspace')).toBe(false);
    expect(
      canUseAi({ flags: { ...allOn, 'module.ai': false }, permissions: [chat] }, 'workspace'),
    ).toBe(false);
    expect(canUseAi({ flags: { 'ai.workspace': true }, permissions: [chat] }, 'workspace')).toBe(
      false,
    );
    expect(canUseAi({ flags: { 'module.ai': true }, permissions: [chat] }, 'workspace')).toBe(
      false,
    );
  });

  it('keeps lab hints to those who hold ai:hints', () => {
    const flags = { 'module.ai': true, 'ai.lab_hints': true };
    expect(canUseAi({ flags, permissions: [chat] }, 'lab_hints')).toBe(false);
    expect(canUseAi({ flags, permissions: [chat, hints] }, 'lab_hints')).toBe(true);
  });

  it('shows nothing when no flag is known at all', () => {
    expect(canUseAi({ flags: {}, permissions: [chat, hints] }, 'assistant')).toBe(false);
  });
});
