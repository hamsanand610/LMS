'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  EXECUTED_TYPES,
  OBJECTIVE_TYPES,
  type ExecutionLanguage,
  type LearnerQuestionWorkspace,
  type RunOutcome,
  type SubmissionInput,
  type SubmissionView,
} from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { useMediaQuery, WIDE_WORKSPACE } from '@/lib/use-media-query';
import { HandInPanel, ObjectivePanel, WrittenPanel } from '@/modules/workspace/answer-panels';
import { WebLabPanel } from '@/modules/labs/web-lab-panel';
import { CodePanel, readStored, writeStored } from '@/modules/workspace/code-panel';
import { History } from '@/modules/workspace/history';
import { SubmissionResultView } from '@/modules/workspace/result-view';
import { SplitPanes } from '@/modules/workspace/split';
import { Statement } from '@/modules/workspace/statement';
import { ProgressBadge } from './status';

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now()}${Math.random().toString(36).slice(2)}`;
}

/**
 * One assignment question, whatever its type. Code questions get the split workspace — the problem
 * beside the editor and its console — and everything else a single column: the question, the
 * answer, the latest result and the history of attempts.
 */
export function QuestionWorkspace({
  assignmentId,
  placementId,
}: {
  assignmentId: string;
  placementId: string;
}) {
  const queryClient = useQueryClient();
  const base = `/me/assignments/${assignmentId}/questions/${placementId}`;
  const workspace = useQuery({
    queryKey: ['learner-question', assignmentId, placementId],
    queryFn: () => api<LearnerQuestionWorkspace>(base),
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [reuse, setReuse] = useState<{
    language: ExecutionLanguage;
    code: string;
    tick: number;
  } | null>(null);
  const pendingKey = useRef<string | null>(null);

  // A submission being checked is asked about every couple of seconds until it has a result.
  const active = useQuery({
    queryKey: ['submission', activeId],
    queryFn: () => api<SubmissionView>(`/me/submissions/${activeId}`),
    enabled: activeId !== null,
    refetchInterval: (query) => (query.state.data?.status === 'evaluating' ? 1500 : false),
  });

  const settled = active.data && active.data.status !== 'evaluating' ? active.data.id : null;
  useEffect(() => {
    if (!settled) return;
    void queryClient.invalidateQueries({
      queryKey: ['learner-question', assignmentId, placementId],
    });
    void queryClient.invalidateQueries({ queryKey: ['submission-history'] });
    void queryClient.invalidateQueries({ queryKey: ['my-assignment', assignmentId] });
    void queryClient.invalidateQueries({ queryKey: ['my-assignments'] });
  }, [settled, assignmentId, placementId, queryClient]);

  const submit = useMutation({
    mutationFn: (input: Partial<SubmissionInput>) => {
      // One key per answer: a retry after a dropped connection returns the same submission.
      pendingKey.current ??= newKey();
      return api<SubmissionView>(`${base}/submissions`, {
        body: { ...input, idempotencyKey: pendingKey.current },
      });
    },
    onSuccess: (result) => {
      pendingKey.current = null;
      queryClient.setQueryData(['submission', result.id], result);
      setActiveId(result.id);
      setTick((n) => n + 1);
      void queryClient.invalidateQueries({ queryKey: ['submission-history'] });
      if (result.status !== 'evaluating') {
        void queryClient.invalidateQueries({
          queryKey: ['learner-question', assignmentId, placementId],
        });
        void queryClient.invalidateQueries({ queryKey: ['my-assignment', assignmentId] });
      }
    },
    onError: (error) => {
      // A refused answer (closed, out of attempts) will not be accepted with a retry either.
      if (isApiError(error) && error.status < 500) pendingKey.current = null;
      toast.error(
        isApiError(error)
          ? error.message
          : 'Your answer did not reach us. Try again; it will not count twice.',
      );
    },
  });

  const wide = useMediaQuery(WIDE_WORKSPACE);

  if (workspace.isPending) return <LoadingRows rows={8} />;
  if (workspace.isError)
    return <ErrorState error={workspace.error} onRetry={() => workspace.refetch()} />;
  const data = workspace.data;
  const executed = EXECUTED_TYPES.includes(data.question.type);
  const sql = data.question.type === 'sql';
  const web = data.question.type === 'web';
  const latest = active.data ?? data.lastSubmission;
  const blockedReason = data.progress.blockedReason;
  const submitAnswer = async (input: Partial<SubmissionInput>) => {
    try {
      return await submit.mutateAsync(input);
    } catch {
      return null;
    }
  };

  const header = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link
        href={`/assignments/${assignmentId}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the assignment
      </Link>
      <span className="text-[13px] text-muted-foreground">{data.assignment.title}</span>
      <div className="ml-auto flex items-center gap-2">
        <ProgressBadge status={data.progress.status} />
        <span className="text-xs text-muted-foreground tabular-nums">
          {data.progress.awardedMarks} / {data.placement.marks} marks
        </span>
        <nav aria-label="Questions" className="flex items-center gap-1">
          <Button
            asChild={Boolean(data.placement.previousId)}
            variant="ghost"
            size="icon-sm"
            disabled={!data.placement.previousId}
            aria-label="Previous question"
          >
            {data.placement.previousId ? (
              <Link href={`/assignments/${assignmentId}/q/${data.placement.previousId}`}>
                <ChevronLeft aria-hidden="true" />
              </Link>
            ) : (
              <ChevronLeft aria-hidden="true" />
            )}
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {data.placement.index} / {data.placement.count}
          </span>
          <Button
            asChild={Boolean(data.placement.nextId)}
            variant="ghost"
            size="icon-sm"
            disabled={!data.placement.nextId}
            aria-label="Next question"
          >
            {data.placement.nextId ? (
              <Link href={`/assignments/${assignmentId}/q/${data.placement.nextId}`}>
                <ChevronRight aria-hidden="true" />
              </Link>
            ) : (
              <ChevronRight aria-hidden="true" />
            )}
          </Button>
        </nav>
      </div>
    </div>
  );

  const history = (
    <History
      historyPath={`${base}/submissions`}
      submissionPath={(id) => `/me/submissions/${id}`}
      onReuse={
        executed
          ? (language, code) => {
              setReuse({ language, code, tick: Date.now() });
              toast.message('Your earlier code is back in the editor');
            }
          : undefined
      }
      sql={sql}
      web={web}
    />
  );

  if (!executed) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7">
          <Statement workspace={data} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7">
          {OBJECTIVE_TYPES.includes(data.question.type) ? (
            <ObjectivePanel
              workspace={data}
              last={latest}
              submit={submitAnswer}
              submitting={submit.isPending}
              blockedReason={blockedReason}
            />
          ) : data.question.type === 'descriptive' ? (
            <WrittenPanel
              workspace={data}
              submit={submitAnswer}
              submitting={submit.isPending}
              blockedReason={blockedReason}
            />
          ) : (
            <HandInPanel
              workspace={data}
              submit={submitAnswer}
              submitting={submit.isPending}
              blockedReason={blockedReason}
            />
          )}
        </div>
        {latest ? (
          <section
            aria-label="Your latest result"
            className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7"
          >
            <SubmissionResultView submission={latest} sql={false} />
          </section>
        ) : null}
        <section aria-label="Your submissions" className="space-y-3">
          <h2 className="text-base font-semibold">Your submissions</h2>
          {history}
        </section>
        <div className="flex justify-between">
          <Link
            href={`/assignments/${assignmentId}`}
            className="text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            Back to the assignment
          </Link>
        </div>
      </div>
    );
  }

  const coding = data.question.coding!;
  const panelClass = 'h-full rounded-xl border border-border bg-card shadow-xs xl:overflow-hidden';
  const result = latest ? <SubmissionResultView submission={latest} sql={sql} web={web} /> : null;
  // A web page's files, kept in this browser between visits; the last submission otherwise.
  const webDraftKey = `lms-draft:${placementId}:web`;
  const codePanel = web ? (
    <WebLabPanel
      problem={{
        starterFiles: coding.starterFiles,
        checks: coding.checks,
        hiddenTestCount: coding.hiddenCount,
      }}
      run={(input) => api<RunOutcome>(`${base}/run`, { body: input })}
      submit={async (input) => {
        await submitAnswer(input);
      }}
      submitting={submit.isPending}
      blockedReason={blockedReason}
      submissionTick={tick}
      submissionResult={result}
      loadCode={reuse ? { code: reuse.code, tick: reuse.tick } : null}
      drafts={{
        ready: true,
        initial: {
          web:
            readStored(webDraftKey) ??
            (data.lastSubmission?.language === 'web' ? data.lastSubmission.code : ''),
        },
        state: 'idle',
        change: (_language, code) => writeStored(webDraftKey, code),
        clear: () => writeStored(webDraftKey, null),
      }}
      className={panelClass}
    />
  ) : (
    <CodePanel
      draftKey={placementId}
      languages={coding.languages}
      starterCode={coding.starterCode}
      samples={coding.samples}
      run={(input) => api<RunOutcome>(`${base}/run`, { body: input })}
      submit={async (input) => {
        await submitAnswer(input);
      }}
      submitting={submit.isPending}
      blockedReason={blockedReason}
      submissionTick={tick}
      loadCode={reuse}
      savedCode={
        data.lastSubmission?.language
          ? { language: data.lastSubmission.language, code: data.lastSubmission.code }
          : null
      }
      submissionResult={result}
      className={panelClass}
    />
  );

  const problem = (
    <Tabs defaultValue="problem" className="flex h-full min-h-0 flex-col gap-0">
      <TabsList aria-label="About the question" className="h-11 px-1">
        <TabsTrigger value="problem">Problem</TabsTrigger>
        <TabsTrigger value="submissions">Submissions</TabsTrigger>
      </TabsList>
      <TabsContent value="problem" className="min-h-0 flex-1 overflow-y-auto pt-5 pr-1">
        <Statement workspace={data} />
      </TabsContent>
      <TabsContent value="submissions" className="min-h-0 flex-1 overflow-y-auto pt-5 pr-1">
        {history}
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="space-y-4">
      {header}
      {wide ? (
        <SplitPanes
          storageKey="lms-workspace-split"
          left={
            <div className="h-full rounded-xl border border-border bg-card px-5 pb-5 shadow-xs">
              {problem}
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
              {web ? 'Page' : 'Code'}
            </TabsTrigger>
            <TabsTrigger value="submissions" className="flex-1">
              Submissions
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="problem"
            className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            <Statement workspace={data} />
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
