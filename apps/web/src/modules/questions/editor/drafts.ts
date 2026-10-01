import {
  type CompareMode,
  type ExecutionLanguage,
  type QuestionCreateInput,
  type QuestionDetail,
  type QuestionSpec,
  type QuestionType,
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
}

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
  cases: CaseDraft[];
}

export const EMPTY_SPEC: QuestionSpec = {
  fileKinds: [],
  maxFiles: 0,
  linkRequired: false,
  linkLabel: '',
  checklist: [],
};

export function emptyCase(isSample: boolean): CaseDraft {
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
  };
}

export function defaultCoding(type: QuestionType): CodingDraft {
  const sql = type === 'sql';
  return {
    languages: sql ? ['sql'] : ['java'],
    starterCode: {},
    referenceSolution: {},
    timeLimitMs: sql ? 3000 : 5000,
    memoryLimitMb: 128,
    inputFormat: '',
    outputFormat: '',
    constraints: '',
    compareMode: sql ? 'rows' : 'trim',
    setupSql: '',
    sqlCheck: '',
    cases: [emptyCase(true), emptyCase(false)],
  };
}

export function codingFrom(existing: QuestionDetail): CodingDraft {
  const coding = existing.coding;
  if (!coding) return defaultCoding(existing.type);
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
  const executed = draft.type === 'coding' || draft.type === 'sql';
  const handIn = ['file_upload', 'practical', 'project'].includes(draft.type);
  const languages: ExecutionLanguage[] =
    draft.type === 'sql' ? ['sql'] : draft.coding.languages.filter((l) => l !== 'sql');
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
          starterCode: pick(draft.coding.starterCode, languages),
          referenceSolution: pick(draft.coding.referenceSolution, languages),
          timeLimitMs: draft.coding.timeLimitMs,
          memoryLimitMb: draft.coding.memoryLimitMb,
          inputFormat: draft.coding.inputFormat.trim(),
          outputFormat: draft.coding.outputFormat.trim(),
          constraints: draft.coding.constraints.trim(),
          compareMode: draft.coding.compareMode,
          setupSql: draft.type === 'sql' ? draft.coding.setupSql : '',
          sqlCheck: draft.type === 'sql' ? draft.coding.sqlCheck : '',
          testCases: draft.coding.cases.map((c) => ({
            ...(c.id ? { id: c.id } : {}),
            label: c.label.trim(),
            input: c.input,
            expectedOutput: c.expectedOutput,
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
