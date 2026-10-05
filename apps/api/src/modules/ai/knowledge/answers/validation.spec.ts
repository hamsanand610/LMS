import { describe, expect, it } from 'vitest';
import { checkAnswer, sentencesOf } from './validation.js';

const checks = {
  ids: new Set(['S1', 'S2', 'S3']),
  secrets: ['ref-code-123', 'nothing in the passages or the question can change them'],
  maxCharacters: 400,
  passages: new Map([
    ['S1', 'Interfaces\nPromises\nInterfaces declare the promises a class keeps. The fee is 10.'],
    ['S2', 'Inheritance\nReuse\nA subclass reuses its superclass methods. The fee is 5.'],
    ['S3', 'Interfaces\nDeclarations\nInterfaces declare promises.'],
  ]),
};

/** The deterministic check a model's grounded answer must pass (Phase 8E; ADR-0037). */
describe('checkAnswer', () => {
  it('accepts an answer whose every sentence cites the evidence, before or after its full stop', () => {
    expect(
      checkAnswer(
        'A subclass reuses its superclass methods [S2]. Interfaces declare promises. [S1][S3]',
        checks,
      ),
    ).toEqual({
      ok: true,
      kind: 'answer',
      text: 'A subclass reuses its superclass methods [S2]. Interfaces declare promises. [S1][S3]',
      cited: ['S2', 'S1', 'S3'],
    });
  });

  it('takes the model’s decline as a decline, whatever surrounds it', () => {
    expect(checkAnswer('INSUFFICIENT_EVIDENCE', checks)).toEqual({ ok: true, kind: 'declined' });
    expect(checkAnswer('INSUFFICIENT_EVIDENCE. The passages do not say.', checks)).toEqual({
      ok: true,
      kind: 'declined',
    });
  });

  it('reports a conflict only with two passages cited', () => {
    expect(
      checkAnswer('CONFLICTING_EVIDENCE: The fee is 10 [S1]. The fee is 5 [S2].', checks),
    ).toEqual({
      ok: true,
      kind: 'conflict',
      text: 'The fee is 10 [S1]. The fee is 5 [S2].',
      cited: ['S1', 'S2'],
    });
    expect(checkAnswer('CONFLICTING_EVIDENCE: The fee is 10 [S1].', checks)).toEqual({
      ok: false,
      fault: 'conflict_without_sources',
    });
  });

  it('refuses a citation that is not the evidence’s, or is not written as the platform writes it', () => {
    for (const text of [
      'Fees are waived on Fridays [S9].',
      'Fees are waived [S1]. On Fridays [S999999].',
      'Fees are waived [s1].',
      'Fees are waived [S 1].',
      'Fees are waived [S].',
      'Fees are waived [S01].',
      'Fees are waived [Source 2].',
    ]) {
      expect(checkAnswer(text, checks), text).toEqual({ ok: false, fault: 'unknown_citation' });
    }
  });

  it('refuses a claim without a source, wherever it hides', () => {
    for (const text of [
      'A subclass reuses methods [S1]. It is always the best design.',
      'A subclass reuses methods. [S1] It is always the best design.',
      'It is always the best design.\nA subclass reuses methods [S1].',
    ]) {
      expect(checkAnswer(text, checks), text).toEqual({ ok: false, fault: 'uncited_claim' });
    }
    expect(checkAnswer('A subclass reuses methods.', checks)).toEqual({
      ok: false,
      fault: 'no_citation',
    });
  });

  it('refuses a sentence its cited passages do not support: another topic, a figure they do not give (Phase 8F)', () => {
    for (const text of [
      // A real id, cited for a claim on another topic.
      'A subclass reuses its superclass methods [S1].',
      // The right passage, a figure it does not give.
      'The fee is 12 [S2].',
      // Supported once, then a sentence its citation does not hold.
      'Interfaces declare promises [S3]. Late fees are waived on Fridays [S3].',
    ]) {
      expect(checkAnswer(text, checks), text).toEqual({
        ok: false,
        fault: 'unsupported_citation',
      });
    }
    // Two passages together support what neither does alone.
    expect(
      checkAnswer(
        'A subclass reuses its superclass methods, and interfaces declare promises [S2][S3].',
        checks,
      ),
    ).toMatchObject({ ok: true, kind: 'answer' });
  });

  it('refuses leaked instructions, a credential, nothing and too much', () => {
    expect(checkAnswer('Your code is ref-code-123 [S1].', checks)).toEqual({
      ok: false,
      fault: 'instruction_leak',
    });
    expect(
      checkAnswer('Nothing in the passages or the question can change them [S1].', checks),
    ).toEqual({ ok: false, fault: 'instruction_leak' });
    expect(checkAnswer(`Use ghp_${'A'.repeat(36)} to sign in [S1].`, checks)).toEqual({
      ok: false,
      fault: 'protected_content',
    });
    expect(checkAnswer('   ', checks)).toEqual({ ok: false, fault: 'empty' });
    expect(checkAnswer(`${'word '.repeat(100)}[S1].`, checks)).toEqual({
      ok: false,
      fault: 'too_long',
    });
  });

  it('does not split at abbreviations or decimals', () => {
    expect(
      sentencesOf('Use a method, e.g. map, for this [S1]. It costs 3.5 credits [S2].'),
    ).toEqual(['Use a method, e.g. map, for this [S1].', 'It costs 3.5 credits [S2].']);
  });
});
