'use client';

import { AlignLeft, Minus, Play, Plus, RotateCcw, Send, TerminalSquare } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  LANGUAGE_FILE_NAMES,
  LANGUAGE_LABELS,
  type ExecutionLanguage,
  type RunOutcome,
} from '@lms/shared';
import { CodeEditor, type CodeEditorApi } from '@/components/code-editor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isApiError } from '@/lib/api/errors';
import { useMediaQuery, WIDE_WORKSPACE } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';
import { RunResult } from './result-view';

/** A starting point when the question gives none: how to read input in each language. */
const TEMPLATES: Record<ExecutionLanguage, string> = {
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        \n    }\n}\n',
  python:
    'import sys\n\n\ndef main():\n    data = sys.stdin.read().split()\n    \n\n\nif __name__ == "__main__":\n    main()\n',
  javascript: "const input = require('fs').readFileSync(0, 'utf8').trim();\n\n",
  php: '<?php\n$input = trim(stream_get_contents(STDIN));\n\n',
  sql: '-- Write your query here\nSELECT\n',
};

export interface Sample {
  id: string;
  label: string;
  input: string;
  expectedOutput: string;
}

export interface CodePanelProps {
  /** Distinguishes drafts: one per question (and per language inside it). */
  draftKey: string;
  languages: ExecutionLanguage[];
  starterCode: Record<string, string>;
  samples: Sample[];
  /** Runs code; resolves with the outcome, or throws an ApiError. */
  run: (input: {
    language: ExecutionLanguage;
    code: string;
    customInput: string | null;
    caseIds?: string[];
  }) => Promise<RunOutcome>;
  submit: (input: { language: ExecutionLanguage; code: string }) => Promise<void>;
  submitting: boolean;
  /** Why submitting is not possible now; the button is disabled and this is said beside it. */
  blockedReason: string | null;
  /** What the Result tab shows about submissions (the parent owns them). */
  submissionResult: React.ReactNode;
  /** Bumped by the parent when a submission arrives, so the console shows it. */
  submissionTick: number;
  /** Code to load instead of the draft (a past submission being reopened). */
  loadCode?: { language: ExecutionLanguage; code: string; tick: number } | null;
  /**
   * The learner's latest submitted code. It fills the editor when this browser holds no draft
   * (another device, cleared storage), so a solved question never reopens on an empty template.
   */
  savedCode?: { language: ExecutionLanguage; code: string } | null;
  className?: string;
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // A private window or blocked storage just means the draft is not kept.
  }
}

type ConsoleTab = 'cases' | 'custom' | 'result';

/**
 * The code side of a workspace: the editor with its file tab and tools, Run and Submit, and the
 * console (visible cases to run, the learner's own input, and results). On wide screens the
 * console sits under the editor; on narrow ones it opens as a sheet from the bottom.
 */
