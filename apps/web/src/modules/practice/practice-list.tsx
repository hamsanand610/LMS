'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  EXECUTION_LANGUAGES,
  LANGUAGE_LABELS,
  QUESTION_DIFFICULTIES,
  type Paginated,
  type PracticeProblemCard,
  type PracticeSummary,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (difficulty !== ALL) params.set('difficulty', difficulty);
  if (language !== ALL) params.set('language', language);
  if (status !== ALL) params.set('status', status);

  const query = useQuery({
    queryKey: ['practice', params.toString()],
    queryFn: () => api<Paginated<PracticeProblemCard>>(`/practice/problems?${params.toString()}`),
  });
  const summary = useQuery({
    queryKey: ['practice', 'summary'],
    queryFn: () => api<PracticeSummary>('/practice/summary'),
  });

  return (
    <div className="space-y-4">
      {summary.data ? (
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Solved" value={`${summary.data.solved} / ${summary.data.total}`} />
          <Stat label="Attempted" value={String(summary.data.attempted)} />
          <Stat label="Points" value={String(summary.data.points)} />
          <Stat
            label="Left to try"
            value={String(Math.max(0, summary.data.total - summary.data.solved))}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search problems"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
          aria-label="Search problems"
        />
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
              <SelectItem key={value} value={value} className="capitalize">
                {value}
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
          description="Practice problems are coding questions your institute has put in the catalogue."
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
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
                      className="font-medium hover:underline"
                      href={`/practice/${problem.slug}`}
                    >
                      {problem.title}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">{problem.difficulty}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {problem.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(', ')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{problem.points}</TableCell>
                  <TableCell className="text-right tabular-nums">{problem.attempts}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        problem.status === 'solved'
                          ? 'bg-success-soft text-success'
                          : problem.status === 'attempted'
                            ? 'bg-warning-soft text-warning'
                            : 'bg-muted text-muted-foreground'
                      }
                    >
                      {STATUS_LABELS[problem.status]}
                    </Badge>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
