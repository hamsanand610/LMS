'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  DIFFICULTY_LABELS,
  QUESTION_DIFFICULTIES,
  QUESTION_STATUSES,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type Paginated,
  type QuestionSummary,
  type TaxonomyTerm,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
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
import { useCan } from '@/shell/me-context';

const ALL = 'all';

/** The bank. `basePath` differs per portal; a trainer only ever sees their own questions. */
export function QuestionsTable({ basePath = '/admin/question-bank' }: { basePath?: string }) {
  const canImport = useCan('questions:import');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [type, setType] = useState(ALL);
  const [subject, setSubject] = useState(ALL);
  const [difficulty, setDifficulty] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (type !== ALL) params.set('type', type);
  if (subject !== ALL) params.set('subject', subject);
  if (difficulty !== ALL) params.set('difficulty', difficulty);
  if (status !== ALL) params.set('status', status);

  const query = useQuery({
    queryKey: ['questions', params.toString()],
    queryFn: () => api<Paginated<QuestionSummary>>(`/questions?${params.toString()}`),
  });
  const subjects = useQuery({
    queryKey: ['taxonomy', 'subject'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/subject/terms'),
  });
  const subjectLabel = (key: string) =>
    key ? (subjects.data?.find((term) => term.key === key)?.label ?? key) : '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Search questions"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          wrapperClassName="w-full max-w-xs"
          aria-label="Search questions"
        />
        <Select
          value={type}
          onValueChange={(value) => {
            setType(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by type">
            <SelectValue placeholder="Any type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any type</SelectItem>
            {QUESTION_TYPES.map((value) => (
              <SelectItem key={value} value={value}>
                {QUESTION_TYPE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={subject}
          onValueChange={(value) => {
            setSubject(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by technology">
            <SelectValue placeholder="Any technology" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any technology</SelectItem>
            {(subjects.data ?? []).map((term) => (
              <SelectItem key={term.key} value={term.key}>
                {term.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36" aria-label="Filter by status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            {QUESTION_STATUSES.map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          {canImport ? (
            <Button variant="outline" asChild>
              <Link href={`${basePath}/import`}>Import</Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href={`${basePath}/new`}>New question</Link>
          </Button>
        </div>
      </div>

      {query.isPending ? <LoadingRows /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No questions yet"
          description="Write one, or import a sheet of multiple-choice questions."
          action={
            <Button asChild>
              <Link href={`${basePath}/new`}>New question</Link>
            </Button>
          }
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Technology</TableHead>
                <TableHead>Level</TableHead>
                <TableHead className="text-right">Marks</TableHead>
                <TableHead className="text-right">Used by</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((question) => (
                <TableRow key={question.id}>
                  <TableCell>
                    <Link
                      className="font-medium hover:underline"
                      href={`${basePath}/${question.id}`}
                    >
                      {question.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      v{question.version}
                      {question.authorName ? ` · ${question.authorName}` : ''}
                    </p>
                  </TableCell>
                  <TableCell>{QUESTION_TYPE_LABELS[question.type]}</TableCell>
                  <TableCell>{subjectLabel(question.subject)}</TableCell>
                  <TableCell>{DIFFICULTY_LABELS[question.difficulty]}</TableCell>
                  <TableCell className="text-right tabular-nums">{question.marks}</TableCell>
                  <TableCell className="text-right tabular-nums">{question.usageCount}</TableCell>
                  <TableCell>
                    <StatusBadge status={question.status} />
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
          noun="questions"
        />
      ) : null}
    </div>
  );
}
