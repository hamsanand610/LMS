'use client';

import { FileUp, Link2, Loader2, Plus, Send, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ANSWER_FILE_KIND_MIMES,
  type LearnerQuestionWorkspace,
  type SubmissionInput,
  type SubmissionView,
} from '@lms/shared';
import { ChoiceRow } from '@/components/choice-row';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { uploadFile, type UploadedFile } from '@/lib/files/upload';
import { cn } from '@/lib/utils';

type Submit = (input: Partial<SubmissionInput>) => Promise<SubmissionView | null>;

function SubmitBar({
  submitting,
  blockedReason,
  disabled,
  onSubmit,
}: {
  submitting: boolean;
  blockedReason: string | null;
  disabled?: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        {blockedReason ?? 'Each submission is kept as it is; a later one never replaces it.'}
      </p>
      <Button onClick={onSubmit} disabled={submitting || Boolean(blockedReason) || disabled}>
        {submitting ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Send aria-hidden="true" />
        )}
        {submitting ? 'Submitting…' : 'Submit answer'}
      </Button>
    </div>
  );
}

/** Single choice, several choices, or true/false. */
export function ObjectivePanel({
  workspace,
  last,
  submit,
  submitting,
  blockedReason,
}: {
  workspace: LearnerQuestionWorkspace;
  last: SubmissionView | null;
  submit: Submit;
  submitting: boolean;
  blockedReason: string | null;
}) {
  const multi = workspace.question.type === 'mcq_multi';
  const [chosen, setChosen] = useState<string[]>([]);
  const correct = new Set(last?.correctOptionIds ?? []);
  const lastChosen = new Set(last?.optionIds ?? []);

  return (
    <section aria-label="Your answer" className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">
          {multi ? 'Choose every right answer' : 'Choose one answer'}
        </legend>
        {workspace.question.options.map((option) => {
          const selected = chosen.includes(option.id);
          const control = multi ? (
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) =>
                setChosen((current) =>
                  checked ? [...current, option.id] : current.filter((id) => id !== option.id),
                )
              }
              aria-label={option.body}
            />
          ) : (
            <input
              type="radio"
              name={`options-${workspace.placement.id}`}
              checked={selected}
              onChange={() => setChosen([option.id])}
              aria-label={option.body}
              className="size-4 accent-[var(--brand-primary)]"
            />
          );
          return (
            <ChoiceRow
              key={option.id}
              control={control}
              selected={selected}
              correct={correct.has(option.id)}
              className={cn(
                last &&
                  lastChosen.has(option.id) &&
                  !correct.has(option.id) &&
                  correct.size > 0 &&
                  'border-danger/40',
              )}
            >
              {option.body}
            </ChoiceRow>
          );
        })}
      </fieldset>
      <SubmitBar
        submitting={submitting}
        blockedReason={blockedReason}
        disabled={chosen.length === 0}
        onSubmit={async () => {
          const result = await submit({ optionIds: chosen });
          if (result) setChosen([]);
        }}
      />
    </section>
  );
}

function draftStorage(key: string) {
  return {
    read(): string | null {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(value: string | null) {
      try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {
        // No storage: the draft is simply not kept.
      }
    },
  };
}

/** A written answer that a person marks. The draft is kept in this browser until it is sent. */
export function WrittenPanel({
  workspace,
  submit,
  submitting,
  blockedReason,
}: {
  workspace: LearnerQuestionWorkspace;
  submit: Submit;
  submitting: boolean;
  blockedReason: string | null;
}) {
  const storage = draftStorage(`lms-draft:${workspace.placement.id}:text`);
  // The workspace renders only in the browser (after its data loads), so the draft is read at once.
  const [text, setText] = useState(() => storage.read() ?? '');

  return (
    <section aria-label="Your answer" className="space-y-3">
      <Label htmlFor="written-answer">Your answer</Label>
      <Textarea
        id="written-answer"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          storage.write(e.target.value);
        }}
        rows={12}
        className="leading-7"
      />
      <p className="text-right text-xs text-muted-foreground tabular-nums">
        {text.trim().split(/\s+/).filter(Boolean).length} words
      </p>
      <SubmitBar
        submitting={submitting}
        blockedReason={blockedReason}
        disabled={!text.trim()}
        onSubmit={async () => {
          const result = await submit({ text });
          if (result) storage.write(null);
        }}
      />
    </section>
  );
}

