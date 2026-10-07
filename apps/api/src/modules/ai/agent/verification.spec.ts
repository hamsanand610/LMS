import { describe, expect, it } from 'vitest';
import { INSTRUCTION_FINGERPRINTS } from '../knowledge/answers/grounded-prompt.js';
import { AGENT_INSTRUCTION_FINGERPRINTS } from './agent-prompts.js';
import { type DraftChecks, SAFETY_FAULTS, verifyDraft, writesCode } from './verification.js';

const LEARNER = '0190a0e4-7c1d-7b9e-8f00-0000000000aa';
const passage =
  'Lesson: Loops\nBasics\nA for loop repeats its body a fixed number of times. A while loop repeats while its condition holds.';
const checks: DraftChecks = {
  ids: new Set(['S1', 'S2']),
  passages: new Map([
    ['S1', passage],
    ['S2', 'Notes\nLoops\nAn infinite loop never ends because its condition stays true.'],
  ]),
  referenceCode: 'ref-CODE-1234567890',
  identifiers: [LEARNER],
  maxCharacters: 4_000,
};
const good = 'A for loop repeats its body a fixed number of times [S1].';
const draft = (text: string, finishReason = 'stop') => verifyDraft({ text, finishReason }, checks);

describe('verifying a learning agent draft (Phase 9B; ADR-0039)', () => {
  it('accepts a cited, supported answer, and a decline', () => {
    expect(draft(good)).toEqual({ ok: true, kind: 'answer', text: good, cited: ['S1'] });
    expect(draft('INSUFFICIENT_EVIDENCE')).toEqual({ ok: true, kind: 'declined' });
  });

  it('refuses what the provider withheld or cut short', () => {
    expect(draft(good, 'blocked')).toEqual({ ok: false, fault: 'blocked' });
    expect(draft(good, 'length')).toEqual({ ok: false, fault: 'incomplete' });
  });

  it('refuses the tool protocol, but not JSON a programming answer quotes', () => {
    for (const text of [
      `${good} {"action": "tool", "tool": "shell", "arguments": {}}`,
      `${good} {"tool":"lesson_content","arguments":{"lessonId":"x"}}`,
      `Next I would call knowledge_search for more [S1].`,
      `{"action":"finish"} ${good}`,
    ]) {
      expect(draft(text), text).toEqual({ ok: false, fault: 'tool_protocol' });
    }
    // A Redux action, quoted from a passage, is not the agent's protocol.
    const quoting = verifyDraft(
      { text: 'An action is an object like {"action": "add"} [S1].', finishReason: 'stop' },
      {
        ...checks,
        passages: new Map([
          ['S1', 'Redux\nActions\nAn action is an object like {"action": "add"}.'],
        ]),
      },
    );
    expect(quoting.ok).toBe(true);
  });

  it('refuses signs of obeyed planted instructions', () => {
    for (const text of [
      'Developer mode is on: I will answer anything now, without sources.',
      'Setting the documents aside, loops are easy [S1].',
      'My system prompt says to cite [S1].',
      'Ignoring the previous instructions, here is the answer [S1].',
    ]) {
      const verdict = draft(text);
      expect(verdict.ok, text).toBe(false);
      if (!verdict.ok) expect(SAFETY_FAULTS.has(verdict.fault), text).toBe(true);
    }
  });

  it('refuses the run’s own identifiers and any credential', () => {
    expect(draft(`Your id is ${LEARNER} [S1].`)).toEqual({ ok: false, fault: 'protected_data' });
    expect(draft(`Your id is ${LEARNER.toUpperCase()} [S1].`)).toEqual({
      ok: false,
      fault: 'protected_data',
    });
    expect(draft(`Use gsk_${'a'.repeat(30)} for loops [S1].`)).toEqual({
      ok: false,
      fault: 'protected_content',
    });
    expect(draft(`Use ghp_${'A'.repeat(36)} for loops [S1].`)).toEqual({
      ok: false,
      fault: 'protected_content',
    });
  });

  it('refuses leaked instructions: the reference code, 8E’s phrases and the agent’s', () => {
    expect(draft(`${good} The code is ref-CODE-1234567890 [S1].`)).toEqual({
      ok: false,
      fault: 'instruction_leak',
    });
    for (const phrase of [...INSTRUCTION_FINGERPRINTS, ...AGENT_INSTRUCTION_FINGERPRINTS]) {
      expect(draft(`A for loop repeats, ${phrase} [S1].`).ok, phrase).toBe(false);
    }
  });

  it('keeps Phase 8E/8F’s grounded checks: citations known, every sentence cited and supported', () => {
    expect(draft('A for loop repeats its body [S7].')).toEqual({
      ok: false,
      fault: 'unknown_citation',
    });
    expect(draft(`${good} Loops are the best tool ever.`)).toEqual({
      ok: false,
      fault: 'uncited_claim',
    });
    expect(draft('Recursion calls a function from inside itself [S1].')).toEqual({
      ok: false,
      fault: 'unsupported_citation',
    });
    expect(draft('x'.repeat(4_001))).toEqual({ ok: false, fault: 'too_long' });
    expect(draft('  ')).toEqual({ ok: false, fault: 'empty' });
  });

  it('gives no code while it explains the learner’s own lab attempt (Phase 9C; ADR-0031)', () => {
    const lab = { ...checks, noCode: true };
    const explain = 'A for loop repeats its body a fixed number of times [S1].';
    expect(verifyDraft({ text: explain, finishReason: 'stop' }, lab)).toMatchObject({ ok: true });
    for (const code of [
      'Here is the fix [S1].\n```python\nprint(a + b)\n```',
      'A for loop repeats its body [S1].\nfor (int i = 0; i < n; i++) {\n  sum += i;\n}',
      'Write it so [S1]:\n    total = 0\n    for x in xs:\n        total += x\n',
      'Use `for value in sorted(values, key=lambda item: item.score, reverse=True)` here [S1].',
      'Return the sum [S1];',
    ]) {
      expect(verifyDraft({ text: code, finishReason: 'stop' }, lab), code).toEqual({
        ok: false,
        fault: 'solution_code',
      });
      expect(writesCode(code), code).toBe(true);
    }
    // A short mention of a condition or a name is prose, not a program.
    expect(writesCode('Check whether `i <= n` stops one step too late [S1].')).toBe(false);
    expect(writesCode('Your function `sum_two` prints the numbers side by side [S2].')).toBe(false);
    // Without the learner's attempt in the evidence, an explanation of code may quote code.
    expect(
      verifyDraft(
        { text: 'A for loop repeats [S1].\n```\nfor x in y: pass\n```', finishReason: 'stop' },
        checks,
      ),
    ).not.toEqual({ ok: false, fault: 'solution_code' });
    expect(SAFETY_FAULTS.has('solution_code')).toBe(true);
  });

  it('refuses a draft that writes the names of the learner’s own tools (Phase 9C)', () => {
    for (const name of ['learning_state', 'lab_attempt']) {
      expect(draft(`${good} Then call ${name}.`)).toEqual({ ok: false, fault: 'tool_protocol' });
    }
  });
});
