import { describe, expect, it } from 'vitest';
import { labDraftSchema, playgroundRunSchema, PLAYGROUND_LIMITS } from './labs.js';
import { questionCreateSchema } from './questions.js';
import {
  WEB_LAB_LIMITS,
  decodeWebCheck,
  decodeWebFiles,
  describeWebCheck,
  encodeWebCheck,
  encodeWebFiles,
  webCheckSchema,
  type WebCheck,
  type WebFiles,
} from './web-lab.js';

/** A small seeded generator, so a failing case can be replayed from its seed. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const ALPHABET = [
  'a',
  'Z',
  '0',
  ' ',
  '\n',
  '"',
  '\\',
  '<',
  '>',
  '{',
  '}',
  'é',
  '😀',
  '\u0000',
  '`',
];

function text(next: () => number, max: number): string {
  const length = Math.floor(next() * max);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[Math.floor(next() * ALPHABET.length)];
  return out;
}

describe('a web lab’s files', () => {
  it('come back unchanged from their bundle, whatever they hold', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const next = random(seed);
      const files: WebFiles = { html: text(next, 300), css: text(next, 100), js: text(next, 200) };
      expect(decodeWebFiles(encodeWebFiles(files)), `seed ${seed}`).toEqual(files);
    }
  });

  it('are refused when a file is too long or the bundle is not one', () => {
    const long = 'x'.repeat(WEB_LAB_LIMITS.fileChars + 1);
    expect(decodeWebFiles(encodeWebFiles({ html: long, css: '', js: '' }))).toBeNull();
    expect(
      decodeWebFiles(JSON.stringify({ format: 'web/2', html: '', css: '', js: '' })),
    ).toBeNull();
    expect(decodeWebFiles(JSON.stringify({ html: '', css: '', js: '' }))).toBeNull();
    expect(decodeWebFiles('<h1>not a bundle</h1>')).toBeNull();
    expect(decodeWebFiles('')).toBeNull();
    expect(
      decodeWebFiles(JSON.stringify({ format: 'web/1', html: 1, css: '', js: '' })),
    ).toBeNull();
  });
});

const VALID: WebCheck[] = [
  { kind: 'exists', selector: 'li', min: 2, max: null },
  { kind: 'text', selector: '#total', match: 'matches', value: '^Total: \\d+$' },
  { kind: 'attribute', selector: 'img', name: 'alt', match: 'present', value: '' },
  { kind: 'style', selector: 'h1', property: 'font-size', value: '24px' },
  { kind: 'console', match: 'contains', value: 'ready' },
  {
    kind: 'interaction',
    steps: [
      { action: 'input', selector: '#item', value: 'Milk', key: '' },
      { action: 'keydown', selector: '#item', value: '', key: 'Enter' },
    ],
    then: { kind: 'exists', selector: '#list li', min: 1, max: 1 },
  },
];

describe('a web lab’s checks', () => {
  it('accept every kind of check and survive being stored as a case input', () => {
    for (const check of VALID) {
      expect(webCheckSchema.safeParse(check).success, check.kind).toBe(true);
      expect(decodeWebCheck(encodeWebCheck(check)), check.kind).toEqual(check);
    }
  });

  it('refuse checks that could never be decided', () => {
    const refused = [
      { kind: 'text', selector: 'h1', match: 'matches', value: '([' },
      { kind: 'exists', selector: 'li', min: 3, max: 1 },
      { kind: 'attribute', selector: 'img', name: 'alt', match: 'equals', value: '' },
      { kind: 'attribute', selector: 'img', name: 'on click', match: 'present' },
      { kind: 'style', selector: 'h1', property: 'fontSize', value: '24px' },
      { kind: 'exists', selector: '   ', min: 1 },
      { kind: 'exists', selector: 'x'.repeat(WEB_LAB_LIMITS.selectorChars + 1), min: 1 },
      {
        kind: 'interaction',
        steps: [{ action: 'keydown', selector: 'input', value: '', key: '' }],
        then: { kind: 'exists', selector: 'li' },
      },
      {
        kind: 'interaction',
        steps: Array.from({ length: WEB_LAB_LIMITS.steps + 1 }, () => ({
          action: 'click',
          selector: 'button',
        })),
        then: { kind: 'exists', selector: 'li' },
      },
      { kind: 'interaction', steps: [], then: { kind: 'exists', selector: 'li' } },
      { kind: 'script', code: 'return true' },
    ];
    for (const check of refused) {
      expect(webCheckSchema.safeParse(check).success, JSON.stringify(check).slice(0, 80)).toBe(
        false,
      );
      expect(decodeWebCheck(JSON.stringify(check))).toBeNull();
    }
    expect(decodeWebCheck('not json')).toBeNull();
  });

  it('read to a learner in plain words', () => {
    expect(VALID.map(describeWebCheck)).toEqual([
      'At least 2 elements match `li`',
      'The text of `#total` matches the pattern "^Total: \\d+$"',
      '`img` has the attribute `alt`',
      '`h1` has `font-size: 24px`',
      'The console output contains "ready"',
      'After you type into `#item` "Milk", then press a key in `#item` (Enter): exactly 1 element matches `#list li`',
    ]);
  });
});

const webQuestion = (coding: Record<string, unknown>) => ({
  title: 'A web lab',
  body: 'Make a page.',
  type: 'web',
  coding: {
    languages: ['web'],
    referenceSolution: { web: encodeWebFiles({ html: '<h1>Hi</h1>', css: '', js: '' }) },
    testCases: [{ input: encodeWebCheck(VALID[0]!), expectedOutput: 'pass', isSample: true }],
    ...coding,
  },
});

describe('the question schema for labs', () => {
  it('accepts a web lab whose files and checks are well formed', () => {
    expect(questionCreateSchema.safeParse(webQuestion({})).success).toBe(true);
  });

  it('refuses a web lab with another language, a broken bundle, a check that is not one, or another expectation', () => {
    for (const coding of [
      { languages: ['web', 'javascript'] },
      { referenceSolution: { web: '<h1>not a bundle</h1>' } },
      { testCases: [{ input: 'h1 exists', expectedOutput: 'pass', isSample: true }] },
      {
        testCases: [{ input: encodeWebCheck(VALID[0]!), expectedOutput: 'fail', isSample: true }],
      },
      { compareMode: 'exact' },
    ]) {
      expect(
        questionCreateSchema.safeParse(webQuestion(coding)).success,
        JSON.stringify(coding),
      ).toBe(false);
    }
  });

  it('asks a debugging lab for the code with the bug and for what the fixed program does', () => {
    const debugging = (coding: Record<string, unknown>) => ({
      title: 'Fix it',
      body: 'It is broken.',
      type: 'debugging',
      coding: {
        languages: ['python'],
        starterCode: { python: 'print(1)' },
        referenceSolution: { python: 'print(2)' },
        expectedBehaviour: 'Prints 2.',
        testCases: [{ input: '', expectedOutput: '2', isSample: true }],
        ...coding,
      },
    });
    expect(questionCreateSchema.safeParse(debugging({})).success).toBe(true);
    expect(questionCreateSchema.safeParse(debugging({ starterCode: {} })).success).toBe(false);
    expect(questionCreateSchema.safeParse(debugging({ expectedBehaviour: '' })).success).toBe(
      false,
    );
    expect(questionCreateSchema.safeParse(debugging({ languages: ['web'] })).success).toBe(false);
  });

  it('keeps web out of a coding question', () => {
    expect(
      questionCreateSchema.safeParse({
        title: 'Code',
        body: 'Write code.',
        type: 'coding',
        coding: {
          languages: ['web'],
          referenceSolution: { web: encodeWebFiles({ html: '', css: '', js: '' }) },
          testCases: [{ input: '', expectedOutput: '', isSample: true }],
        },
      }).success,
    ).toBe(false);
  });
});

describe('the playground and drafts', () => {
  it('runs code languages and SQL, never a web page, within its input limit', () => {
    expect(playgroundRunSchema.safeParse({ language: 'python', code: 'print(1)' }).success).toBe(
      true,
    );
    expect(playgroundRunSchema.safeParse({ language: 'sql', code: 'SELECT 1;' }).success).toBe(
      true,
    );
    expect(playgroundRunSchema.safeParse({ language: 'web', code: 'x' }).success).toBe(false);
    expect(playgroundRunSchema.safeParse({ language: 'python', code: '' }).success).toBe(false);
    expect(
      playgroundRunSchema.safeParse({
        language: 'python',
        code: 'x',
        stdin: 'x'.repeat(PLAYGROUND_LIMITS.stdinChars + 1),
      }).success,
    ).toBe(false);
  });

  it('keeps a draft for the playground or for one lab, named by its id', () => {
    const draft = { language: 'python', code: 'print(1)' };
    expect(labDraftSchema.safeParse({ ...draft, scope: 'playground' }).success).toBe(true);
    expect(
      labDraftSchema.safeParse({ ...draft, scope: '0190c7a2-3f4e-7a1b-8c2d-123456789abc' }).success,
    ).toBe(true);
    expect(labDraftSchema.safeParse({ ...draft, scope: 'somebody-else' }).success).toBe(false);
    expect(labDraftSchema.safeParse({ ...draft, scope: '../etc' }).success).toBe(false);
  });
});
