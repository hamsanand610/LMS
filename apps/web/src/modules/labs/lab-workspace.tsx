'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CircleCheck, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  ExecutionLanguage,
  PracticeProblemDetail,
  PracticeSubmissionDetail,
  PracticeSubmissionRecord,
  PracticeSubmitOutcome,
  RunOutcome,
} from '@lms/shared';
import { LoadingRows } from '@/components/page-states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { plural } from '@/lib/format';
import { useMediaQuery, WIDE_WORKSPACE } from '@/lib/use-media-query';
import { LabHint, isFailedVerdict } from '@/modules/ai/lab-hint';
import { VerdictBadge } from '@/modules/assignments/status';
import { CodePanel } from '@/modules/workspace/code-panel';
import { CaseRow, CompileOutput, Figures, WebCheckResults } from '@/modules/workspace/result-view';
import { SplitPanes } from '@/modules/workspace/split';
import { LabHistory } from './lab-history';
import { LabStatement } from './lab-statement';
import { LabTypeBadge } from './lab-types';
import { draftLabel, useLabDrafts } from './use-lab-drafts';
import { WebLabPanel } from './web-lab-panel';

export type LabSubmitOutcome = PracticeSubmitOutcome & { lessonCompleted?: boolean };

/** Where a lab's workspace reads and sends: the catalogue, a course lesson, or a staff preview. */
export interface LabSource {
  detail: PracticeProblemDetail;
  eyebrow: string;
  back: { href: string; label: string };
  run: (input: {
    language: ExecutionLanguage;
    code: string;
    customInput: string | null;
    caseIds?: string[];
  }) => Promise<RunOutcome>;
  /** Absent in a preview, where nothing is recorded. */
  submit?: (input: { language: ExecutionLanguage; code: string }) => Promise<LabSubmitOutcome>;
  history?: {
    key: unknown[];
    list: () => Promise<PracticeSubmissionRecord[]>;
    detail: (id: string) => Promise<PracticeSubmissionDetail>;
  };
  /** Whether work in progress is kept on the server (not in a preview). */
  drafts: boolean;
  /** Said above the workspace: a preview, or the course the lab belongs to. */
  banner?: React.ReactNode;
  onSubmitted?: (outcome: LabSubmitOutcome) => Promise<void> | void;
}

interface DriverInfo {
  available: boolean;
}

/**
 * One lab: the statement beside the editor (or a web lab's files and preview), runs on the
 * visible cases, submissions against every case. Everything that decides anything runs in the
 * sandbox; nothing a browser says is counted (ADR-0016).
 */
export function LabWorkspace({ source }: { source: LabSource }) {
  const drafts = useLabDrafts(source.detail.questionId, source.drafts);
  if (!drafts.ready) return <LoadingRows rows={6} />;
  return <Workspace source={source} drafts={drafts} />;
}

