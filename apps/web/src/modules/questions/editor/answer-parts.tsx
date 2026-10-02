'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  ANSWER_FILE_KINDS,
  type AnswerFileKind,
  type QuestionSpec,
  type QuestionType,
} from '@lms/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { draftKey, type OptionDraft } from './drafts';

export function EditorSection({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Choices for the two multiple-choice types; one correct for single choice, any number for multiple. */
export function OptionsEditor({
  type,
  options,
  onChange,
}: {
  type: QuestionType;
  options: OptionDraft[];
  onChange: (options: OptionDraft[]) => void;
}) {
  if (type === 'true_false') {
    const trueIsCorrect = options.find((o) => o.body === 'True')?.isCorrect ?? true;
    return (
      <EditorSection title="The answer">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={trueIsCorrect}
            aria-label="The statement is true"
            onCheckedChange={(checked) =>
              onChange(
                options.map((o) => ({
                  ...o,
                  isCorrect: o.body === 'True' ? checked === true : checked !== true,
                })),
              )
            }
          />
          The statement is true
        </label>
      </EditorSection>
    );
  }

  const update = (key: string, change: Partial<OptionDraft>) =>
    onChange(
      options.map((o) =>
        o.key === key
          ? { ...o, ...change }
          : type === 'mcq_single' && change.isCorrect === true
            ? { ...o, isCorrect: false }
            : o,
      ),
    );
  const move = (index: number, to: number) => {
    if (to < 0 || to >= options.length) return;
    const next = [...options];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };

  return (
    <EditorSection
      title="Options"
      description={
        type === 'mcq_single'
          ? 'Tick the one correct option.'
          : 'Tick every correct option; a learner must choose them all.'
      }
    >
      <ol className="space-y-3">
        {options.map((option, index) => (
          <li key={option.key} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Checkbox
                checked={option.isCorrect}
                aria-label={`Option ${index + 1} is correct`}
                onCheckedChange={(checked) => update(option.key, { isCorrect: checked === true })}
              />
              <Input
                className="min-w-0 flex-1"
                aria-label={`Option ${index + 1}`}
                value={option.body}
                maxLength={2000}
                onChange={(e) => update(option.key, { body: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move choice ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move choice ${index + 1} down`}
                disabled={index === options.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove choice ${index + 1}`}
                disabled={options.length <= 2}
                onClick={() => onChange(options.filter((o) => o.key !== option.key))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <Input
              aria-label={`Why choice ${index + 1} is right or wrong (optional)`}
              placeholder="Why it is right or wrong (optional)"
              value={option.explanation}
              maxLength={2000}
              onChange={(e) => update(option.key, { explanation: e.target.value })}
              className="text-xs"
            />
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={options.length >= 10}
        onClick={() =>
          onChange([...options, { key: draftKey(), body: '', isCorrect: false, explanation: '' }])
        }
      >
        <Plus aria-hidden="true" />
        Add option
      </Button>
    </EditorSection>
  );
}

const FILE_KIND_LABELS: Record<AnswerFileKind, string> = {
  pdf: 'PDF',
  zip: 'ZIP archive',
  image: 'Image (PNG, JPEG, WebP)',
  document: 'Word, PowerPoint or Excel file',
  text: 'Text or CSV file',
};

/** What a file-upload, practical or project answer must contain. */
export function HandInEditor({
  spec,
  onChange,
}: {
  spec: QuestionSpec;
  onChange: (spec: QuestionSpec) => void;
}) {
  const set = <K extends keyof QuestionSpec>(key: K, value: QuestionSpec[K]) =>
    onChange({ ...spec, [key]: value });
  return (
    <EditorSection
      title="What to hand in"
      description="At least one file or a link. The reviewer sees exactly this list."
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Files</legend>
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="spec-max-files" className="font-normal">
            Up to
          </Label>
          <Input
            id="spec-max-files"
            type="number"
            min={0}
            max={5}
            value={spec.maxFiles}
            onChange={(e) => set('maxFiles', Math.max(0, Math.min(5, Number(e.target.value) || 0)))}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">files (0 for none)</span>
        </div>
        {spec.maxFiles > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {ANSWER_FILE_KINDS.map((kind) => (
              <label key={kind} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={spec.fileKinds.includes(kind)}
                  onCheckedChange={(checked) =>
                    set(
                      'fileKinds',
                      checked === true
                        ? [...spec.fileKinds, kind]
                        : spec.fileKinds.filter((k) => k !== kind),
                    )
                  }
                />
                {FILE_KIND_LABELS[kind]}
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={spec.linkRequired}
            onCheckedChange={(checked) => set('linkRequired', checked === true)}
          />
          Ask for a link
        </label>
        {spec.linkRequired ? (
          <Input
            aria-label="What the link is"
            placeholder="For example: Repository address, or Deployed page"
            value={spec.linkLabel}
            maxLength={80}
            onChange={(e) => set('linkLabel', e.target.value)}
          />
        ) : null}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Checklist the learner confirms</p>
        <ol className="space-y-2">
          {spec.checklist.map((point, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <Input
                aria-label={`Checklist point ${index + 1}`}
                value={point}
                maxLength={200}
                onChange={(e) =>
                  set(
                    'checklist',
                    spec.checklist.map((p, i) => (i === index ? e.target.value : p)),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove checklist point ${index + 1}`}
                onClick={() =>
                  set(
                    'checklist',
                    spec.checklist.filter((_, i) => i !== index),
                  )
                }
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
          disabled={spec.checklist.length >= 20}
          onClick={() => set('checklist', [...spec.checklist, ''])}
        >
          <Plus aria-hidden="true" />
          Add a point
        </Button>
      </div>
    </EditorSection>
  );
}

/** Nudges a learner opens one at a time, in this order. */
export function HintsEditor({
  hints,
  onChange,
}: {
  hints: string[];
  onChange: (hints: string[]) => void;
}) {
  return (
    <EditorSection
      title="Hints"
      description="Up to five. A learner opens them one at a time, in this order."
    >
      {hints.length > 0 ? (
        <ol className="space-y-2">
          {hints.map((hint, index) => (
            <li key={index} className="flex items-start gap-2">
              <Textarea
                aria-label={`Hint ${index + 1}`}
                rows={2}
                value={hint}
                maxLength={2000}
                onChange={(e) => onChange(hints.map((h, i) => (i === index ? e.target.value : h)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove hint ${index + 1}`}
                onClick={() => onChange(hints.filter((_, i) => i !== index))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={hints.length >= 5}
        onClick={() => onChange([...hints, ''])}
      >
        <Plus aria-hidden="true" />
        Add a hint
      </Button>
    </EditorSection>
  );
}
