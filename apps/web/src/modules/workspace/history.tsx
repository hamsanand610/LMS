'use client';

import { useQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import {
  LANGUAGE_LABELS,
  type ExecutionLanguage,
  type SubmissionHistoryItem,
  type SubmissionView,
} from '@lms/shared';
import { CodeEditor } from '@/components/code-editor';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ProgressBadge, VerdictBadge } from '@/modules/assignments/status';
import { formatDuration, formatMemory, SubmissionResultView } from './result-view';

/** Every attempt at one question, newest first; one opens to show its code, cases and feedback. */
export function History({
  historyPath,
  submissionPath,
  onReuse,
  sql,
}: {
  historyPath: string;
  /** Where one submission is read, given its id. */
  submissionPath: (id: string) => string;
  /** Puts a past attempt's code back into the editor. */
  onReuse?: (language: ExecutionLanguage, code: string) => void;
  sql: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const history = useQuery({
    queryKey: ['submission-history', historyPath],
    queryFn: () => api<SubmissionHistoryItem[]>(historyPath),
  });
  const detail = useQuery({
    queryKey: ['submission', openId],
    queryFn: () => api<SubmissionView>(submissionPath(openId!)),
    enabled: openId !== null,
  });

  if (history.isPending) return <LoadingRows rows={3} />;
  if (history.isError)
    return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  if (history.data.length === 0) {
    return (
      <EmptyState
        title="No submissions yet"
        description="Every answer you submit is listed here, with its result."
      />
    );
  }

  // Cases, time and memory mean something only for answers that ran code.
  const measured = history.data.some((item) => item.total > 0 || item.durationMs !== null);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table
          className={cn('w-full text-left text-sm', measured ? 'min-w-[540px]' : 'min-w-[360px]')}
        >
          <caption className="sr-only">Your submissions to this question</caption>
          <thead className="bg-surface-2 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Attempt
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Submitted
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Result
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Marks
              </th>
              {measured ? (
                <>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Cases
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Time
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Memory
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.data.map((item) => (
              <tr key={item.id} className="hover:bg-surface-2/50">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setOpenId(item.id)}
                    className="font-medium text-brand underline-offset-4 hover:underline"
                  >
                    #{item.attempt}
                  </button>
                  {item.language ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {LANGUAGE_LABELS[item.language]}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(item.submittedAt)}
                </td>
                <td className="px-3 py-2">
                  {item.verdict && item.verdict !== 'pending' ? (
                    <VerdictBadge verdict={item.verdict} />
                  ) : (
                    <ProgressBadge status={item.status} />
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {item.marks} / {item.maxMarks}
                </td>
                {measured ? (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {item.total > 0 ? `${item.passed}/${item.total}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatDuration(item.durationMs)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMemory(item.memoryKb)}
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={openId !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {detail.data ? `Attempt ${detail.data.attempt}` : 'Submission'}
            </DialogTitle>
            <DialogDescription>
              What you submitted, how it was marked, and any feedback.
            </DialogDescription>
          </DialogHeader>
          {detail.isPending ? <LoadingRows rows={3} /> : null}
          {detail.isError ? (
            <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
          ) : null}
          {detail.data ? (
            <div className="space-y-4">
              {detail.data.code ? (
                <div className="overflow-hidden rounded-lg border border-border">
                  <CodeEditor
                    value={detail.data.code}
                    language={detail.data.language ?? 'java'}
                    label={`Code of attempt ${detail.data.attempt}`}
                    readOnly
                    className="h-64"
                  />
                </div>
              ) : null}
              {detail.data.text ? (
                <div className="rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-sm whitespace-pre-line">
                  {detail.data.text}
                </div>
              ) : null}
              {detail.data.links.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {detail.data.links.map((link) => (
                    <li key={link}>
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand underline-offset-4 hover:underline"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              <SubmissionResultView submission={detail.data} sql={sql} />
              {onReuse && detail.data.code && detail.data.language ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    onReuse(detail.data!.language!, detail.data!.code);
                    setOpenId(null);
                  }}
                >
                  <RotateCcw aria-hidden="true" />
                  Put this code back in the editor
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
