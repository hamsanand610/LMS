'use client';

import { useQuery } from '@tanstack/react-query';
import { Circle, CircleCheck, CircleDot, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  DIFFICULTY_LABELS,
  EXECUTION_LANGUAGES,
  LANGUAGE_LABELS,
  QUESTION_DIFFICULTIES,
  type Paginated,
  type PracticeProblemCard,
  type PracticeSummary,
  type TaxonomyTerm,
} from '@lms/shared';
import { DifficultyBadge } from '@/components/difficulty-badge';
import { OverviewBand } from '@/components/overview-band';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';
import { humanise } from '@/lib/format';

const ALL = 'all';

const STATUS_LABELS: Record<string, string> = {
  solved: 'Solved',
  attempted: 'Attempted',
  not_attempted: 'Not tried',
};

/** The problem catalogue: what there is, and which ones this learner has solved. */
export function PracticeList() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [difficulty, setDifficulty] = useState(ALL);
  const [language, setLanguage] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [topic, setTopic] = useState(ALL);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (difficulty !== ALL) params.set('difficulty', difficulty);
  if (language !== ALL) params.set('language', language);
  if (status !== ALL) params.set('status', status);
  if (topic !== ALL) params.set('topic', topic);

  const query = useQuery({
    queryKey: ['practice', params.toString()],
    queryFn: () => api<Paginated<PracticeProblemCard>>(`/practice/problems?${params.toString()}`),
  });
  const summary = useQuery({
    queryKey: ['practice', 'summary'],
    queryFn: () => api<PracticeSummary>('/practice/summary'),
  });
  const topics = useQuery({
    queryKey: ['taxonomy', 'topic'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/topic/terms'),
  });
  const topicLabel = (key: string) =>
    topics.data?.find((term) => term.key === key)?.label ?? humanise(key);

  return (
    <div className="space-y-4">
      {summary.data ? (
        <OverviewBand
          label="Problems solved"
          pct={summary.data.total > 0 ? (summary.data.solved / summary.data.total) * 100 : 0}
          detail={`${summary.data.solved} of ${summary.data.total} problems in the catalogue`}
          figures={[
            { label: 'Attempted', value: summary.data.attempted },
            { label: 'Points', value: summary.data.points },
            { label: 'Left to try', value: Math.max(0, summary.data.total - summary.data.solved) },
          ]}
        />
      ) : (
        <Skeleton className="h-28 rounded-xl" />
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search problems"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="pl-9"
            aria-label="Search problems"
          />
        </div>
        <Select
          value={difficulty}
          onValueChange={(value) => {
            setDifficulty(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36" aria-label="Filter by difficulty">
            <SelectValue placeholder="Any level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any level</SelectItem>
            {QUESTION_DIFFICULTIES.map((value) => (
              <SelectItem key={value} value={value}>
                {DIFFICULTY_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={language}
          onValueChange={(value) => {
            setLanguage(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by language">
            <SelectValue placeholder="Any language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any language</SelectItem>
            {EXECUTION_LANGUAGES.map((value) => (
              <SelectItem key={value} value={value}>
                {LANGUAGE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {summary.data && summary.data.topics.length > 0 ? (
          <Select
            value={topic}
            onValueChange={(value) => {
              setTopic(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Filter by topic">
              <SelectValue placeholder="Any topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any topic</SelectItem>
              {summary.data.topics.map((value) => (
                <SelectItem key={value} value={value}>
                  {topicLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isPending ? <LoadingRows /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No problems match"
          description="Practice problems are coding and SQL questions your trainers have put in the catalogue. Clear a filter to see more."
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Problem</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Languages</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((problem) => (
                <TableRow key={problem.questionId}>
                  <TableCell>
                    <Link
                      className="font-medium text-foreground hover:text-brand hover:underline"
                      href={`/practice/${problem.slug}`}
                    >
                      {problem.title}
                    </Link>
                    {problem.topic ? (
                      <span className="block text-xs text-muted-foreground">
                        {topicLabel(problem.topic)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <DifficultyBadge value={problem.difficulty} />
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {problem.languages.map((l) => (
                        <span
                          key={l}
                          className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-foreground-secondary"
                        >
                          {LANGUAGE_LABELS[l] ?? l}
                        </span>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{problem.points}</TableCell>
                  <TableCell className="text-right tabular-nums">{problem.attempts}</TableCell>
                  <TableCell>
                    <PracticeStatus status={problem.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {query.data ? (
        <PaginationBar
          page={query.data.meta.page}
          pageSize={query.data.meta.pageSize}
          total={query.data.meta.total}
          onPageChange={setPage}
          noun="problems"
        />
      ) : null}
    </div>
  );
}

const STATUS_STYLE: Record<string, { className: string; icon: typeof CircleCheck }> = {
  solved: { className: 'bg-success-soft text-success', icon: CircleCheck },
  attempted: { className: 'bg-primary-soft text-brand', icon: CircleDot },
  not_attempted: { className: 'bg-surface-2 text-foreground-secondary', icon: Circle },
};

/** A problem's state as a chip with an icon and its word. */
function PracticeStatus({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.not_attempted!;
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[11.5px] font-medium ${style.className}`}
    >
      <Icon className="size-3" aria-hidden="true" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
