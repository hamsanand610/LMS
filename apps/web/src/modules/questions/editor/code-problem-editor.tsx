'use client';

import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  CODE_LANGUAGES,
  COMPARE_MODES,
  LANGUAGE_LABELS,
  LANGUAGE_FILE_NAMES,
  SQL_COMPARE_MODES,
  type CompareMode,
  type ExecutionLanguage,
  type LabType,
} from '@lms/shared';
import { CodeEditor } from '@/components/code-editor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { WebFilesEditor } from '@/modules/labs/web-files-editor';
import { EditorSection } from './answer-parts';
import { emptyCase, type CaseDraft, type CodingDraft } from './drafts';
import { WebChecksEditor } from './web-checks-editor';

const COMPARE_LABELS: Record<CompareMode, string> = {
  trim: 'Line by line, ignoring trailing spaces (usual)',
  exact: 'Exactly, character for character',
  tokens: 'Word by word, ignoring all spacing',
  unordered_lines: 'The same lines in any order',
  float: 'Numbers to within 0.000001',
  rows: 'The result table, rows in order',
  rows_unordered: 'The result table, rows in any order',
};

/**
 * The runnable half of a coding, SQL, debugging or web question. Everything here is checked in the
 * sandbox when the reference solution is validated; hidden cases never leave the server for a
 * learner.
 */
