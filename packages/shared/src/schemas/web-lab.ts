import { z } from 'zod';

/**
 * The Web Lab's contract (ADR-0019): the files a learner edits, and the structured checks an author
 * writes. A web exercise is a question whose starting and reference files travel as one encoded
 * bundle where the platform carries "code", and whose checks are ordinary test cases: the input is
 * one encoded check and the expected output is `WEB_CHECK_PASS`. The sandbox evaluates a check and
 * prints `pass` or a one-line reason; nothing in a browser decides whether a check passed.
 */

/** Size limits of a Web Lab's files (ADR-0021). The bundle must fit the sandbox's code cap. */
export const WEB_LAB_LIMITS = {
  fileChars: 20_000,
  bundleChars: 64_000,
  steps: 10,
  selectorChars: 200,
  valueChars: 500,
} as const;

/** What a check prints when it holds; anything else is the reason it does not. */
export const WEB_CHECK_PASS = 'pass';

/** The three files a Web Lab learner edits. */
export const WEB_FILES = ['html', 'css', 'js'] as const;
export type WebFileName = (typeof WEB_FILES)[number];

export const WEB_FILE_LABELS: Record<WebFileName, string> = {
  html: 'index.html',
  css: 'styles.css',
  js: 'script.js',
};

export const webFilesSchema = z.object({
  html: z.string().max(WEB_LAB_LIMITS.fileChars, 'The HTML file is too long'),
  css: z.string().max(WEB_LAB_LIMITS.fileChars, 'The CSS file is too long'),
  js: z.string().max(WEB_LAB_LIMITS.fileChars, 'The JavaScript file is too long'),
});
export type WebFiles = z.infer<typeof webFilesSchema>;

export const EMPTY_WEB_FILES: WebFiles = { html: '', css: '', js: '' };

const BUNDLE_FORMAT = 'web/1';

/** The files as one string, which is what a run, a submission and the history carry. */
export function encodeWebFiles(files: WebFiles): string {
  return JSON.stringify({ format: BUNDLE_FORMAT, html: files.html, css: files.css, js: files.js });
}

/** The files back out of a bundle; null when the string is not a valid bundle. */
export function decodeWebFiles(source: string): WebFiles | null {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return null;
  }
  if (
    !value ||
    typeof value !== 'object' ||
    (value as { format?: unknown }).format !== BUNDLE_FORMAT
  ) {
    return null;
  }
  const parsed = webFilesSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// ───────────────────────── checks ─────────────────────────

const selector = z.string().trim().min(1, 'Give a CSS selector').max(WEB_LAB_LIMITS.selectorChars);
const value = z.string().max(WEB_LAB_LIMITS.valueChars);

export const WEB_TEXT_MATCHES = ['equals', 'contains', 'matches'] as const;
export type WebTextMatch = (typeof WEB_TEXT_MATCHES)[number];

export const WEB_ATTRIBUTE_MATCHES = ['present', 'equals', 'contains'] as const;

export const WEB_STEP_ACTIONS = [
  'click',
  'input',
  'change',
  'submit',
  'focus',
  'blur',
  'keydown',
] as const;
export type WebStepAction = (typeof WEB_STEP_ACTIONS)[number];

const existsCheck = z.object({
  kind: z.literal('exists'),
  selector,
  /** How many elements must match; at least one by default. */
  min: z.number().int().min(0).max(1000).default(1),
  max: z.number().int().min(0).max(1000).nullable().default(null),
});

const textCheck = z.object({
  kind: z.literal('text'),
  selector,
  match: z.enum(WEB_TEXT_MATCHES),
  value,
});

const attributeCheck = z.object({
  kind: z.literal('attribute'),
  selector,
  name: z
    .string()
    .trim()
    .min(1, 'Name the attribute')
    .max(100)
    .regex(/^[A-Za-z_:][-A-Za-z0-9_:.]*$/, 'Not an attribute name'),
  match: z.enum(WEB_ATTRIBUTE_MATCHES),
  value: value.default(''),
});

const styleCheck = z.object({
  kind: z.literal('style'),
  selector,
  property: z
    .string()
    .trim()
    .min(1, 'Name the CSS property')
    .max(60)
    .regex(/^-?[a-z][a-z-]*$/, 'Write the property in lowercase, as in CSS (font-size)'),
  value: z.string().trim().min(1, 'Give the value the property must have').max(200),
});

const consoleCheck = z.object({
  kind: z.literal('console'),
  match: z.enum(WEB_TEXT_MATCHES),
  value,
});

/** The assertions a check can make, alone or after an interaction. */
export const webAssertionSchema = z.discriminatedUnion('kind', [
  existsCheck,
  textCheck,
  attributeCheck,
  styleCheck,
  consoleCheck,
]);
export type WebAssertion = z.infer<typeof webAssertionSchema>;

