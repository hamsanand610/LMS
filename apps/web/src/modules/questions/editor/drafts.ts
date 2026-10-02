import {
  EMPTY_WEB_FILES,
  EXECUTED_TYPES,
  WEB_CHECK_PASS,
  decodeWebCheck,
  decodeWebFiles,
  encodeWebCheck,
  encodeWebFiles,
  type CompareMode,
  type ExecutionLanguage,
  type QuestionCreateInput,
  type QuestionDetail,
  type QuestionSpec,
  type QuestionType,
  type WebCheck,
  type WebFiles,
} from '@lms/shared';

let counter = 0;
/** A key for a row that has no id yet, stable while the row is edited. */
export const draftKey = () => `draft-${++counter}`;

export interface OptionDraft {
  key: string;
  id?: string;
  body: string;
  isCorrect: boolean;
  explanation: string;
}

export interface CaseDraft {
  key: string;
  id?: string;
  label: string;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  enabled: boolean;
  weight: number;
  explanation: string;
  /** Empty uses the problem's limit. */
  timeLimitMs: string;
  memoryLimitMb: string;
  /** Web: the check this case makes; it travels as the case's input (ADR-0019). */
  check?: WebCheck;
}

/** A new check: the page has a heading. */
export const DEFAULT_WEB_CHECK: WebCheck = { kind: 'exists', selector: 'h1', min: 1, max: null };

/** The page a new web lab starts from, for the author to change. */
export const STARTER_PAGE: WebFiles = {
  html: '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>Lab</title>\n</head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>\n',
  css: '',
  js: '',
};

export interface CodingDraft {
  languages: ExecutionLanguage[];
  starterCode: Record<string, string>;
  referenceSolution: Record<string, string>;
  timeLimitMs: number;
  memoryLimitMb: number;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  compareMode: CompareMode;
  setupSql: string;
  sqlCheck: string;
  /** Debugging: what the program should do once it is fixed. */
  expectedBehaviour: string;
  /** Web: the files learners start from, and files that pass every check. */
  webStarter: WebFiles;
  webReference: WebFiles;
  cases: CaseDraft[];
}

export const EMPTY_SPEC: QuestionSpec = {
  fileKinds: [],
  maxFiles: 0,
  linkRequired: false,
  linkLabel: '',
  checklist: [],
};

export function emptyCase(isSample: boolean, web = false): CaseDraft {
  return {
    key: draftKey(),
    label: '',
    input: '',
    expectedOutput: '',
    isSample,
    enabled: true,
    weight: 1,
    explanation: '',
    timeLimitMs: '',
    memoryLimitMb: '',
    ...(web ? { check: { ...DEFAULT_WEB_CHECK } } : {}),
  };
}

export function defaultCoding(type: QuestionType): CodingDraft {
  const sql = type === 'sql';
  const web = type === 'web';
  return {
    languages: sql ? ['sql'] : web ? ['web'] : ['java'],
    starterCode: {},
    referenceSolution: {},
    // A web check loads the page twice over (ADR-0019), so its own allowance is smaller.
    timeLimitMs: sql ? 3000 : web ? 2000 : 5000,
    memoryLimitMb: web ? 256 : 128,
    inputFormat: '',
    outputFormat: '',
    constraints: '',
    compareMode: sql ? 'rows' : 'trim',
    setupSql: '',
    sqlCheck: '',
    expectedBehaviour: '',
    webStarter: web ? STARTER_PAGE : EMPTY_WEB_FILES,
    webReference: web ? STARTER_PAGE : EMPTY_WEB_FILES,
    cases: [emptyCase(true, web), emptyCase(false, web)],
  };
}

export function codingFrom(existing: QuestionDetail): CodingDraft {
  const coding = existing.coding;
  if (!coding) return defaultCoding(existing.type);
  const web = existing.type === 'web';
  return {
    languages: coding.languages,
    starterCode: { ...coding.starterCode },
    referenceSolution: { ...(coding.referenceSolution ?? {}) },
    timeLimitMs: coding.timeLimitMs,
    memoryLimitMb: coding.memoryLimitMb,
    inputFormat: coding.inputFormat,
    outputFormat: coding.outputFormat,
    constraints: coding.constraints,
    compareMode: coding.compareMode,
    setupSql: coding.setupSql ?? '',
    sqlCheck: coding.sqlCheck ?? '',
    expectedBehaviour: coding.expectedBehaviour ?? '',
    webStarter: web
      ? (decodeWebFiles(coding.starterCode['web'] ?? '') ?? EMPTY_WEB_FILES)
      : EMPTY_WEB_FILES,
    webReference: web
      ? (decodeWebFiles(coding.referenceSolution?.['web'] ?? '') ?? EMPTY_WEB_FILES)
      : EMPTY_WEB_FILES,
    cases: coding.testCases.map((c) => ({
      key: c.id,
      id: c.id,
      label: c.label,
      input: c.input ?? '',
      expectedOutput: c.expectedOutput ?? '',
      isSample: c.isSample,
      enabled: c.enabled,
      weight: c.weight,
      explanation: c.explanation ?? '',
      timeLimitMs: c.timeLimitMs === null ? '' : String(c.timeLimitMs),
      memoryLimitMb: c.memoryLimitMb === null ? '' : String(c.memoryLimitMb),
      ...(web ? { check: decodeWebCheck(c.input ?? '') ?? { ...DEFAULT_WEB_CHECK } } : {}),
    })),
  };
}

