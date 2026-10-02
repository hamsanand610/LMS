'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleX, Lock } from 'lucide-react';
import { useState } from 'react';
import {
  LANGUAGE_LABELS,
  VERDICT_LABELS,
  decodeWebFiles,
  type PracticeSubmissionDetail,
  type PracticeSubmissionRecord,
} from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/format';
import { VerdictBadge } from '@/modules/assignments/status';
import { formatDuration } from '@/modules/workspace/result-view';

/**
 * A learner's own submissions to one lab, newest first, each with its verdict; one opens with its
 * code and how every case went (hidden cases by verdict only), and can go back into the editor.
 */
export function LabHistory({
  queryKey,
  list,
  detail,
  onReopen,
}: {
  queryKey: unknown[];
  list: () => Promise<PracticeSubmissionRecord[]>;
  detail: (id: string) => Promise<PracticeSubmissionDetail>;
  onReopen: (submission: PracticeSubmissionDetail) => void;
}) {
  const history = useQuery({ queryKey, queryFn: list });
  const [open, setOpen] = useState<string | null>(null);

  if (history.isPending) return <LoadingRows rows={3} />;
  if (history.isError)
    return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  if (history.data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
        Nothing submitted yet. Each submission and its verdict appear here, and any of them can be
        opened again.
      </p>
    );
  }
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[520px] text-left text-sm">
          <caption className="sr-only">Your submissions to this lab</caption>
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
                Passed
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Time
              </th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Open</span>
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
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpen(record.id)}
                  >
                    Open
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          {open ? (
            <SubmissionView
              id={open}
              detail={detail}
              onReopen={(submission) => {
                setOpen(null);
                onReopen(submission);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SubmissionView({
  id,
  detail,
  onReopen,
}: {
  id: string;
  detail: (id: string) => Promise<PracticeSubmissionDetail>;
  onReopen: (submission: PracticeSubmissionDetail) => void;
}) {
  const query = useQuery({ queryKey: ['labs', 'submission', id], queryFn: () => detail(id) });
  if (query.isPending) {
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
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const submission = query.data;
  const files = submission.language === 'web' ? decodeWebFiles(submission.code) : null;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Submission of {formatDateTime(submission.submittedAt)}</DialogTitle>
        <DialogDescription>
          {LANGUAGE_LABELS[submission.language] ?? submission.language} · {submission.passed} of{' '}
          {submission.total} cases passed
        </DialogDescription>
      </DialogHeader>
      <ul className="space-y-1">
        {submission.cases.map((c) => (
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
        <div className="space-y-2">
          {(['html', 'css', 'js'] as const).map((name) =>
            files[name] ? (
              <CodeBlock
                key={name}
                label={name === 'html' ? 'index.html' : name === 'css' ? 'styles.css' : 'script.js'}
                code={files[name]}
              />
            ) : null,
          )}
        </div>
      ) : (
        <CodeBlock label="Code" code={submission.code} />
      )}
      <div className="flex justify-end">
        <Button type="button" onClick={() => onReopen(submission)}>
          Open in the editor
        </Button>
      </div>
    </>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <p className="mb-1 font-mono text-xs text-muted-foreground">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-md border border-border bg-surface-2/70 px-3 py-2 font-mono text-[12.5px] leading-5 whitespace-pre">
        {code}
      </pre>
    </div>
  );
}