export function CodePanel(props: CodePanelProps) {
  const { draftKey, languages, starterCode, samples, className } = props;
  const saved =
    props.savedCode && props.savedCode.code && languages.includes(props.savedCode.language)
      ? props.savedCode
      : null;
  /** The question's starting code: what Reset goes back to. */
  const template = (lang: ExecutionLanguage) => starterCode[lang] || TEMPLATES[lang];
  /** Where the editor starts when this browser has no draft: the last submission, else the template. */
  const starter = (lang: ExecutionLanguage) =>
    saved?.language === lang ? saved.code : template(lang);
  /*
   * The panel renders only in the browser, once its question has loaded, so the remembered
   * language, draft and text size are read straight away. The parent keys it by question.
   */
  const [initial] = useState(() => {
    const remembered = readStored(`lms-lang:${draftKey}`) as ExecutionLanguage | null;
    const lang =
      remembered && languages.includes(remembered)
        ? remembered
        : (saved?.language ?? languages[0] ?? 'java');
    const size = Number(readStored('lms-editor-font'));
    return {
      language: lang,
      code: readStored(`lms-draft:${draftKey}:${lang}`) ?? starter(lang),
      fontSize: size >= 11 && size <= 20 ? size : 13,
    };
  });
  const [language, setLanguage] = useState<ExecutionLanguage>(initial.language);
  const [code, setCode] = useState(initial.code);
  const [fontSize, setFontSize] = useState(initial.fontSize);
  const [tab, setTab] = useState<ConsoleTab>(samples.length > 0 ? 'cases' : 'custom');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(samples.map((s) => s.id));
  const [customInput, setCustomInput] = useState(samples[0]?.input ?? '');
  const [runResult, setRunResult] = useState<RunOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const editor = useRef<CodeEditorApi | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const wide = useMediaQuery(WIDE_WORKSPACE);
  // On wide screens the console is always on show; the sheet is only for narrow ones.
  const showConsole = () => {
    if (!wide) setSheetOpen(true);
  };

  // Reopening a past submission puts its code back in the editor (adjusted while rendering).
  const [loadedTick, setLoadedTick] = useState(props.loadCode?.tick ?? null);
  if (props.loadCode && props.loadCode.tick !== loadedTick) {
    setLoadedTick(props.loadCode.tick);
    setLanguage(props.loadCode.language);
    setCode(props.loadCode.code);
  }

  // A new submission brings the console to its result.
  const [seenTick, setSeenTick] = useState(props.submissionTick);
  if (props.submissionTick !== seenTick) {
    setSeenTick(props.submissionTick);
    if (props.submissionTick > 0) {
      setTab('result');
      if (!wide) setSheetOpen(true);
    }
  }

  const changeCode = (next: string) => {
    setCode(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(
      () => writeStored(`lms-draft:${draftKey}:${language}`, next),
      400,
    );
  };

  const changeLanguage = (next: ExecutionLanguage) => {
    writeStored(`lms-draft:${draftKey}:${language}`, code);
    writeStored(`lms-lang:${draftKey}`, next);
    setLanguage(next);
    setCode(readStored(`lms-draft:${draftKey}:${next}`) ?? starter(next));
    setRunResult(null);
  };

  const changeFont = (delta: number) => {
    const next = Math.max(11, Math.min(20, fontSize + delta));
    setFontSize(next);
    writeStored('lms-editor-font', String(next));
  };

  const reset = () => {
    editor.current?.setValue(template(language));
    toast.message('Back to the starting code. Ctrl+Z brings yours back.');
  };

  const doRun = async (mode: 'cases' | 'custom') => {
    if (running) return;
    if (!code.trim()) {
      toast.error('Write some code first');
      return;
    }
    setRunning(true);
    setTab('result');
    showConsole();
    try {
      const outcome = await props.run({
        language,
        code,
        customInput: mode === 'custom' ? customInput : null,
        caseIds: mode === 'cases' && selected.length < samples.length ? selected : undefined,
      });
      setRunResult(outcome);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'The code could not be run. Try again.');
    } finally {
      setRunning(false);
    }
  };

  const doSubmit = async () => {
    if (props.submitting || props.blockedReason) return;
    if (!code.trim()) {
      toast.error('Write some code first');
      return;
    }
    await props.submit({ language, code });
  };

  const consoleBody = (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as ConsoleTab)}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3">
        <TabsList aria-label="Console" className="h-10">
          {samples.length > 0 ? <TabsTrigger value="cases">Test cases</TabsTrigger> : null}
          <TabsTrigger value="custom">Your own input</TabsTrigger>
          <TabsTrigger value="result">Result</TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {samples.length > 0 ? (
          <TabsContent value="cases" className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Choose the visible cases to run. Hidden cases run only when you submit.
            </p>
            <ul className="space-y-1.5">
              {samples.map((sample, index) => (
                <li key={sample.id}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2/60">
                    <Checkbox
                      checked={selected.includes(sample.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) =>
                          checked
                            ? [...current, sample.id]
                            : current.filter((id) => id !== sample.id),
                        )
                      }
                      aria-label={`Run ${sample.label || `case ${index + 1}`}`}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {sample.label || `Case ${index + 1}`}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {sample.input.replace(/\n/g, ' ⏎ ') || '(no input)'}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="outline"
              onClick={() => doRun('cases')}
              disabled={running || selected.length === 0}
            >
              <Play aria-hidden="true" />
              Run{' '}
              {selected.length === samples.length ? 'the examples' : `${selected.length} selected`}
            </Button>
          </TabsContent>
        ) : null}
        <TabsContent value="custom" className="space-y-2">
          <label
            className="block text-xs font-medium text-muted-foreground"
            htmlFor={`${draftKey}-custom`}
          >
            {language === 'sql'
              ? 'Statements to run before your query (extra rows)'
              : 'Custom input'}
          </label>
          <Textarea
            id={`${draftKey}-custom`}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            rows={4}
            spellCheck={false}
            className="font-mono text-[13px]"
          />
          <Button size="sm" variant="outline" onClick={() => doRun('custom')} disabled={running}>
            <Play aria-hidden="true" />
            Run my own input
          </Button>
        </TabsContent>
        <TabsContent value="result" className="space-y-4">
          {running ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Running your code in the sandbox…
            </p>
          ) : runResult ? (
            <RunResult run={runResult} sql={language === 'sql'} />
          ) : null}
          {props.submissionResult}
          {!running && !runResult && !props.submissionResult ? (
            <p className="text-sm text-muted-foreground">
              Run your code to see what it prints, or submit it to be marked.
            </p>
          ) : null}
        </TabsContent>
      </div>
    </Tabs>
  );

  const actions = (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            onClick={() => doRun(tab === 'custom' ? 'custom' : 'cases')}
            disabled={running}
          >
            <Play aria-hidden="true" />
            {running ? 'Running…' : 'Run'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ctrl + Enter</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button onClick={doSubmit} disabled={props.submitting || Boolean(props.blockedReason)}>
            <Send aria-hidden="true" />
            {props.submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{props.blockedReason ?? 'Ctrl + Shift + Enter'}</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      {/* Toolbar: the file, the language and the editor's own tools. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <span className="inline-flex h-8 items-center rounded-md border border-border bg-surface-2 px-2.5 font-mono text-xs text-foreground">
          {LANGUAGE_FILE_NAMES[language]}
        </span>
        {languages.length > 1 ? (
          <NativeSelect
            value={language}
            onChange={(e) => changeLanguage(e.target.value as ExecutionLanguage)}
            aria-label="Language"
            className="h-8 w-auto text-xs"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <span className="text-xs text-muted-foreground">{LANGUAGE_LABELS[language]}</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => changeFont(-1)}
                aria-label="Smaller text"
              >
                <Minus aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Smaller text</TooltipContent>
          </Tooltip>
          <span
            className="w-8 text-center text-xs text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {fontSize}px
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => changeFont(1)}
                aria-label="Larger text"
              >
                <Plus aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Larger text</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => editor.current?.format()}
                aria-label="Format: re-indent the code"
              >
                <AlignLeft aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Format (re-indent)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={reset}
                aria-label="Reset to the starting code"
              >
                <RotateCcw aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset to the starting code</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <CodeEditor
        value={code}
        onChange={changeCode}
        language={language}
        label="Your solution"
        fontSize={fontSize}
        onRun={() => void doRun('cases')}
        onSubmit={() => void doSubmit()}
        onReady={(api) => (editor.current = api)}
        className={wide ? 'min-h-[280px] flex-1' : 'h-[55dvh] min-h-[280px]'}
      />

      {/* Wide screens: the console under the editor, with the actions on its bar. Rendered in one
          place at a time, so its fields never exist twice on the page. */}
      {wide ? (
        <div className="flex h-[38%] min-h-[220px] flex-col border-t border-border bg-card">
          <div className="flex items-center justify-end gap-3 border-b border-border px-3 py-2">
            {props.blockedReason ? (
              <span className="mr-auto text-xs text-muted-foreground">{props.blockedReason}</span>
            ) : null}
            {actions}
          </div>
          {consoleBody}
        </div>
      ) : (
        /* Narrow screens: a sticky action bar, and the console as a bottom sheet. */
        <div className="sticky bottom-0 z-20 flex items-center justify-between gap-2 border-t border-border bg-card/95 px-3 py-2.5 backdrop-blur">
          <Button variant="ghost" size="sm" onClick={() => setSheetOpen(true)}>
            <TerminalSquare aria-hidden="true" />
            Console
          </Button>
          {actions}
        </div>
      )}
      <Sheet open={sheetOpen && !wide} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="flex max-h-[80dvh] flex-col gap-0 p-0 xl:hidden">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle>Console</SheetTitle>
            <SheetDescription>Test cases, your own input and results.</SheetDescription>
          </SheetHeader>
          {consoleBody}
        </SheetContent>
      </Sheet>
    </div>
  );
}