export function CodeProblemEditor({
  type,
  coding,
  onChange,
}: {
  type: LabType;
  coding: CodingDraft;
  onChange: (coding: CodingDraft) => void;
}) {
  const sql = type === 'sql';
  const web = type === 'web';
  const debugging = type === 'debugging';
  const [active, setActive] = useState<ExecutionLanguage>(
    coding.languages[0] ?? (sql ? 'sql' : 'java'),
  );
  const set = <K extends keyof CodingDraft>(key: K, value: CodingDraft[K]) =>
    onChange({ ...coding, [key]: value });
  const current = coding.languages.includes(active) ? active : (coding.languages[0] ?? active);
  const modes = sql ? SQL_COMPARE_MODES : COMPARE_MODES;

  return (
    <>
      <EditorSection
        title={sql ? 'The database' : web ? 'Limits' : 'Languages and limits'}
        description={
          sql
            ? 'Every case starts from these tables and rows, in a fresh database of its own.'
            : web
              ? 'Each check loads the learner’s page afresh in the sandbox. The time limit is for the page’s own scripts; loading the page is allowed for on top of it.'
              : 'Learners answer in any language ticked here. The reference solution must pass in each.'
        }
      >
        {sql ? (
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-medium" id="setup-sql-label">
                Tables and rows
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <CodeEditor
                  value={coding.setupSql}
                  onChange={(value) => set('setupSql', value)}
                  language="sql"
                  label="Tables and rows"
                  className="h-56"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Check query (only when learners change data)</p>
              <p className="text-xs text-muted-foreground">
                For an INSERT, UPDATE or DELETE question: this query runs after the learner’s
                statements and its result is what gets compared. Leave it empty when the learner
                writes a SELECT.
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <CodeEditor
                  value={coding.sqlCheck}
                  onChange={(value) => set('sqlCheck', value)}
                  language="sql"
                  label="Check query"
                  className="h-24"
                />
              </div>
            </div>
          </>
        ) : web ? null : (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Languages</legend>
            <div className="flex flex-wrap gap-4">
              {CODE_LANGUAGES.map((language) => (
                <label key={language} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={coding.languages.includes(language)}
                    disabled={coding.languages.length === 1 && coding.languages.includes(language)}
                    onCheckedChange={(checked) => {
                      const languages =
                        checked === true
                          ? CODE_LANGUAGES.filter(
                              (l) => l === language || coding.languages.includes(l),
                            )
                          : coding.languages.filter((l) => l !== language);
                      set('languages', languages);
                      if (checked === true) setActive(language);
                    }}
                  />
                  {LANGUAGE_LABELS[language]}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className={cn('grid gap-4', web ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
          <div className="space-y-1.5">
            <Label htmlFor="coding-time">Time limit (ms)</Label>
            <Input
              id="coding-time"
              type="number"
              min={100}
              max={30000}
              step={100}
              value={coding.timeLimitMs}
              onChange={(e) =>
                set('timeLimitMs', Math.max(100, Math.min(30000, Number(e.target.value) || 100)))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coding-memory">Memory limit (MB)</Label>
            <Input
              id="coding-memory"
              type="number"
              min={16}
              max={512}
              value={coding.memoryLimitMb}
              onChange={(e) =>
                set('memoryLimitMb', Math.max(16, Math.min(512, Number(e.target.value) || 16)))
              }
            />
          </div>
          {web ? null : (
            <div className="space-y-1.5">
              <Label htmlFor="coding-compare">Compare the output</Label>
              <NativeSelect
                id="coding-compare"
                className="w-full"
                value={coding.compareMode}
                onChange={(e) => set('compareMode', e.target.value as CompareMode)}
              >
                {modes.map((mode) => (
                  <option key={mode} value={mode}>
                    {COMPARE_LABELS[mode]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
        </div>
      </EditorSection>

      {debugging ? (
        <EditorSection
          title="What the program should do"
          description="Learners read this beside the code with the bug. Say what the fixed program does, not where the bug is."
        >
          <Label htmlFor="coding-expected-behaviour" className="sr-only">
            What the program should do once it is fixed
          </Label>
          <Textarea
            id="coding-expected-behaviour"
            rows={4}
            maxLength={4000}
            value={coding.expectedBehaviour}
            onChange={(e) => set('expectedBehaviour', e.target.value)}
            placeholder="It reads n numbers and prints their average to two decimal places."
          />
        </EditorSection>
      ) : null}

      {!sql && !web ? (
        <EditorSection
          title="Input and output"
          description="Shown to learners under the problem, in this order."
        >
          <div className="space-y-1.5">
            <Label htmlFor="coding-input-format">Input format</Label>
            <Textarea
              id="coding-input-format"
              rows={2}
              maxLength={4000}
              value={coding.inputFormat}
              onChange={(e) => set('inputFormat', e.target.value)}
              placeholder="The first line holds n; the second, n integers separated by spaces."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coding-output-format">Output format</Label>
            <Textarea
              id="coding-output-format"
              rows={2}
              maxLength={4000}
              value={coding.outputFormat}
              onChange={(e) => set('outputFormat', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coding-constraints">Constraints</Label>
            <Textarea
              id="coding-constraints"
              rows={2}
              maxLength={4000}
              value={coding.constraints}
              onChange={(e) => set('constraints', e.target.value)}
              placeholder="1 ≤ n ≤ 100000"
            />
          </div>
        </EditorSection>
      ) : null}

      {web ? (
        <EditorSection
          title="Starting files and reference files"
          description="Learners start from the starting files. The reference files are never shown to them; they prove every check can pass."
        >
          <div className="grid gap-4 2xl:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm font-medium">Starting files</p>
              <div className="overflow-hidden rounded-lg border border-border">
                <WebFilesEditor
                  label="Starting files"
                  files={coding.webStarter}
                  onChange={(files) => set('webStarter', files)}
                  className="h-72"
                />
              </div>
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm font-medium">
                Reference files{' '}
                <span className="font-normal text-muted-foreground">· never shown to learners</span>
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <WebFilesEditor
                  label="Reference files"
                  files={coding.webReference}
                  onChange={(files) => set('webReference', files)}
                  className="h-72"
                />
              </div>
            </div>
          </div>
        </EditorSection>
      ) : (
        <EditorSection
          title={
            debugging
              ? 'The code with the bug, and the fix'
              : 'Starting code and reference solution'
          }
          description={
            debugging
              ? 'Learners start from the code with the bug and fix it. The check runs both: the fix must pass every case, and the code with the bug must fail at least one.'
              : 'Learners start from the starting code. The reference solution is never shown to them; it proves the cases are right.'
          }
        >
          {!sql && coding.languages.length > 1 ? (
            <div
              role="tablist"
              aria-label="Language"
              className="inline-flex flex-wrap rounded-lg bg-surface-2 p-1 text-sm"
            >
              {coding.languages.map((language) => (
                <button
                  key={language}
                  type="button"
                  role="tab"
                  aria-selected={current === language}
                  onClick={() => setActive(language)}
                  className={cn(
                    'rounded-md px-3 py-1.5',
                    current === language
                      ? 'bg-surface font-medium text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {LANGUAGE_LABELS[language]}
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-4 2xl:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm font-medium">
                {debugging ? 'The code with the bug' : 'Starting code'}{' '}
                <span className="font-normal text-muted-foreground">
                  · {LANGUAGE_FILE_NAMES[current]}
                </span>
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <CodeEditor
                  key={`starter-${current}`}
                  value={coding.starterCode[current] ?? ''}
                  onChange={(value) =>
                    set('starterCode', { ...coding.starterCode, [current]: value })
                  }
                  language={current}
                  label={`${LANGUAGE_LABELS[current]} ${debugging ? 'code with the bug' : 'starting code'}`}
                  className="h-60"
                />
              </div>
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm font-medium">
                {debugging ? 'The fixed code' : 'Reference solution'}{' '}
                <span className="font-normal text-muted-foreground">· never shown to learners</span>
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <CodeEditor
                  key={`solution-${current}`}
                  value={coding.referenceSolution[current] ?? ''}
                  onChange={(value) =>
                    set('referenceSolution', { ...coding.referenceSolution, [current]: value })
                  }
                  language={current}
                  label={`${LANGUAGE_LABELS[current]} reference solution`}
                  className="h-60"
                />
              </div>
            </div>
          </div>
        </EditorSection>
      )}

      {web ? (
        <WebChecksEditor cases={coding.cases} onChange={(cases) => set('cases', cases)} />
      ) : (
        <CasesEditor sql={sql} cases={coding.cases} onChange={(cases) => set('cases', cases)} />
      )}
    </>
  );
}

function CasesEditor({
  sql,
  cases,
  onChange,
}: {
  sql: boolean;
  cases: CaseDraft[];
  onChange: (cases: CaseDraft[]) => void;
}) {
  const update = (key: string, change: Partial<CaseDraft>) =>
    onChange(cases.map((c) => (c.key === key ? { ...c, ...change } : c)));
  const move = (index: number, to: number) => {
    if (to < 0 || to >= cases.length) return;
    const next = [...cases];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };
  const visible = cases.filter((c) => c.isSample && c.enabled).length;
  const hidden = cases.filter((c) => !c.isSample && c.enabled).length;

  return (
    <EditorSection
      title="Test cases"
      description={`${visible} visible and ${hidden} hidden. Visible cases are the examples learners run; hidden ones only mark a submission, and learners see just their verdicts.`}
    >
      <ol className="space-y-3">
        {cases.map((testCase, index) => (
          <li
            key={testCase.key}
            className={cn(
              'rounded-lg border p-3',
              testCase.enabled ? 'border-border' : 'border-dashed border-border bg-surface-2/40',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold tabular-nums">Case {index + 1}</span>
              <Input
                aria-label={`Name of case ${index + 1}`}
                placeholder="Name (optional), e.g. Empty list"
                value={testCase.label}
                maxLength={120}
                onChange={(e) => update(testCase.key, { label: e.target.value })}
                className="h-8 max-w-60 text-sm"
              />
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={testCase.isSample}
                  onCheckedChange={(checked) =>
                    update(testCase.key, { isSample: checked === true })
                  }
                  aria-label={`Case ${index + 1} is shown to learners`}
                />
                {testCase.isSample ? (
                  <Eye className="size-3.5 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <EyeOff className="size-3.5 text-muted-foreground" aria-hidden="true" />
                )}
                Visible
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={testCase.enabled}
                  onCheckedChange={(checked) => update(testCase.key, { enabled: checked === true })}
                  aria-label={`Case ${index + 1} is run and counted`}
                />
                Counted
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                Weight
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={testCase.weight}
                  onChange={(e) =>
                    update(testCase.key, {
                      weight: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                    })
                  }
                  className="h-8 w-16"
                  aria-label={`Weight of case ${index + 1}`}
                />
              </label>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move case ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move case ${index + 1} down`}
                  disabled={index === cases.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove case ${index + 1}`}
                  disabled={cases.length <= 1}
                  onClick={() => onChange(cases.filter((c) => c.key !== testCase.key))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`case-${testCase.key}-input`} className="text-xs">
                  {sql ? 'Extra statements for this case (optional)' : 'Input'}
                </Label>
                <Textarea
                  id={`case-${testCase.key}-input`}
                  rows={3}
                  maxLength={20000}
                  className="font-mono text-xs"
                  value={testCase.input}
                  onChange={(e) => update(testCase.key, { input: e.target.value })}
                  placeholder={sql ? "INSERT INTO orders VALUES (9, 'late', 0);" : '3\n1 2 3'}
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`case-${testCase.key}-expected`} className="text-xs">
                  {sql ? 'Expected result (filled in by the check when empty)' : 'Expected output'}
                </Label>
                <Textarea
                  id={`case-${testCase.key}-expected`}
                  rows={3}
                  maxLength={100000}
                  className="font-mono text-xs"
                  value={testCase.expectedOutput}
                  onChange={(e) => update(testCase.key, { expectedOutput: e.target.value })}
                  spellCheck={false}
                />
              </div>
            </div>
            <details className="group/more mt-2">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  className="size-3.5 transition-transform group-open/more:rotate-180"
                  aria-hidden="true"
                />
                Explanation and limits for this case
              </summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_9rem_9rem]">
                <div className="space-y-1">
                  <Label htmlFor={`case-${testCase.key}-explanation`} className="text-xs">
                    Explanation (shown with a visible case)
                  </Label>
                  <Input
                    id={`case-${testCase.key}-explanation`}
                    value={testCase.explanation}
                    maxLength={2000}
                    onChange={(e) => update(testCase.key, { explanation: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`case-${testCase.key}-time`} className="text-xs">
                    Time (ms)
                  </Label>
                  <Input
                    id={`case-${testCase.key}-time`}
                    type="number"
                    min={100}
                    max={30000}
                    placeholder="Problem’s"
                    value={testCase.timeLimitMs}
                    onChange={(e) => update(testCase.key, { timeLimitMs: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`case-${testCase.key}-memory`} className="text-xs">
                    Memory (MB)
                  </Label>
                  <Input
                    id={`case-${testCase.key}-memory`}
                    type="number"
                    min={16}
                    max={512}
                    placeholder="Problem’s"
                    value={testCase.memoryLimitMb}
                    onChange={(e) => update(testCase.key, { memoryLimitMb: e.target.value })}
                  />
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={cases.length >= 50}
          onClick={() => onChange([...cases, emptyCase(true)])}
        >
          <Plus aria-hidden="true" />
          Add a visible case
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={cases.length >= 50}
          onClick={() => onChange([...cases, emptyCase(false)])}
        >
          <Plus aria-hidden="true" />
          Add a hidden case
        </Button>
      </div>
    </EditorSection>
  );
}
