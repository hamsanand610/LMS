'use client';

import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import {
  WEB_ATTRIBUTE_MATCHES,
  WEB_LAB_LIMITS,
  WEB_STEP_ACTIONS,
  WEB_TEXT_MATCHES,
  describeWebCheck,
  webCheckSchema,
  type WebAssertion,
  type WebCheck,
  type WebStep,
  type WebStepAction,
} from '@lms/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import { EditorSection } from './answer-parts';
import { DEFAULT_WEB_CHECK, emptyCase, type CaseDraft } from './drafts';

type Kind = WebCheck['kind'];

const KIND_LABELS: Record<Kind, string> = {
  exists: 'Elements are on the page',
  text: 'An element’s text',
  attribute: 'An element’s attribute',
  style: 'An element’s style',
  console: 'What the page logs',
  interaction: 'After the learner does something',
};

const MATCH_LABELS: Record<string, string> = {
  equals: 'is exactly',
  contains: 'contains',
  matches: 'matches the pattern',
  present: 'is there',
};

const ACTION_LABELS: Record<WebStepAction, string> = {
  click: 'Click',
  input: 'Type into',
  change: 'Change',
  submit: 'Submit',
  focus: 'Focus',
  blur: 'Leave',
  keydown: 'Press a key in',
};

/** A fresh assertion of a kind, keeping the selector the author already wrote. */
function assertionOf(kind: Exclude<Kind, 'interaction'>, from: WebAssertion): WebAssertion {
  const selector = 'selector' in from ? from.selector : 'h1';
  switch (kind) {
    case 'exists':
      return { kind, selector, min: 1, max: null };
    case 'text':
      return { kind, selector, match: 'equals', value: '' };
    case 'attribute':
      return { kind, selector, name: '', match: 'present', value: '' };
    case 'style':
      return { kind, selector, property: 'color', value: '' };
    case 'console':
      return { kind, match: 'contains', value: '' };
  }
}

function checkOf(kind: Kind, from: WebCheck): WebCheck {
  const assertion = from.kind === 'interaction' ? from.then : from;
  if (kind === 'interaction') {
    return {
      kind,
      steps: [{ action: 'click', selector: 'button', value: '', key: '' }],
      then: assertion,
    };
  }
  return assertionOf(kind, assertion);
}

/** The first thing wrong with a check, in the schema's words; null when it is complete. */
function problemOf(check: WebCheck): string | null {
  const result = webCheckSchema.safeParse(check);
  return result.success ? null : (result.error.issues[0]?.message ?? 'This check is not complete');
}

/**
 * A Web Lab's checks (ADR-0019): each one is a test case whose input is the check and whose
 * expected output is `pass`. Visible checks are listed for learners in words; hidden ones are only
 * counted. The checks run in the sandbox, against the reference files when the lab is checked.
 */