export function optionsFor(type: QuestionType, current: OptionDraft[]): OptionDraft[] {
  if (type === 'true_false') {
    const trueIsCorrect = current.find((o) => o.body === 'True')?.isCorrect ?? true;
    return [
      {
        key: current[0]?.key ?? draftKey(),
        id: current[0]?.id,
        body: 'True',
        isCorrect: trueIsCorrect,
        explanation: '',
      },
      {
        key: current[1]?.key ?? draftKey(),
        id: current[1]?.id,
        body: 'False',
        isCorrect: !trueIsCorrect,
        explanation: '',
      },
    ];
  }
  if (type === 'mcq_single' || type === 'mcq_multi') {
    const kept = current.filter((o) => o.body !== 'True' && o.body !== 'False');
    while (kept.length < 2)
      kept.push({ key: draftKey(), body: '', isCorrect: false, explanation: '' });
    return kept;
  }
  return [];
}

const optionalLimit = (value: string, min: number, max: number): number | null => {
  if (value.trim() === '') return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
};

/** The draft as the API takes it. Fields a type does not use are sent empty. */
export function toPayload(draft: {
  title: string;
  body: string;
  type: QuestionType;
  subject: string;
  topic: string;
  difficulty: QuestionCreateInput['difficulty'];
  marks: number;
  negativeMarks: number;
  explanation: string;
  rubric: string;
  tags: string;
  hints: string[];
  options: OptionDraft[];
  spec: QuestionSpec;
  coding: CodingDraft;
}): QuestionCreateInput {
  const objective = ['mcq_single', 'mcq_multi', 'true_false'].includes(draft.type);
  const executed = EXECUTED_TYPES.includes(draft.type);
  const web = draft.type === 'web';
  const handIn = ['file_upload', 'practical', 'project'].includes(draft.type);
  const languages: ExecutionLanguage[] =
    draft.type === 'sql'
      ? ['sql']
      : web
        ? ['web']
        : draft.coding.languages.filter((l) => l !== 'sql' && l !== 'web');
  return {
    title: draft.title.trim(),
    body: draft.body.trim(),
    type: draft.type,
    subject: draft.subject,
    topic: draft.topic,
    difficulty: draft.difficulty,
    marks: draft.marks,
    negativeMarks: objective ? draft.negativeMarks : 0,
    explanation: draft.explanation.trim(),
    rubric: objective ? '' : draft.rubric.trim(),
    tags: draft.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20),
    hints: draft.hints.map((hint) => hint.trim()).filter(Boolean),
    options: objective
      ? draft.options.map((o) => ({
          ...(o.id ? { id: o.id } : {}),
          body: o.body.trim(),
          isCorrect: o.isCorrect,
          explanation: o.explanation.trim(),
        }))
      : [],
    spec: handIn ? draft.spec : EMPTY_SPEC,
    coding: executed
      ? {
          languages,
          starterCode: web
            ? { web: encodeWebFiles(draft.coding.webStarter) }
            : pick(draft.coding.starterCode, languages),
          referenceSolution: web
            ? { web: encodeWebFiles(draft.coding.webReference) }
            : pick(draft.coding.referenceSolution, languages),
          timeLimitMs: draft.coding.timeLimitMs,
          memoryLimitMb: draft.coding.memoryLimitMb,
          inputFormat: web ? '' : draft.coding.inputFormat.trim(),
          outputFormat: web ? '' : draft.coding.outputFormat.trim(),
          constraints: web ? '' : draft.coding.constraints.trim(),
          expectedBehaviour:
            draft.type === 'debugging' ? draft.coding.expectedBehaviour.trim() : '',
          compareMode: web ? 'trim' : draft.coding.compareMode,
          setupSql: draft.type === 'sql' ? draft.coding.setupSql : '',
          sqlCheck: draft.type === 'sql' ? draft.coding.sqlCheck : '',
          testCases: draft.coding.cases.map((c) => ({
            ...(c.id ? { id: c.id } : {}),
            label: c.label.trim(),
            // A web case's input is its check, and what it must print is `pass` (ADR-0019).
            input: web ? encodeWebCheck(c.check ?? DEFAULT_WEB_CHECK) : c.input,
            expectedOutput: web ? WEB_CHECK_PASS : c.expectedOutput,
            isSample: c.isSample,
            enabled: c.enabled,
            weight: c.weight,
            explanation: c.explanation.trim(),
            timeLimitMs: optionalLimit(c.timeLimitMs, 100, 30_000),
            memoryLimitMb: optionalLimit(c.memoryLimitMb, 16, 512),
          })),
        }
      : null,
  };
}

/** Only the languages still offered; a language taken off keeps nothing behind. */
function pick(
  record: Record<string, string>,
  languages: ExecutionLanguage[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const language of languages) {
    const value = record[language];
    if (value !== undefined && value !== '') out[language] = value;
  }
  return out;
}
