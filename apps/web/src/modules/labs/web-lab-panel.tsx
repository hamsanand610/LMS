'use client';

import { Eye, Lock, Play, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  EMPTY_WEB_FILES,
  WEB_LAB_LIMITS,
  decodeWebFiles,
  encodeWebFiles,
  type ExecutionLanguage,
  type PracticeProblemDetail,
  type RunOutcome,
  type WebFiles,
} from '@lms/shared';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isApiError } from '@/lib/api/errors';
import { buildPreviewDocument } from '@/lib/labs/web-preview';
import { useMediaQuery, WIDE_WORKSPACE } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';
import { WebCheckResults } from '@/modules/workspace/result-view';
import { InlineText } from '@/modules/workspace/statement';
import { draftLabel, type LabDrafts } from './use-lab-drafts';
import { PreviewConsole, useConsoleLines, WebPreviewFrame } from './web-preview-frame';
import { WebFilesEditor } from './web-files-editor';

type PanelTab = 'preview' | 'checks' | 'result';

/** What the panel reads of a web exercise, whether a lab or an assignment question. */
export type WebProblem = Pick<PracticeProblemDetail, 'starterFiles' | 'checks' | 'hiddenTestCount'>;

export interface WebLabPanelProps {
  problem: WebProblem;
  run: (input: {
    language: ExecutionLanguage;
    code: string;
    customInput: null;
    caseIds?: string[];
  }) => Promise<RunOutcome>;
  /** Absent in a preview: staff try the lab, nothing is recorded. */
  submit?: (input: { language: ExecutionLanguage; code: string }) => Promise<void>;
  submitting: boolean;
  blockedReason: string | null;
  submissionResult: React.ReactNode;
  submissionTick: number;
  /** A past submission reopened in the editors. */
  loadCode?: { code: string; tick: number } | null;
  drafts?: LabDrafts;
  className?: string;
}

const tooLong = (files: WebFiles) =>
  Object.values(files).some((text) => text.length > WEB_LAB_LIMITS.fileChars);

/**
 * A Web Lab's workspace (ADR-0019): the page's three files, a preview of the page in a sandboxed
 * frame (shown, never judged), and the checks, which run in the sandbox. Preview is instant and
 * stays in this browser; Run checks and Submit go to the sandbox.
 */
