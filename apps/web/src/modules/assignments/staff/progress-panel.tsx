'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  AssignmentProgressRow,
  AssignmentPublicationRecord,
  LearnerAssignmentStatus,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { StatStrip } from '@/components/stat-strip';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { SearchInput } from '@/components/ui/search-input';
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
import { AssignmentStatusBadge } from '../status';

const DONE: LearnerAssignmentStatus[] = ['passed', 'completed'];
const UNDER_WAY: LearnerAssignmentStatus[] = ['in_progress', 'submitted', 'failed'];

type Sort = 'attention' | 'name' | 'score' | 'activity';

function sortRows(rows: AssignmentProgressRow[], sort: Sort): AssignmentProgressRow[] {
  const copy = [...rows];
  switch (sort) {
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'score':
      return copy.sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));
    case 'activity':
      return copy.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));
    default:
      // Who needs a word first: struggling, then overdue, then the least done.
      return copy.sort(
        (a, b) =>
          Number(b.struggling) - Number(a.struggling) ||
          Number(b.status === 'overdue') - Number(a.status === 'overdue') ||
          a.percentage - b.percentage ||
          a.name.localeCompare(b.name),
      );
  }
}

/** Every learner the assignment reaches in the caller's batches, and how far each has got. */
export function ProgressPanel({ assignmentId }: { assignmentId: string }) {
  const [batchId, setBatchId] = useState('');
  const [text, setText] = useState('');
  const [strugglingOnly, setStrugglingOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('attention');

  const publications = useQuery({
    queryKey: ['assignment', assignmentId, 'publications'],
    queryFn: () => api<AssignmentPublicationRecord[]>(`/assignments/${assignmentId}/publications`),
  });
  const query = useQuery({
    queryKey: ['assignment', assignmentId, 'progress', batchId],
    queryFn: () =>
      api<AssignmentProgressRow[]>(
        `/assignments/${assignmentId}/progress${batchId ? `?batchId=${batchId}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });

  const batches = useMemo(() => {
    const seen = new Map<string, string>();
    for (const record of publications.data ?? []) {
      if (record.batchId && record.batchCode)
        seen.set(record.batchId, `${record.batchCode} — ${record.batchName ?? ''}`);
    }
    return [...seen.entries()];
  }, [publications.data]);

  const rows = useMemo(() => {
    const needle = text.trim().toLowerCase();
    const filtered = (query.data ?? []).filter(
      (row) =>
        (!strugglingOnly || row.struggling) &&
        (!needle ||
          row.name.toLowerCase().includes(needle) ||
          row.studentCode.toLowerCase().includes(needle)),
    );
    return sortRows(filtered, sort);
  }, [query.data, text, strugglingOnly, sort]);

  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const all = query.data;
  if (all.length === 0 && !batchId) {
    return (
      <EmptyState
        title="Nobody has it yet"
        description="Publish the assignment to a batch or to named learners and their progress appears here."
      />
    );
  }

  const count = (statuses: LearnerAssignmentStatus[]) =>
    all.filter((row) => statuses.includes(row.status)).length;
  const struggling = all.filter((row) => row.struggling).length;
  const awaiting = all.reduce((sum, row) => sum + row.awaitingReview, 0);

  return (
    <div className="space-y-4">
      <StatStrip
        items={[
          { label: 'Learners', value: all.length },
          { label: 'Finished', value: count(DONE), tone: 'success' },
          { label: 'Under way', value: count(UNDER_WAY) },
          { label: 'Not started', value: count(['not_started', 'upcoming', 'locked']) },
          {
            label: 'Overdue',
            value: count(['overdue']),
            tone: count(['overdue']) > 0 ? 'danger' : 'default',
          },
          {
            label: 'Struggling',
            value: struggling,
            tone: struggling > 0 ? 'warning' : 'default',
            hint: awaiting > 0 ? `${awaiting} answers waiting for review` : undefined,
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          wrapperClassName="w-full sm:w-64"
          placeholder="Learner name or code"
          aria-label="Search learners"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {batches.length > 1 ? (
          <NativeSelect
            aria-label="Batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-56"
          >
            <option value="">Every batch</option>
            {batches.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        <NativeSelect
          aria-label="Sort learners"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="w-48"
        >
          <option value="attention">Needs attention first</option>
          <option value="name">Name</option>
          <option value="score">Score, highest first</option>
          <option value="activity">Most recently active</option>
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={strugglingOnly}
            onCheckedChange={(checked) => setStrugglingOnly(checked === true)}
          />
          Only learners who are struggling
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nobody matches these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-44">Solved</TableHead>
                <TableHead className="text-right">Marks</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead className="text-right">To review</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.studentId}>
                  <TableCell>
                    <span className="font-medium">{row.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{row.studentCode}</span>
                    {row.struggling ? (
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-warning">
                        <TriangleAlert className="size-3.5" aria-hidden="true" />
                        Struggling
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">{row.batchCode}</TableCell>
                  <TableCell>
                    <AssignmentStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={row.questionCount > 0 ? (row.solved / row.questionCount) * 100 : 0}
                        className="h-1.5 w-20"
                        aria-label={`${row.name}: ${row.solved} of ${row.questionCount} solved`}
                      />
                      <span className="text-xs tabular-nums">
                        {row.solved} / {row.questionCount}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.awardedMarks} / {row.totalMarks}
                    <span className="ml-1 text-xs text-muted-foreground">({row.percentage}%)</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.attempts}
                    {row.failedAttempts > 0 ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({row.failedAttempts} not passed)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.awaitingReview || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {row.lastActivityAt ? formatDateTime(row.lastActivityAt) : 'Not started'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
