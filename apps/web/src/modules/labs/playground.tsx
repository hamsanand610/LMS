'use client';

import { useMutation } from '@tanstack/react-query';
import { Play, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  LANGUAGE_FILE_NAMES,
  LANGUAGE_LABELS,
  PLAYGROUND_LANGUAGES,
  PLAYGROUND_LIMITS,
  VERDICT_LABELS,
  type PlaygroundLanguage,
  type PlaygroundRunOutcome,
} from '@lms/shared';
import { CodeEditor, type CodeEditorApi } from '@/components/code-editor';
import { LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { useMediaQuery, WIDE_WORKSPACE } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';
import { VerdictBadge } from '@/modules/assignments/status';
import { CompileOutput, formatDuration, formatMemory } from '@/modules/workspace/result-view';
import { ResultTable } from '@/modules/workspace/result-table';
import { draftLabel, useLabDrafts } from './use-lab-drafts';

/** Where each language starts: a program that reads its input, or a table to query. */
const TEMPLATES: Record<PlaygroundLanguage, string> = {
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        String name = in.hasNextLine() ? in.nextLine() : "world";\n        System.out.println("Hello, " + name + "!");\n    }\n}\n',
  python: 'import sys\n\nname = sys.stdin.read().strip() or "world"\nprint(f"Hello, {name}!")\n',
  javascript:
    "const input = require('fs').readFileSync(0, 'utf8').trim();\nconsole.log(`Hello, ${input || 'world'}!`);\n",
  php: '<?php\n$name = trim(stream_get_contents(STDIN)) ?: "world";\necho "Hello, $name!", PHP_EOL;\n',
  sql: "CREATE TABLE learner (id INTEGER PRIMARY KEY, name TEXT, score INTEGER);\nINSERT INTO learner VALUES (1, 'Asha', 72), (2, 'Bala', 64), (3, 'Chitra', 88);\n\nSELECT name, score FROM learner WHERE score >= 70 ORDER BY score DESC;\n",
};

const LANGUAGE_KEY = 'lms-playground-language';

/**
 * The playground (ADR-0021): any code language the sandbox runs, or SQL, on the learner's own
 * input. It runs in the sandbox like everything else, within fixed limits, and is not marked. What
 * is written is kept as a draft, one per language, on the server.
 */
export function Playground() {
  const drafts = useLabDrafts('playground');
  if (!drafts.ready) return <LoadingRows rows={6} />;
  return <PlaygroundBody drafts={drafts} />;
}

