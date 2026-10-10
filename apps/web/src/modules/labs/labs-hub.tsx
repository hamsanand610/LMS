'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Circle, CircleCheck, CircleDot, Search, SquareTerminal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  DIFFICULTY_LABELS,
  LAB_TYPES,
  LANGUAGE_LABELS,
  QUESTION_DIFFICULTIES,
  type LabInProgress,
  type LabType,
  type Paginated,
  type PracticeProblemCard,
  type PracticeSummary,
  type TaxonomyTerm,
} from '@lms/shared';
import { DifficultyBadge } from '@/components/difficulty-badge';
import { OverviewBand } from '@/components/overview-band';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
import { formatDateTime, humanise } from '@/lib/format';
import { LAB_TYPE_META, LabTypeBadge } from './lab-types';

const ALL = 'all';

const STATUS_LABELS: Record<string, string> = {
  solved: 'Solved',
  attempted: 'Attempted',
  not_attempted: 'Not tried',
};

/**
 * The Labs (ADR-0018): how far the learner has got, the labs they left unfinished, the playground,
 * and the catalogue — coding, SQL, debugging and web labs their trainers have published.
 */
export function LabsHub() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>(ALL);
  const [difficulty, setDifficulty] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [topic, setTopic] = useState(ALL);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (type !== ALL) params.set('type', type);
  if (difficulty !== ALL) params.set('difficulty', difficulty);
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
  const going = useQuery({
    queryKey: ['labs', 'in-progress'],
    queryFn: () => api<LabInProgress[]>('/practice/in-progress'),
  });
  const topics = useQuery({
    queryKey: ['taxonomy', 'topic'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/topic/terms'),
  });
  const topicLabel = (key: string) =>
    topics.data?.find((term) => term.key === key)?.label ?? humanise(key);
  const restart = () => setPage(1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {summary.data ? (
          <OverviewBand
            label="Labs solved"
            pct={summary.data.total > 0 ? (summary.data.solved / summary.data.total) * 100 : 0}
            detail={`${summary.data.solved} of ${summary.data.total} labs in the catalogue`}
            figures={[
              { label: 'Attempted', value: summary.data.attempted },
              { label: 'Points', value: summary.data.points },
              {
                label: 'Left to try',
                value: Math.max(0, summary.data.total - summary.data.solved),
              },
            ]}
          />
        ) : summary.isError ? (
          <ErrorState
            error={summary.error}
            message="Your lab progress could not be loaded."
            onRetry={() => void summary.refetch()}
          />
        ) : (
          <Skeleton className="h-28 rounded-xl" />
        )}
        <Link
          href="/labs/playground"
          className="group/play flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-border-strong"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <SquareTerminal className="size-4 text-brand" aria-hidden="true" />
            Playground
          </span>
          <span className="text-sm text-muted-foreground">
            Try out any idea in Java, Python, JavaScript, PHP or SQL. It runs in the sandbox and is
            not marked.
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
            Open the playground
            <ArrowRight
              className="size-4 transition-transform group-hover/play:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </Link>
      </div>

      {going.data && going.data.length > 0 ? (
        <section aria-labelledby="continue-heading" className="space-y-2">
          <h2 id="continue-heading" className="text-sm font-semibold">
            Continue where you left off
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {going.data.map((lab) => (
              <li key={lab.questionId}>
                <Link
                  href={`/labs/${lab.slug}`}
                  className="flex h-full flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3 shadow-xs transition-colors hover:border-border-strong"
                >
                  <span className="flex items-center justify-between gap-2">
                    <LabTypeBadge type={lab.type} />
                    <LabStatus status={lab.status} />
                  </span>
                  <span className="font-medium text-foreground">{lab.title}</span>
                  <span className="text-xs text-muted-foreground">
                    Last worked on {formatDateTime(lab.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="catalogue-heading" className="space-y-3">
        <h2 id="catalogue-heading" className="sr-only">
          The catalogue
        </h2>
        <Tabs
          filter
          value={type}
          onValueChange={(value) => {
            setType(value);
            restart();
          }}
        >
          <TabsList aria-label="Kind of lab">
            <TabsTrigger value={ALL}>
              All{summary.data ? <Count n={summary.data.total} /> : null}
            </TabsTrigger>
            {LAB_TYPES.map((value) => (
              <TabsTrigger key={value} value={value}>
                {LAB_TYPE_META[value].label}
                {summary.data ? <Count n={summary.data.byType[value as LabType] ?? 0} /> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {type !== ALL ? (
          <p className="text-sm text-muted-foreground">{LAB_TYPE_META[type as LabType].blurb}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Search labs"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                restart();
              }}
              className="pl-9"
              aria-label="Search labs"
            />
          </div>
          <Select
            value={difficulty}
            onValueChange={(value) => {
              setDifficulty(value);
              restart();
            }}
          >
            <SelectTrigger className="w-36" aria-label="Filter by level">
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
          {summary.data && summary.data.topics.length > 0 ? (
            <Select
              value={topic}
              onValueChange={(value) => {
                setTopic(value);
                restart();
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
              restart();
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
            title={summary.data?.total === 0 ? 'No labs yet' : 'No labs match'}
            description={
              summary.data?.total === 0
                ? 'Labs appear here once your trainers publish them. The playground is open in the meantime.'
                : 'Clear a filter to see more.'
            }
            action={
              summary.data?.total === 0 ? (
                <Button asChild variant="outline">
                  <Link href="/labs/playground">Open the playground</Link>
                </Button>
              ) : undefined
            }
          />
        ) : null}

        {query.data && query.data.data.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Lab</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((lab) => (
                  <TableRow key={lab.questionId}>
                    <TableCell>
                      <Link
                        className="font-medium text-foreground hover:text-brand hover:underline"
                        href={`/labs/${lab.slug}`}
                      >
                        {lab.title}
                      </Link>
                      {lab.topic ? (
                        <span className="block text-xs text-muted-foreground">
                          {topicLabel(lab.topic)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <LabTypeBadge type={lab.type} />
                    </TableCell>
                    <TableCell>
                      <DifficultyBadge value={lab.difficulty} />
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {lab.languages.map((l) => (
                          <span
                            key={l}
                            className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-foreground-secondary"
                          >
                            {LANGUAGE_LABELS[l] ?? l}
                          </span>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{lab.points}</TableCell>
                    <TableCell>
                      <LabStatus status={lab.status} />
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
            noun="labs"
          />
        ) : null}
      </section>
    </div>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="ml-1 rounded-full bg-surface-2 px-1.5 text-[11px] text-muted-foreground tabular-nums">
      {n}
    </span>
  );
}

const STATUS_STYLE: Record<string, { className: string; icon: typeof CircleCheck }> = {
  solved: { className: 'bg-success-soft text-success', icon: CircleCheck },
  attempted: { className: 'bg-primary-soft text-brand', icon: CircleDot },
  not_attempted: { className: 'bg-surface-2 text-foreground-secondary', icon: Circle },
};

/** A lab's state as a chip with an icon and its word. */
export function LabStatus({ status }: { status: string }) {
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
