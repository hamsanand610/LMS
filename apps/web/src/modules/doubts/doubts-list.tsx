'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, MessageCircleQuestion, MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  DOUBT_STATUS_LABELS,
  type DoubtStatus,
  type DoubtSummary,
  type Paginated,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export type DoubtRole = 'learner' | 'staff';

export const DOUBT_TONE: Record<DoubtStatus, StatusTone> = {
  open: 'warning',
  answered: 'info',
  resolved: 'success',
};

/** Where each side of the desk reads and writes doubts. */
export function doubtsEndpoint(role: DoubtRole): string {
  return role === 'learner' ? '/me/doubts' : '/doubts';
}

type Filter = 'all' | DoubtStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Waiting' },
  { value: 'answered', label: 'Answered' },
  { value: 'resolved', label: 'Resolved' },
];

/**
 * Doubts as a list. A learner sees their own, newest first, with a way to ask; staff see the
 * learners their scope reaches, the oldest waiting first when filtered to "Waiting".
 */
export function DoubtsList({ role, basePath }: { role: DoubtRole; basePath: string }) {
  const [filter, setFilter] = useState<Filter>(role === 'staff' ? 'open' : 'all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (filter !== 'all') params.set('status', filter);
  if (q.trim()) params.set('q', q.trim());

  const query = useQuery({
    queryKey: ['doubts', role, params.toString()],
    queryFn: () => api<Paginated<DoubtSummary>>(`${doubtsEndpoint(role)}?${params.toString()}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setFilter(value as Filter);
            setPage(1);
          }}
        >
          <TabsList variant="segmented" aria-label="Show">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <SearchInput
            wrapperClassName="w-full sm:w-64"
            placeholder={role === 'staff' ? 'Search by title or learner' : 'Search your doubts'}
            aria-label="Search doubts"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          {role === 'learner' ? (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/doubts/new">
                <MessageCircleQuestion aria-hidden="true" />
                Ask a doubt
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {query.isPending ? <LoadingRows rows={5} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title={
            role === 'staff'
              ? filter === 'open'
                ? 'Nobody is waiting for an answer'
                : 'No doubts here'
              : filter === 'all'
                ? 'You have not asked anything yet'
                : 'No doubts here'
          }
          description={
            role === 'staff'
              ? 'Doubts from the learners of your batches appear here as they ask them.'
              : 'Ask about a course or a lesson and the trainers of your batch will answer here.'
          }
          action={
            role === 'learner' && filter === 'all' ? (
              <Button asChild>
                <Link href="/doubts/new">Ask a doubt</Link>
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {query.data.data.map((doubt) => (
              <li key={doubt.id}>
                <Link
                  href={`${basePath}/${doubt.id}`}
                  className="group/row flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2/60 sm:items-center"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg sm:mt-0',
                      doubt.status === 'open'
                        ? 'bg-warning-soft text-warning'
                        : 'bg-surface-2 text-foreground-secondary',
                    )}
                  >
                    <MessagesSquare className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {doubt.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {[
                        role === 'staff'
                          ? `${doubt.student.name} (${doubt.student.batchCodes.join(', ') || doubt.student.studentCode})`
                          : null,
                        doubt.lesson?.title ?? doubt.course?.title ?? 'General',
                        `${doubt.replyCount} ${doubt.replyCount === 1 ? 'reply' : 'replies'}`,
                        formatDateTime(doubt.updatedAt),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <StatusBadge
                    status={doubt.status}
                    label={DOUBT_STATUS_LABELS[doubt.status]}
                    tone={DOUBT_TONE[doubt.status]}
                    className="shrink-0"
                  />
                  <ChevronRight
                    className="size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover/row:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <PaginationBar
            page={page}
            pageSize={query.data.meta.pageSize}
            total={query.data.meta.total}
            onPageChange={setPage}
            noun="doubts"
          />
        </>
      ) : null}
    </div>
  );
}