export function WebLabPanel(props: WebLabPanelProps) {
  const { problem, drafts } = props;
  const starter = problem.starterFiles ?? EMPTY_WEB_FILES;
  const [files, setFiles] = useState<WebFiles>(
    () => decodeWebFiles(drafts?.initial['web'] ?? '') ?? starter,
  );
  const [tab, setTab] = useState<PanelTab>('preview');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunOutcome | null>(null);
  const output = useConsoleLines();
  const wide = useMediaQuery(WIDE_WORKSPACE);

  // A reopened submission replaces the files (adjusted while rendering).
  const [loadedTick, setLoadedTick] = useState(props.loadCode?.tick ?? null);
  if (props.loadCode && props.loadCode.tick !== loadedTick) {
    setLoadedTick(props.loadCode.tick);
    setFiles(decodeWebFiles(props.loadCode.code) ?? starter);
  }
  // A new submission brings its result into view.
  const [seenTick, setSeenTick] = useState(props.submissionTick);
  if (props.submissionTick !== seenTick) {
    setSeenTick(props.submissionTick);
    if (props.submissionTick > 0) setTab('result');
  }

  const change = (next: WebFiles) => {
    setFiles(next);
    if (!drafts) return;
    const bundle = encodeWebFiles(next);
    if (bundle === encodeWebFiles(starter)) drafts.clear('web');
    else drafts.change('web', bundle);
  };

  const preview = () => {
    output.clear();
    setPreviewDoc(buildPreviewDocument(files));
    setRunKey((n) => n + 1);
    setTab('preview');
  };

  const runChecks = async () => {
    if (running) return;
    if (tooLong(files)) {
      toast.error(
        `Each file can hold up to ${WEB_LAB_LIMITS.fileChars.toLocaleString()} characters`,
      );
      return;
    }
    setRunning(true);
    setTab('checks');
    try {
      setRunResult(
        await props.run({ language: 'web', code: encodeWebFiles(files), customInput: null }),
      );
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'The checks could not be run. Try again.');
    } finally {
      setRunning(false);
    }
  };

  const submit = async () => {
    if (!props.submit || props.submitting || props.blockedReason) return;
    if (tooLong(files)) {
      toast.error(
        `Each file can hold up to ${WEB_LAB_LIMITS.fileChars.toLocaleString()} characters`,
      );
      return;
    }
    await props.submit({ language: 'web', code: encodeWebFiles(files) });
  };

  const reset = () => {
    change(starter);
    toast.message('Back to the starting files.');
  };

  const status = drafts ? draftLabel(drafts.state) : null;
  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" onClick={preview}>
            <Eye aria-hidden="true" />
            Preview
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ctrl + Enter. Shows your page here; nothing is checked.</TooltipContent>
      </Tooltip>
      <Button type="button" variant="outline" onClick={() => void runChecks()} disabled={running}>
        <Play aria-hidden="true" />
        {running ? 'Checking…' : 'Run checks'}
      </Button>
      {props.submit ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={props.submitting || Boolean(props.blockedReason)}
            >
              <Send aria-hidden="true" />
              {props.submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{props.blockedReason ?? 'Ctrl + Shift + Enter'}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );

  return (
    <div className={cn('flex min-h-0 flex-col', props.className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Your page</span>
        {status ? (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {status}
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={reset}
          aria-label="Reset to the starting files"
        >
          <RotateCcw aria-hidden="true" />
          Reset
        </Button>
      </div>
      <WebFilesEditor
        label="Your page"
        files={files}
        onChange={change}
        onRun={preview}
        onSubmit={() => void submit()}
        className={wide ? 'min-h-[260px] flex-1' : 'h-[50dvh] min-h-[260px]'}
      />
      <div
        className={cn(
          'flex flex-col border-t border-border bg-card',
          wide ? 'h-[45%] min-h-[240px]' : 'min-h-[320px]',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          {props.blockedReason ? (
            <span className="text-xs text-muted-foreground">{props.blockedReason}</span>
          ) : (
            <span />
          )}
          {actions}
        </div>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as PanelTab)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <TabsList aria-label="Your page’s output" className="h-10 px-3">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="checks">Checks</TabsTrigger>
            <TabsTrigger value="result">Result</TabsTrigger>
          </TabsList>
          <TabsContent
            value="preview"
            forceMount
            className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] data-[state=inactive]:hidden"
          >
            <WebPreviewFrame document={previewDoc} runKey={runKey} onConsole={output.add} />
            <div className="max-h-32 overflow-y-auto border-t border-border">
              <PreviewConsole lines={output.lines} />
            </div>
          </TabsContent>
          <TabsContent value="checks" className="min-h-0 flex-1 overflow-y-auto p-3">
            {running ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Checking your page in the sandbox…
              </p>
            ) : runResult ? (
              <WebCheckResults
                cases={runResult.cases}
                verdict={runResult.verdict}
                note="Run checks tries the visible checks only and is not recorded. Submit to be checked against every one."
              />
            ) : (
              <VisibleChecks problem={problem} />
            )}
          </TabsContent>
          <TabsContent value="result" className="min-h-0 flex-1 overflow-y-auto p-3">
            {props.submissionResult ?? (
              <p className="text-sm text-muted-foreground">
                Submit your page to be checked against every check, the hidden ones too.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/** The checks a learner can read before running anything. */
function VisibleChecks({ problem }: { problem: WebProblem }) {
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {problem.checks.map((check) => (
          <li key={check.id} className="rounded-md border border-border px-3 py-2 text-sm">
            <span className="block font-medium">{check.label}</span>
            <span className="block text-xs text-muted-foreground">
              <InlineText text={check.description} />
            </span>
          </li>
        ))}
      </ul>
      {problem.hiddenTestCount > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          {problem.hiddenTestCount} more {problem.hiddenTestCount === 1 ? 'check is' : 'checks are'}{' '}
          hidden; a submission is checked against them too.
        </p>
      ) : null}
    </div>
  );
}