function PlaygroundBody({ drafts }: { drafts: ReturnType<typeof useLabDrafts> }) {
  const [language, setLanguage] = useState<PlaygroundLanguage>(() => {
    try {
      const remembered = window.localStorage.getItem(LANGUAGE_KEY) as PlaygroundLanguage | null;
      if (remembered && PLAYGROUND_LANGUAGES.includes(remembered)) return remembered;
    } catch {
      // Storage unavailable: start with Python.
    }
    return 'python';
  });
  const codes = useRef(new Map<PlaygroundLanguage, string>());
  const codeOf = (lang: PlaygroundLanguage) =>
    codes.current.get(lang) ?? drafts.initial[lang] ?? TEMPLATES[lang];
  const [code, setCode] = useState(() => drafts.initial[language] ?? TEMPLATES[language]);
  const [stdin, setStdin] = useState('');
  const editor = useRef<CodeEditorApi | null>(null);
  const wide = useMediaQuery(WIDE_WORKSPACE);
  const sql = language === 'sql';

  const run = useMutation({
    mutationFn: () =>
      api<PlaygroundRunOutcome>('/practice/playground/run', {
        body: { language, code, stdin: sql ? '' : stdin },
      }),
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The code could not be run. Try again.'),
  });

  const changeCode = (next: string) => {
    setCode(next);
    codes.current.set(language, next);
    if (next === TEMPLATES[language]) drafts.clear(language);
    else drafts.change(language, next);
  };

  const changeLanguage = (next: PlaygroundLanguage) => {
    codes.current.set(language, code);
    try {
      window.localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // Not remembered, then.
    }
    setLanguage(next);
    setCode(codeOf(next));
    run.reset();
  };

  const doRun = () => {
    if (run.isPending) return;
    if (!code.trim()) {
      toast.error('Write some code first');
      return;
    }
    run.mutate();
  };

  const status = draftLabel(drafts.state);
  return (
    <div className={cn('grid gap-4', wide && 'grid-cols-[minmax(0,1fr)_24rem]')}>
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <span className="inline-flex h-8 items-center rounded-md border border-border bg-surface-2 px-2.5 font-mono text-xs">
            {LANGUAGE_FILE_NAMES[language]}
          </span>
          <NativeSelect
            value={language}
            onChange={(e) => changeLanguage(e.target.value as PlaygroundLanguage)}
            aria-label="Language"
            className="h-8 w-auto text-xs"
          >
            {PLAYGROUND_LANGUAGES.map((value) => (
              <option key={value} value={value}>
                {LANGUAGE_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
          {status ? (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {status}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                editor.current?.setValue(TEMPLATES[language]);
                toast.message('Back to the example. Ctrl+Z brings yours back.');
              }}
            >
              <RotateCcw aria-hidden="true" />
              Reset
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" onClick={doRun} disabled={run.isPending}>
                  <Play aria-hidden="true" />
                  {run.isPending ? 'Running…' : 'Run'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ctrl + Enter</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <CodeEditor
          value={code}
          onChange={changeCode}
          language={language}
          label="Your code"
          onRun={doRun}
          onReady={(api) => (editor.current = api)}
          className={wide ? 'h-[calc(100dvh-14rem)] min-h-[420px]' : 'h-[50dvh] min-h-[300px]'}
        />
      </div>

      <div className="space-y-4">
        <section className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          {sql ? (
            <p className="text-sm text-muted-foreground">
              SQL runs against an empty SQLite database of its own: create the tables you want to
              query, then query them. The last result is shown. Nothing is kept between runs.
            </p>
          ) : (
            <>
              <Label htmlFor="playground-input">Input</Label>
              <Textarea
                id="playground-input"
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                rows={5}
                maxLength={PLAYGROUND_LIMITS.stdinChars}
                spellCheck={false}
                className="font-mono text-[13px]"
                placeholder="What your program reads from standard input"
              />
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Limits: {PLAYGROUND_LIMITS.timeMs / 1000} s of processor time and{' '}
            {PLAYGROUND_LIMITS.memoryMb} MB, no network, no files kept. One run at a time.
          </p>
        </section>
        <section
          aria-labelledby="playground-output"
          className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-xs"
        >
          <h2 id="playground-output" className="text-sm font-semibold">
            Output
          </h2>
          {run.isPending ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Running in the sandbox…
            </p>
          ) : run.data ? (
            <PlaygroundResult outcome={run.data} sql={sql} />
          ) : (
            <p className="text-sm text-muted-foreground">Run your code to see what it prints.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function PlaygroundResult({ outcome, sql }: { outcome: PlaygroundRunOutcome; sql: boolean }) {
  const { output } = outcome;
  const ended =
    outcome.verdict === 'timeout'
      ? `It ran out of time: ${outcome.limits.timeMs / 1000} s of processor time.`
      : outcome.verdict === 'memory_limit'
        ? `It ran out of memory: ${outcome.limits.memoryMb} MB.`
        : null;
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold">
          {outcome.verdict === 'passed' ? 'It ran' : VERDICT_LABELS[outcome.verdict]}
        </p>
        {/* Nothing is checked here: only a run that went wrong carries a verdict. */}
        {outcome.verdict === 'passed' ? null : <VerdictBadge verdict={outcome.verdict} />}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {formatDuration(outcome.durationMs)} · {formatMemory(outcome.memoryKb)}
        </span>
      </div>
      {ended ? <p className="text-sm text-danger">{ended}</p> : null}
      <CompileOutput text={outcome.compileOutput} />
      {sql && output.stdout.trim().startsWith('{') ? (
        <ResultTable json={output.stdout} />
      ) : (
        <Stream label="Printed" text={output.stdout} cut={output.stdoutTruncated} />
      )}
      {output.stderr ? (
        <Stream label="Errors" text={output.stderr} cut={output.stderrTruncated} />
      ) : null}
    </div>
  );
}

function Stream({ label, text, cut }: { label: string; text: string; cut?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <pre className="max-h-72 overflow-auto rounded-md border border-border bg-surface-2/70 px-3 py-2 font-mono text-[12.5px] leading-5 whitespace-pre">
        {text === '' ? <span className="text-muted-foreground">(nothing)</span> : text}
      </pre>
      {cut ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Only the beginning is shown; the rest was cut off.
        </p>
      ) : null}
    </div>
  );
}