/** File upload, practical and project answers: links, files, a checklist and notes. */
export function HandInPanel({
  workspace,
  submit,
  submitting,
  blockedReason,
}: {
  workspace: LearnerQuestionWorkspace;
  submit: Submit;
  submitting: boolean;
  blockedReason: string | null;
}) {
  const spec = workspace.question.spec;
  const [links, setLinks] = useState<string[]>(spec.linkRequired ? [''] : []);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [checklist, setChecklist] = useState<number[]>([]);
  const [notes, setNotes] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const accept = spec.fileKinds.flatMap((kind) => ANSWER_FILE_KIND_MIMES[kind]).join(',');

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const room = spec.maxFiles - files.length;
    const chosen = Array.from(list).slice(0, room);
    setUploading(true);
    try {
      for (const file of chosen) {
        const uploaded = await uploadFile('assignment-submission', file);
        setFiles((current) => [...current, uploaded]);
      }
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'The file could not be uploaded. Try again.');
    } finally {
      setUploading(false);
      if (picker.current) picker.current.value = '';
    }
  };

  const filledLinks = links.map((l) => l.trim()).filter(Boolean);
  const ready =
    (!spec.linkRequired || filledLinks.length > 0) &&
    (spec.maxFiles === 0 || spec.linkRequired || files.length > 0) &&
    checklist.length === spec.checklist.length;

  return (
    <section aria-label="Your answer" className="space-y-5">
      {spec.linkRequired || links.length > 0 ? (
        <div className="space-y-2">
          <Label>
            {spec.linkLabel ? spec.linkLabel.replace(/^\w/, (c) => c.toUpperCase()) : 'Links'}
          </Label>
          {links.map((link, index) => (
            <div key={index} className="flex items-center gap-2">
              <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Input
                type="url"
                inputMode="url"
                placeholder="https://"
                value={link}
                onChange={(e) =>
                  setLinks((current) => current.map((l, i) => (i === index ? e.target.value : l)))
                }
                aria-label={`Link ${index + 1}`}
              />
              {links.length > 1 || !spec.linkRequired ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove link ${index + 1}`}
                  onClick={() => setLinks((current) => current.filter((_, i) => i !== index))}
                >
                  <X aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ))}
          {links.length < 5 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLinks((current) => [...current, ''])}
            >
              <Plus aria-hidden="true" />
              Add a link
            </Button>
          ) : null}
        </div>
      ) : null}

      {spec.maxFiles > 0 ? (
        <div className="space-y-2">
          <Label>Files</Label>
          {files.length > 0 ? (
            <ul className="space-y-1.5">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <FileUp className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{file.originalName}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${file.originalName}`}
                    onClick={() => setFiles((current) => current.filter((f) => f.id !== file.id))}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {files.length < spec.maxFiles ? (
            <>
              <input
                ref={picker}
                type="file"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                id="hand-in-files"
                accept={accept || undefined}
                multiple={spec.maxFiles - files.length > 1}
                onChange={(e) => void upload(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => picker.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <FileUp aria-hidden="true" />
                )}
                {uploading ? 'Uploading…' : 'Attach a file'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Up to {spec.maxFiles} {spec.maxFiles === 1 ? 'file' : 'files'}
                {spec.fileKinds.length > 0 ? ` (${spec.fileKinds.join(', ')})` : ''}, 20 MB each.
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      {spec.checklist.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Before you submit</legend>
          {spec.checklist.map((item, index) => (
            <label key={index} className="flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox
                checked={checklist.includes(index)}
                onCheckedChange={(checked) =>
                  setChecklist((current) =>
                    checked ? [...current, index] : current.filter((i) => i !== index),
                  )
                }
                className="mt-0.5"
              />
              <span>{item}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="hand-in-notes">Notes for your reviewer (optional)</Label>
        <Textarea
          id="hand-in-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />
      </div>

      <SubmitBar
        submitting={submitting || uploading}
        blockedReason={blockedReason}
        disabled={!ready}
        onSubmit={async () => {
          const result = await submit({
            links: filledLinks,
            fileIds: files.map((f) => f.id),
            checklist,
            text: notes,
          });
          if (result) {
            setFiles([]);
            setChecklist([]);
            setNotes('');
          }
        }}
      />
    </section>
  );
}
