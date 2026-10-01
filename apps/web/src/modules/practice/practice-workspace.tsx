'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleCheck, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  DIFFICULTY_LABELS,
  LANGUAGE_LABELS,
  VERDICT_LABELS,
  type ExecutionLanguage,
  type PracticeProblemDetail,
  type PracticeSubmissionRecord,
  type PracticeSubmitOutcome,
  type RunOutcome,
} from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { formatDateTime, humanise, plural } from '@/lib/format';
import { useMediaQuery, WIDE_WORKSPACE } from '@/lib/use-media-query';
import { VerdictBadge } from '@/modules/assignments/status';
import { CodePanel } from '@/modules/workspace/code-panel';
import { CaseRow, CompileOutput, Figures, formatDuration } from '@/modules/workspace/result-view';
import { SplitPanes } from '@/modules/workspace/split';
import { ProblemStatement } from '@/modules/workspace/statement';

interface DriverInfo {
  available: boolean;
  driver: string;
  languages: string[];
}

/**
 * One practice problem: the statement beside the editor, Run on the visible cases or your own
 * input, Submit against every case. Both run in the sandbox; nothing runs in the browser.
 */
export function PracticeWorkspace({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const problem = useQuery({
    queryKey: ['practice', slug],
    queryFn: () => api<PracticeProblemDetail>(`/practice/problems/${slug}`),
  });
  const driver = useQuery({
    queryKey: ['practice', 'driver'],
    queryFn: () => api<DriverInfo>('/practice/driver'),
  });
  const [last, setLast] = useState<PracticeSubmitOutcome | null>(null);
  const [tick, setTick] = useState(0);
  const wide = useMediaQuery(WIDE_WORKSPACE);

  const submit = useMutation({
    mutationFn: (input: { language: ExecutionLanguage; code: string }) =>
      api<PracticeSubmitOutcome>(`/practice/problems/${slug}/submissions`, { body: input }),
    onSuccess: async (outcome) => {
      setLast(outcome);
      setTick((n) => n + 1);
      if (outcome.newlySolved)
        toast.success(`Solved. ${plural(problem.data?.points ?? 0, 'point')} added.`);
      await queryClient.invalidateQueries({ queryKey: ['practice', slug] });
      await queryClient.invalidateQueries({ queryKey: ['practice', 'summary'] });
    },
    onError: (error) =>
      toast.error(
        isApiError(error) ? error.message : 'Your code could not be submitted. Try again.',
      ),
  });

  if (problem.isPending) return <LoadingRows rows={6} />;
  if (problem.isError)
    return <ErrorState error={problem.error} onRetry={() => problem.refetch()} />;
  const detail = problem.data;
  const sql = detail.type === 'sql';
  const unavailable =
    driver.data && !driver.data.available
      ? 'Code cannot be run right now. Try again shortly.'
      : null;

  const statement = (
    <ProblemStatement
      problem={{
        eyebrow: detail.topic ? humanise(detail.topic) : 'Coding practice',
        title: detail.title,
        facts: [
          sql ? 'SQL' : 'Coding',
          DIFFICULTY_LABELS[detail.difficulty] ?? detail.difficulty,
          plural(detail.points, 'point'),
          ...(detail.status === 'solved' ? ['Solved'] : []),
        ],
        type: detail.type,
        body: detail.body,
        hints: detail.hints,
        spec: null,
        coding: {
          inputFormat: detail.inputFormat,
          outputFormat: detail.outputFormat,
          constraints: detail.constraints,
          compareMode: detail.compareMode,
          schemaSql: detail.schemaSql,
          samples: detail.samples,
          hiddenCount: detail.hiddenTestCount,
          timeLimitMs: detail.timeLimitMs,
          memoryLimitMb: detail.memoryLimitMb,
        },
      }}
    />
  );

  const result = last ? <SubmitResult outcome={last} sql={sql} /> : null;
  const history = <PracticeHistory slug={slug} />;
  const codePanel = (
    <CodePanel
      draftKey={`practice:${slug}`}
      languages={detail.languages}
      starterCode={detail.starterCode}
      samples={detail.samples}
      run={(input) => api<RunOutcome>(`/practice/problems/${slug}/run`, { body: input })}
      submit={async (input) => {
        try {
          await submit.mutateAsync(input);
        } catch {
          // Reported by the mutation.
        }
      }}
      submitting={submit.isPending}
      blockedReason={unavailable}
      submissionTick={tick}
      submissionResult={result}
      className="h-full rounded-xl border border-border bg-card shadow-xs xl:overflow-hidden"
    />
  );

  const header = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link
        href="/practice"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Practice
      </Link>
      <span className="ml-auto inline-flex items-center gap-3 text-xs text-muted-foreground">
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
      {wide ? (
        <SplitPanes
          storageKey="lms-workspace-split"
          left={
            <div className="h-full rounded-xl border border-border bg-card px-5 pb-5 shadow-xs">
              <Tabs defaultValue="problem" className="flex h-full min-h-0 flex-col gap-0">
                <TabsList aria-label="About the problem" className="h-11 px-1">
                  <TabsTrigger value="problem">Problem</TabsTrigger>
                  <TabsTrigger value="submissions">Submissions</TabsTrigger>
                </TabsList>
                <TabsContent value="problem" className="min-h-0 flex-1 overflow-y-auto pt-5 pr-1">
                  {statement}
                </TabsContent>
                <TabsContent
                  value="submissions"
                  className="min-h-0 flex-1 overflow-y-auto pt-5 pr-1"
                >
                  {history}
                </TabsContent>
              </Tabs>
            </div>
          }
          right={codePanel}
          className="h-[calc(100dvh-9.5rem)] min-h-[620px]"
        />
      ) : (
        <Tabs defaultValue="problem" className="gap-4">
          <TabsList variant="segmented" aria-label="Workspace" className="w-full">
            <TabsTrigger value="problem" className="flex-1">
              Problem
            </TabsTrigger>
            <TabsTrigger value="code" className="flex-1">
              Code
            </TabsTrigger>
            <TabsTrigger value="submissions" className="flex-1">
              Submissions
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="problem"
            className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            {statement}
          </TabsContent>
          <TabsContent value="code" forceMount className="data-[state=inactive]:hidden">
            {codePanel}
          </TabsContent>
          <TabsContent value="submissions">{history}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/** What a submission came back with: the verdict, every case (hidden ones as verdicts only). */
function SubmitResult({ outcome, sql }: { outcome: PracticeSubmitOutcome; sql: boolean }) {
  const { submission } = outcome;
  const accepted = submission.verdict === 'passed';
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold">{accepted ? 'Accepted' : 'Not accepted yet'}</p>
        <VerdictBadge verdict={submission.verdict} />
        {outcome.newlySolved ? (
          <span className="text-xs font-medium text-success">First solve</span>
        ) : null}
      </div>
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

function PracticeHistory({ slug }: { slug: string }) {
  const history = useQuery({
    queryKey: ['practice', slug, 'submissions'],
    queryFn: () => api<PracticeSubmissionRecord[]>(`/practice/problems/${slug}/submissions`),
  });
  if (history.isPending) return <LoadingRows rows={3} />;
  if (history.isError)
    return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  if (history.data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
        Nothing submitted yet. Your submissions and their verdicts appear here.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[480px] text-left text-sm">
        <caption className="sr-only">Your submissions to this problem</caption>
        <thead className="bg-surface-2 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Submitted
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Language
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Verdict
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Cases
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Time
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {history.data.map((record) => (
            <tr key={record.id}>
              <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                {formatDateTime(record.submittedAt)}
              </td>
              <td className="px-3 py-2">{LANGUAGE_LABELS[record.language] ?? record.language}</td>
              <td className="px-3 py-2">
                {record.trust === 'trusted' ? (
                  <VerdictBadge verdict={record.verdict} />
                ) : (
                  <span
                    className="text-xs text-muted-foreground"
                    title="Recorded before code ran in the sandbox; not counted"
                  >
                    {VERDICT_LABELS[record.verdict]} (not counted)
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {record.passed} / {record.total}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatDuration(record.durationMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