export const webStepSchema = z.object({
  action: z.enum(WEB_STEP_ACTIONS),
  selector,
  /** input and change: the value typed into the field. */
  value: value.default(''),
  /** keydown: the key, as KeyboardEvent.key names it (Enter, a, ArrowDown). */
  key: z.string().max(40).default(''),
});
export type WebStep = z.infer<typeof webStepSchema>;

const interactionCheck = z.object({
  kind: z.literal('interaction'),
  steps: z.array(webStepSchema).min(1).max(WEB_LAB_LIMITS.steps),
  then: webAssertionSchema,
});

export const webCheckSchema = z
  .discriminatedUnion('kind', [
    existsCheck,
    textCheck,
    attributeCheck,
    styleCheck,
    consoleCheck,
    interactionCheck,
  ])
  .superRefine((check, ctx) => {
    const assertion = check.kind === 'interaction' ? check.then : check;
    if (
      (assertion.kind === 'text' || assertion.kind === 'console') &&
      assertion.match === 'matches'
    ) {
      try {
        new RegExp(assertion.value);
      } catch {
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'Not a valid pattern' });
      }
    }
    if (assertion.kind === 'exists' && assertion.max !== null && assertion.max < assertion.min) {
      ctx.addIssue({
        code: 'custom',
        path: ['max'],
        message: 'The most cannot be fewer than the least',
      });
    }
    if (
      assertion.kind === 'attribute' &&
      assertion.match !== 'present' &&
      assertion.value.length === 0
    ) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Give the value to compare with' });
    }
    if (check.kind === 'interaction') {
      for (const [index, step] of check.steps.entries()) {
        if (step.action === 'keydown' && !step.key) {
          ctx.addIssue({ code: 'custom', path: ['steps', index, 'key'], message: 'Name the key' });
        }
      }
    }
  });
export type WebCheck = z.infer<typeof webCheckSchema>;

/** A check as stored in a test case's input. */
export function encodeWebCheck(check: WebCheck): string {
  return JSON.stringify(check);
}

/** A test case's input back as a check; null when it is not a valid one. */
export function decodeWebCheck(input: string): WebCheck | null {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    return null;
  }
  const parsed = webCheckSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const MATCH_WORDS: Record<WebTextMatch, string> = {
  equals: 'is exactly',
  contains: 'contains',
  matches: 'matches the pattern',
};

const ACTION_WORDS: Record<WebStepAction, string> = {
  click: 'click',
  input: 'type into',
  change: 'change',
  submit: 'submit',
  focus: 'focus',
  blur: 'leave',
  keydown: 'press a key in',
};

/** One assertion in words, as the learner reads it for a visible check. */
export function describeWebAssertion(assertion: WebAssertion): string {
  switch (assertion.kind) {
    case 'exists': {
      if (assertion.max === 0) return `Nothing matches \`${assertion.selector}\``;
      if (assertion.max !== null && assertion.max === assertion.min) {
        return `Exactly ${assertion.min} element(s) match \`${assertion.selector}\``;
      }
      const atMost = assertion.max !== null ? ` and at most ${assertion.max}` : '';
      return `At least ${assertion.min} element(s) match \`${assertion.selector}\`${atMost}`;
    }
    case 'text':
      return `The text of \`${assertion.selector}\` ${MATCH_WORDS[assertion.match]} "${assertion.value}"`;
    case 'attribute':
      return assertion.match === 'present'
        ? `\`${assertion.selector}\` has the attribute \`${assertion.name}\``
        : `The \`${assertion.name}\` attribute of \`${assertion.selector}\` ${assertion.match === 'equals' ? 'is exactly' : 'contains'} "${assertion.value}"`;
    case 'style':
      return `\`${assertion.selector}\` has \`${assertion.property}: ${assertion.value}\``;
    case 'console':
      return `The console output ${MATCH_WORDS[assertion.match]} "${assertion.value}"`;
  }
}

/** A whole check in words. */
export function describeWebCheck(check: WebCheck): string {
  if (check.kind !== 'interaction') return describeWebAssertion(check);
  const steps = check.steps
    .map((step) =>
      step.action === 'input' || step.action === 'change'
        ? `${ACTION_WORDS[step.action]} \`${step.selector}\` "${step.value}"`
        : step.action === 'keydown'
          ? `${ACTION_WORDS[step.action]} \`${step.selector}\` (${step.key})`
          : `${ACTION_WORDS[step.action]} \`${step.selector}\``,
    )
    .join(', then ');
  return `After you ${steps}: ${describeWebAssertion(check.then).replace(/^./, (c) => c.toLowerCase())}`;
}