export function WebChecksEditor({
  cases,
  onChange,
}: {
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
      title="Checks"
      description={`${visible} visible and ${hidden} hidden. Learners see a visible check in words and run it; a hidden check only marks a submission. Each check loads the learner’s page afresh in the sandbox.`}
    >
      <ol className="space-y-3">
        {cases.map((testCase, index) => {
          const check = testCase.check ?? DEFAULT_WEB_CHECK;
          const problem = problemOf(check);
          return (
            <li
              key={testCase.key}
              className={cn(
                'space-y-3 rounded-lg border p-3',
                testCase.enabled ? 'border-border' : 'border-dashed border-border bg-surface-2/40',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">Check {index + 1}</span>
                <Input
                  aria-label={`Name of check ${index + 1}`}
                  placeholder="Name (optional), e.g. Has a heading"
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
                    aria-label={`Check ${index + 1} is shown to learners`}
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
                    onCheckedChange={(checked) =>
                      update(testCase.key, { enabled: checked === true })
                    }
                    aria-label={`Check ${index + 1} is run and counted`}
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
                    aria-label={`Weight of check ${index + 1}`}
                  />
                </label>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move check ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move check ${index + 1} down`}
                    disabled={index === cases.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove check ${index + 1}`}
                    disabled={cases.length <= 1}
                    onClick={() => onChange(cases.filter((c) => c.key !== testCase.key))}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <CheckEditor
                idPrefix={`check-${testCase.key}`}
                check={check}
                onChange={(next) => update(testCase.key, { check: next })}
              />
              <p
                className={cn('text-xs', problem ? 'text-danger' : 'text-muted-foreground')}
                aria-live="polite"
              >
                {problem ?? `Learners read: ${describeWebCheck(check)}`}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={cases.length >= 50}
          onClick={() => onChange([...cases, emptyCase(true, true)])}
        >
          <Plus aria-hidden="true" />
          Add a visible check
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={cases.length >= 50}
          onClick={() => onChange([...cases, emptyCase(false, true)])}
        >
          <Plus aria-hidden="true" />
          Add a hidden check
        </Button>
      </div>
    </EditorSection>
  );
}

function CheckEditor({
  idPrefix,
  check,
  onChange,
}: {
  idPrefix: string;
  check: WebCheck;
  onChange: (check: WebCheck) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="max-w-xs space-y-1">
        <Label htmlFor={`${idPrefix}-kind`} className="text-xs">
          What is checked
        </Label>
        <NativeSelect
          id={`${idPrefix}-kind`}
          className="w-full"
          value={check.kind}
          onChange={(e) => onChange(checkOf(e.target.value as Kind, check))}
        >
          {(Object.keys(KIND_LABELS) as Kind[]).map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {check.kind === 'interaction' ? (
        <>
          <StepsEditor
            idPrefix={`${idPrefix}-steps`}
            steps={check.steps}
            onChange={(steps) => onChange({ ...check, steps })}
          />
          <div className="space-y-2 rounded-md border border-border bg-surface-2/40 p-3">
            <p className="text-xs font-medium">Then</p>
            <div className="max-w-xs space-y-1">
              <Label htmlFor={`${idPrefix}-then-kind`} className="text-xs">
                What is checked afterwards
              </Label>
              <NativeSelect
                id={`${idPrefix}-then-kind`}
                className="w-full"
                value={check.then.kind}
                onChange={(e) =>
                  onChange({
                    ...check,
                    then: assertionOf(e.target.value as Exclude<Kind, 'interaction'>, check.then),
                  })
                }
              >
                {(Object.keys(KIND_LABELS) as Kind[])
                  .filter((kind) => kind !== 'interaction')
                  .map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABELS[kind]}
                    </option>
                  ))}
              </NativeSelect>
            </div>
            <AssertionFields
              idPrefix={`${idPrefix}-then`}
              assertion={check.then}
              onChange={(then) => onChange({ ...check, then })}
            />
          </div>
        </>
      ) : (
        <AssertionFields idPrefix={idPrefix} assertion={check} onChange={onChange} />
      )}
    </div>
  );
}

function SelectorField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        CSS selector
      </Label>
      <Input
        id={id}
        value={value}
        maxLength={WEB_LAB_LIMITS.selectorChars}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
        placeholder="#total, .item, form button"
        spellCheck={false}
      />
    </div>
  );
}

function AssertionFields({
  idPrefix,
  assertion,
  onChange,
}: {
  idPrefix: string;
  assertion: WebAssertion;
  onChange: (assertion: WebAssertion) => void;
}) {
  switch (assertion.kind) {
    case 'exists':
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem_7rem]">
          <SelectorField
            id={`${idPrefix}-selector`}
            value={assertion.selector}
            onChange={(selector) => onChange({ ...assertion, selector })}
          />
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-min`} className="text-xs">
              At least
            </Label>
            <Input
              id={`${idPrefix}-min`}
              type="number"
              min={0}
              max={1000}
              value={assertion.min}
              onChange={(e) =>
                onChange({
                  ...assertion,
                  min: Math.max(0, Math.min(1000, Math.round(Number(e.target.value) || 0))),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-max`} className="text-xs">
              At most
            </Label>
            <Input
              id={`${idPrefix}-max`}
              type="number"
              min={0}
              max={1000}
              placeholder="Any"
              value={assertion.max ?? ''}
              onChange={(e) =>
                onChange({
                  ...assertion,
                  max:
                    e.target.value.trim() === ''
                      ? null
                      : Math.max(0, Math.min(1000, Math.round(Number(e.target.value) || 0))),
                })
              }
            />
          </div>
        </div>
      );
    case 'text':
    case 'console':
      return (
        <div
          className={cn(
            'grid gap-3',
            assertion.kind === 'text' ? 'sm:grid-cols-[1fr_11rem_1fr]' : 'sm:grid-cols-[11rem_1fr]',
          )}
        >
          {assertion.kind === 'text' ? (
            <SelectorField
              id={`${idPrefix}-selector`}
              value={assertion.selector}
              onChange={(selector) => onChange({ ...assertion, selector })}
            />
          ) : null}
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-match`} className="text-xs">
              {assertion.kind === 'text' ? 'The text' : 'The console output'}
            </Label>
            <NativeSelect
              id={`${idPrefix}-match`}
              className="w-full"
              value={assertion.match}
              onChange={(e) =>
                onChange({ ...assertion, match: e.target.value as typeof assertion.match })
              }
            >
              {WEB_TEXT_MATCHES.map((match) => (
                <option key={match} value={match}>
                  {MATCH_LABELS[match]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-value`} className="text-xs">
              {assertion.match === 'matches' ? 'Pattern (a regular expression)' : 'Text'}
            </Label>
            <Input
              id={`${idPrefix}-value`}
              value={assertion.value}
              maxLength={WEB_LAB_LIMITS.valueChars}
              onChange={(e) => onChange({ ...assertion, value: e.target.value })}
              className={assertion.match === 'matches' ? 'font-mono text-xs' : undefined}
              spellCheck={false}
            />
          </div>
        </div>
      );
    case 'attribute':
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem_1fr]">
          <SelectorField
            id={`${idPrefix}-selector`}
            value={assertion.selector}
            onChange={(selector) => onChange({ ...assertion, selector })}
          />
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-name`} className="text-xs">
              Attribute
            </Label>
            <Input
              id={`${idPrefix}-name`}
              value={assertion.name}
              maxLength={100}
              onChange={(e) => onChange({ ...assertion, name: e.target.value })}
              className="font-mono text-xs"
              placeholder="alt"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-match`} className="text-xs">
              Its value
            </Label>
            <NativeSelect
              id={`${idPrefix}-match`}
              className="w-full"
              value={assertion.match}
              onChange={(e) =>
                onChange({ ...assertion, match: e.target.value as typeof assertion.match })
              }
            >
              {WEB_ATTRIBUTE_MATCHES.map((match) => (
                <option key={match} value={match}>
                  {MATCH_LABELS[match]}
                </option>
              ))}
            </NativeSelect>
          </div>
          {assertion.match !== 'present' ? (
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-value`} className="text-xs">
                Value
              </Label>
              <Input
                id={`${idPrefix}-value`}
                value={assertion.value}
                maxLength={WEB_LAB_LIMITS.valueChars}
                onChange={(e) => onChange({ ...assertion, value: e.target.value })}
                spellCheck={false}
              />
            </div>
          ) : null}
        </div>
      );
    case 'style':
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_11rem_1fr]">
          <SelectorField
            id={`${idPrefix}-selector`}
            value={assertion.selector}
            onChange={(selector) => onChange({ ...assertion, selector })}
          />
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-property`} className="text-xs">
              CSS property
            </Label>
            <Input
              id={`${idPrefix}-property`}
              value={assertion.property}
              maxLength={60}
              onChange={(e) => onChange({ ...assertion, property: e.target.value })}
              className="font-mono text-xs"
              placeholder="background-color"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-value`} className="text-xs">
              Value
            </Label>
            <Input
              id={`${idPrefix}-value`}
              value={assertion.value}
              maxLength={200}
              onChange={(e) => onChange({ ...assertion, value: e.target.value })}
              className="font-mono text-xs"
              placeholder="#1a73e8"
              spellCheck={false}
            />
          </div>
        </div>
      );
  }
}

function StepsEditor({
  idPrefix,
  steps,
  onChange,
}: {
  idPrefix: string;
  steps: WebStep[];
  onChange: (steps: WebStep[]) => void;
}) {
  const update = (index: number, change: Partial<WebStep>) =>
    onChange(steps.map((step, i) => (i === index ? { ...step, ...change } : step)));
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">Steps, in order</p>
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={index} className="grid items-end gap-2 sm:grid-cols-[2rem_9rem_1fr_1fr_auto]">
            <span className="pb-2 text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-${index}-action`} className="text-xs">
                Action
              </Label>
              <NativeSelect
                id={`${idPrefix}-${index}-action`}
                className="w-full"
                value={step.action}
                onChange={(e) => update(index, { action: e.target.value as WebStepAction })}
              >
                {WEB_STEP_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {ACTION_LABELS[action]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <SelectorField
              id={`${idPrefix}-${index}-selector`}
              value={step.selector}
              onChange={(selector) => update(index, { selector })}
            />
            {step.action === 'input' || step.action === 'change' ? (
              <div className="space-y-1">
                <Label htmlFor={`${idPrefix}-${index}-value`} className="text-xs">
                  Value
                </Label>
                <Input
                  id={`${idPrefix}-${index}-value`}
                  value={step.value}
                  maxLength={WEB_LAB_LIMITS.valueChars}
                  onChange={(e) => update(index, { value: e.target.value })}
                  spellCheck={false}
                />
              </div>
            ) : step.action === 'keydown' ? (
              <div className="space-y-1">
                <Label htmlFor={`${idPrefix}-${index}-key`} className="text-xs">
                  Key
                </Label>
                <Input
                  id={`${idPrefix}-${index}-key`}
                  value={step.key}
                  maxLength={40}
                  onChange={(e) => update(index, { key: e.target.value })}
                  placeholder="Enter"
                  className="font-mono text-xs"
                  spellCheck={false}
                />
              </div>
            ) : (
              <span aria-hidden="true" />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove step ${index + 1}`}
              disabled={steps.length <= 1}
              onClick={() => onChange(steps.filter((_, i) => i !== index))}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={steps.length >= WEB_LAB_LIMITS.steps}
        onClick={() =>
          onChange([...steps, { action: 'click', selector: 'button', value: '', key: '' }])
        }
      >
        <Plus aria-hidden="true" />
        Add a step
      </Button>
    </div>
  );
}