function Workspace({
  source,
  drafts,
}: {
  source: LabSource;
  drafts: ReturnType<typeof useLabDrafts>;
}) {
  const detail = source.detail;
  const [last, setLast] = useState<LabSubmitOutcome | null>(null);
  const [tick, setTick] = useState(0);
  const [reopened, setReopened] = useState<{
    language: ExecutionLanguage;
    code: string;
    tick: number;
  } | null>(null);
  const wide = useMediaQuery(WIDE_WORKSPACE);
  const driver = useQuery({
    queryKey: ['practice', 'driver'],
    queryFn: () => api<DriverInfo>('/practice/driver'),
    enabled: Boolean(source.submit),
  });
  // The submissions list the history shows (one request for both): an AI Hint follows a failed one.
  const submissions = useQuery({
    queryKey: source.history?.key ?? ['lab', 'no-history'],
    queryFn: source.history?.list ?? (async () => []),
    enabled: Boolean(source.history),
  });
  const failedAttempt =
    (last !== null && isFailedVerdict(last.submission.verdict)) ||
    (submissions.data ?? []).some((record) => isFailedVerdict(record.verdict));

  const submit = useMutation({
    mutationFn: (input: { language: ExecutionLanguage; code: string }) => source.submit!(input),
    onSuccess: async (outcome) => {
      setLast(outcome);
      setTick((n) => n + 1);
      if (outcome.newlySolved) toast.success(`Solved. ${plural(detail.points, 'point')} added.`);
      await source.onSubmitted?.(outcome);
    },
    onError: (error) =>
      toast.error(
        isApiError(error) ? error.message : 'Your work could not be submitted. Try again.',
      ),
  });
  const doSubmit = source.submit
    ? async (input: { language: ExecutionLanguage; code: string }) => {
        try {
          await submit.mutateAsync(input);
        } catch {
          // Reported by the mutation.
        }
      }
    : undefined;
  const blockedReason =
    driver.data && !driver.data.available
      ? 'Code cannot be run right now. Try again shortly.'
      : null;
  const web = detail.type === 'web';

  const result = last ? (
    <SubmitResult outcome={last} web={web} sql={detail.type === 'sql'} />
  ) : null;
  const statement = <LabStatement problem={detail} eyebrow={source.eyebrow} />;
  const history = source.history ? (
    <LabHistory
      queryKey={source.history.key}
      list={source.history.list}
      detail={source.history.detail}
      onReopen={(submission) => {
        setReopened({ language: submission.language, code: submission.code, tick: Date.now() });
        toast.message('Your earlier submission is in the editor.');
      }}
    />
  ) : null;
  const panelClass = 'h-full rounded-xl border border-border bg-card shadow-xs xl:overflow-hidden';
  const workPanel = web ? (
    <WebLabPanel
      problem={detail}
      run={source.run}
      submit={doSubmit}
      submitting={submit.isPending}
      blockedReason={blockedReason}
      submissionTick={tick}
      submissionResult={result}
      loadCode={reopened ? { code: reopened.code, tick: reopened.tick } : null}
      drafts={source.drafts ? drafts : undefined}
      className={panelClass}
    />
  ) : (
    <CodePanel
      draftKey={`lab:${detail.questionId}`}
      languages={detail.languages}
      starterCode={detail.starterCode}
      samples={detail.samples}
      run={source.run}
      submit={doSubmit ?? (async () => undefined)}
      submitting={submit.isPending}
      blockedReason={
        doSubmit ? blockedReason : 'A preview runs the lab; submissions are not recorded.'
      }
      submissionTick={tick}
      submissionResult={result}
      loadCode={reopened}
      drafts={
        source.drafts
          ? {
              initial: drafts.initial,
              change: drafts.change,
              clear: drafts.clear,
              status: draftLabel(drafts.state),
            }
          : undefined
      }
      className={panelClass}
    />
  );

  const header = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link
        href={source.back.href}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {source.back.label}
      </Link>
      <LabTypeBadge type={detail.type} />
      <span className="ml-auto inline-flex items-center gap-3 text-xs text-muted-foreground">
        {source.submit ? (
          <LabHint questionId={detail.questionId} failedAttempt={failedAttempt} />
        ) : null}
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Star className="size-3.5" aria-hidden="true" />
          {plural(detail.points, 'point')}
        </span>
        {detail.status === 'solved' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">
            <CircleCheck className="size-3.5" aria-hidden="true" />
            Solved
          </span>
        ) : null}
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      {header}
      {source.banner}
      {wide ? (
        <SplitPanes
          storageKey="lms-workspace-split"
          left={
            <div className="h-full rounded-xl border border-border bg-card px-5 pb-5 shadow-xs">
              <Tabs defaultValue="lab" className="flex h-full min-h-0 flex-col gap-0">
                <TabsList aria-label="About the lab" className="h-11 px-1">
                  <TabsTrigger value="lab">Lab</TabsTrigger>
                  {history ? <TabsTrigger value="submissions">Submissions</TabsTrigger> : null}
                </TabsList>
                <TabsContent value="lab" className="min-h-0 flex-1 overflow-y-auto pt-5 pr-1">
                  {statement}
                </TabsContent>
                {history ? (
                  <TabsContent
                    value="submissions"
                    className="min-h-0 flex-1 overflow-y-auto pt-5 pr-1"
                  >
                    {history}
                  </TabsContent>
                ) : null}
              </Tabs>
            </div>
          }
          right={workPanel}
          className="h-[calc(100dvh-9.5rem)] min-h-[620px]"
        />
      ) : (
        <Tabs defaultValue="lab" className="gap-4">
          <TabsList variant="segmented" aria-label="Workspace" className="w-full">
            <TabsTrigger value="lab" className="flex-1">
              Lab
            </TabsTrigger>
            <TabsTrigger value="work" className="flex-1">
              {web ? 'Page' : 'Code'}
            </TabsTrigger>
            {history ? (
              <TabsTrigger value="submissions" className="flex-1">
                Submissions
              </TabsTrigger>
            ) : null}
          </TabsList>
          <TabsContent
            value="lab"
            className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            {statement}
          </TabsContent>
          <TabsContent value="work" forceMount className="data-[state=inactive]:hidden">
            {workPanel}
          </TabsContent>
          {history ? <TabsContent value="submissions">{history}</TabsContent> : null}
        </Tabs>
      )}
    </div>
  );
}

/** What a submission came back with: the verdict and every case, hidden ones as verdicts only. */
function SubmitResult({
  outcome,
  web,
  sql,
}: {
  outcome: LabSubmitOutcome;
  web: boolean;
  sql: boolean;
}) {
  const { submission } = outcome;
  const accepted = submission.verdict === 'passed';
  const banner = (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm font-semibold">{accepted ? 'Accepted' : 'Not accepted yet'}</p>
      <VerdictBadge verdict={submission.verdict} />
      {outcome.newlySolved ? (
        <span className="text-xs font-medium text-success">First solve</span>
      ) : null}
      {outcome.lessonCompleted ? (
        <span className="text-xs font-medium text-success">Lesson complete</span>
      ) : null}
    </div>
  );
  if (web) {
    return (
      <div className="space-y-3">
        {banner}
        <WebCheckResults cases={outcome.cases} verdict={submission.verdict} />
      </div>
    );
  }
  return (
    <div className="space-y-3" aria-live="polite">
      {banner}
      <Figures
        passed={submission.passed}
        total={submission.total}
        durationMs={submission.durationMs}
        memoryKb={null}
      />
      <CompileOutput text={outcome.compileOutput} />
      <ul className="space-y-2">
        {outcome.cases.map((c) => (
          <CaseRow key={c.testCaseId ?? c.number} outcome={c} sql={sql} />
        ))}
      </ul>
    </div>
  );
}
