'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleX, Lock } from 'lucide-react';
import { useState } from 'react';
import {
  LANGUAGE_LABELS,
  VERDICT_LABELS,
  decodeWebFiles,
  type BatchSummary,
  type LabAttemptRow,
  type LabRunView,
  type Paginated,
  type PracticeProblemDetail,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { VerdictBadge } from '@/modules/assignments/status';
import { PageHeader } from '@/shell/page-header';
import { LabTypeBadge } from './lab-types';

const ALL = 'all';

/**
 * How learners are doing with one lab (`practice:review`): one row per learner within the
 * reviewer's scope — a trainer's own batches, everyone for an administrator — with their best
 * result, and their latest submission open to read, hidden cases included.
 */
export function StaffLabAttempts({
  questionId,
  basePath,
}: {
  questionId: string;
  basePath: string;
}) {
  const [page, setPage] = useState(1);
  const [batchId, setBatchId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [open, setOpen] = useState<string | null>(null);

  const lab = useQuery({
    queryKey: ['labs', 'preview', questionId],
    queryFn: () => api<PracticeProblemDetail>(`/practice/labs/${questionId}/preview`),
  });
  const batches = useQuery({
    queryKey: ['batches', 'mine'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
  });
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (batchId !== ALL) params.set('batchId', batchId);
  if (status !== ALL) params.set('status', status);
  const attempts = useQuery({
    queryKey: ['labs', 'attempts', questionId, params.toString()],
    queryFn: () =>
      api<Paginated<LabAttemptRow>>(`/practice/labs/${questionId}/attempts?${params.toString()}`),
  });

  return (
    <>
      <PageHeader
        back={{ href: basePath, label: 'Labs' }}
        eyebrow={lab.data ? <LabTypeBadge type={lab.data.type} /> : undefined}
        title={lab.data ? `Attempts: ${lab.data.title}` : 'Attempts'}
        description="One row for each learner you can review who has submitted this lab. Open a row to read their latest submission."
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            className="w-auto"
            aria-label="Batch"
            value={batchId}
            onChange={(e) => {
              setBatchId(e.target.value);
              setPage(1);
            }}
          >
            <option value={ALL}>Every batch I can see</option>
            {(batches.data?.data ?? []).map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            className="w-auto"
            aria-label="Result"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value={ALL}>Solved or not</option>
            <option value="solved">Solved</option>
            <option value="attempted">Not solved yet</option>
          </NativeSelect>
        </div>

        {attempts.isPending ? <LoadingRows /> : null}
        {attempts.isError ? (
          <ErrorState error={attempts.error} onRetry={() => attempts.refetch()} />
        ) : null}
        {attempts.data && attempts.data.data.length === 0 ? (
          <EmptyState
            title="No attempts yet"
            description="Learners you can review appear here once they submit this lab."
          />
        ) : null}
        {attempts.data && attempts.data.data.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Submissions</TableHead>
                  <TableHead>Best result</TableHead>
                  <TableHead>Last submitted</TableHead>
                  <TableHead>
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.data.data.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <span className="block font-medium">{row.name}</span>
                      {row.studentCode ? (
                        <span className="block text-xs text-muted-foreground">
                          {row.studentCode}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-foreground-secondary">
                      {row.batches.join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.submissions}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <VerdictBadge verdict={row.bestVerdict} />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {row.bestPassed} / {row.total}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(row.lastSubmittedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!row.latestRunId}
                        onClick={() => setOpen(row.latestRunId)}
                      >
                        Latest submission
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        {attempts.data ? (
          <PaginationBar
            page={attempts.data.meta.page}
            pageSize={attempts.data.meta.pageSize}
            total={attempts.data.meta.total}
            onPageChange={setPage}
            noun="learners"
          />
        ) : null}
      </div>
      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          {open ? <RunView runId={open} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RunView({ runId }: { runId: string }) {
  const run = useQuery({
    queryKey: ['labs', 'run', runId],
    queryFn: () => api<LabRunView>(`/practice/runs/${runId}`),
  });
  if (run.isPending) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Submission</DialogTitle>
          <DialogDescription>Loading…</DialogDescription>
        </DialogHeader>
        <LoadingRows rows={4} />
      </>
    );
  }
  if (run.isError) return <ErrorState error={run.error} onRetry={() => run.refetch()} />;
  const view = run.data;
  const files = view.language === 'web' ? decodeWebFiles(view.code) : null;
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {view.learnerName}: {view.labTitle}
        </DialogTitle>
        <DialogDescription>
          {formatDateTime(view.submittedAt)} · {LANGUAGE_LABELS[view.language] ?? view.language} ·{' '}
          {view.passed} of {view.total} cases passed
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2">
        <VerdictBadge verdict={view.verdict} />
        {view.trust !== 'trusted' ? (
          <span className="text-xs text-muted-foreground">Not run in the sandbox; not counted</span>
        ) : null}
      </div>
      <ul className="space-y-1">
        {view.cases.map((c) => (
          <li key={c.number} className="flex items-center gap-2 text-sm">
            {c.passed ? (
              <CircleCheck className="size-4 text-success" aria-label="Passed" />
            ) : (
              <CircleX className="size-4 text-danger" aria-label="Not passed" />
            )}
            <span className="min-w-0 flex-1 truncate">
              {c.hidden ? (
                <span className="inline-flex items-center gap-1">
                  <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  {c.label} <span className="text-xs text-muted-foreground">(hidden)</span>
                </span>
              ) : (
                c.label
              )}
            </span>
            <span className="text-xs text-muted-foreground">{VERDICT_LABELS[c.verdict]}</span>
          </li>
        ))}
      </ul>
      {files ? (
        (['html', 'css', 'js'] as const).map((name) =>
          files[name] ? (
            <Code
              key={name}
              label={name === 'html' ? 'index.html' : name === 'css' ? 'styles.css' : 'script.js'}
              code={files[name]}
            />
          ) : null,
        )
      ) : (
        <Code label="Code" code={view.code} />
      )}
    </>
  );
}

function Code({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <p className="mb-1 font-mono text-xs text-muted-foreground">{label}</p>
      <pre className="max-h-72 overflow-auto rounded-md border border-border bg-surface-2/70 px-3 py-2 font-mono text-[12.5px] leading-5 whitespace-pre">
        {code}
      </pre>
    </div>
  );
}
