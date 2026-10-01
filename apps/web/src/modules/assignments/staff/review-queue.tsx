'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  QUESTION_TYPE_LABELS,
  REVIEW_DECISION_LABELS,
  type Paginated,
  type QuestionProgress,
  type ReviewQueueItem,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { SearchInput } from '@/components/ui/search-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';

export type StaffPortal = 'admin' | 'trainer';

type QueueState = 'pending' | 'reviewed' | 'all';

const REVIEWED_TYPES = [
  'descriptive',
  'coding',
  'sql',
  'file_upload',
  'practical',
  'project',
] as const;

/** The queue speaks to the reviewer, so the words differ from the learner's. */
const STAFF_LABELS: Record<QuestionProgress, { label: string; tone: StatusTone }> = {
  not_attempted: { label: 'Not attempted', tone: 'neutral' },
  evaluating: { label: 'Being checked', tone: 'info' },
  awaiting_review: { label: 'Waiting for you', tone: 'upcoming' },
  correct: { label: 'Full marks', tone: 'success' },
  partial: { label: 'Part marks', tone: 'warning' },
  incorrect: { label: 'No marks', tone: 'danger' },
  resubmit: { label: 'Resubmission asked', tone: 'warning' },
  error: { label: 'Could not be checked', tone: 'neutral' },
};

export function StaffProgressBadge({ status }: { status: QuestionProgress }) {
  const entry = STAFF_LABELS[status];
  return <StatusBadge status={status} label={entry.label} tone={entry.tone} />;
}

/**
 * Answers waiting for a person, oldest first, or the ones already decided. The server keeps it to
 * the reviewer's batches; opening a row leads to the review page.
 */
export function ReviewQueue({
  portal,
  assignmentId,
}: {
  portal: StaffPortal;
  assignmentId?: string;
}) {
  const [state, setState] = useState<QueueState>('pending');
  const [type, setType] = useState('');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [text]);

  const params = new URLSearchParams({ state, page: String(page), pageSize: '25' });
  if (assignmentId) params.set('assignmentId', assignmentId);
  if (type) params.set('type', type);
  if (q) params.set('q', q);

  const query = useQuery({
    queryKey: ['review-queue', params.toString()],
    queryFn: () => api<Paginated<ReviewQueueItem>>(`/submissions?${params.toString()}`),
    placeholderData: keepPreviousData,
  });

  const reviewHref = (id: string) => `/${portal}/reviews/${id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={state}
          onValueChange={(value) => {
            setState(value as QueueState);
            setPage(1);
          }}
        >
          <TabsList variant="segmented" aria-label="Which answers">
            <TabsTrigger value="pending">Waiting</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput
          wrapperClassName="w-full sm:w-64"
          placeholder="Learner, code or question"
          aria-label="Search answers"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <NativeSelect
          aria-label="Question type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="w-44"
        >
          <option value="">Any type</option>
          {REVIEWED_TYPES.map((value) => (
            <option key={value} value={value}>
              {QUESTION_TYPE_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {query.isPending ? <LoadingRows rows={4} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title={state === 'pending' ? 'Nothing waiting' : 'Nothing here'}
          description={
            state === 'pending'
              ? 'Written answers, projects and hand-ins appear here as learners submit them.'
              : 'Answers you or another reviewer have decided on appear here.'
          }
        />
      ) : null}
      {query.data && query.data.data.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Attempt</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Marks</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((item) => (
                  <TableRow key={item.submissionId}>
                    <TableCell>
                      <span className="font-medium">{item.studentName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {item.studentCode}
                        {item.batchCode ? ` · ${item.batchCode}` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[18rem]">
                      <span className="line-clamp-1">{item.questionTitle}</span>
                      {!assignmentId ? (
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {item.assignmentTitle}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {QUESTION_TYPE_LABELS[item.questionType]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.attempt}</TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(item.submittedAt)}
                    </TableCell>
                    <TableCell>
                      <StaffProgressBadge status={item.status} />
                      {item.reviewDecision && item.status !== 'resubmit' ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {REVIEW_DECISION_LABELS[item.reviewDecision]}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.status === 'awaiting_review' ? '—' : item.marks} / {item.maxMarks}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        asChild
                        size="sm"
                        variant={item.status === 'awaiting_review' ? 'default' : 'outline'}
                      >
                        <Link
                          href={reviewHref(item.submissionId)}
                          aria-label={`${item.status === 'awaiting_review' ? 'Review' : 'Open'} ${item.studentName}'s answer to ${item.questionTitle}`}
                        >
                          {item.status === 'awaiting_review' ? 'Review' : 'Open'}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={query.data.meta.page}
            pageSize={query.data.meta.pageSize}
            total={query.data.meta.total}
            onPageChange={setPage}
            noun="answers"
          />
        </>
      ) : null}
    </div>
  );
}
