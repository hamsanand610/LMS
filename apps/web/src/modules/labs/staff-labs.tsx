'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleDashed, Eye, Pencil, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  DIFFICULTY_LABELS,
  LAB_TYPES,
  type LabSummary,
  type LabType,
  type Paginated,
  type QuestionSummary,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/native-select';
import { SearchInput } from '@/components/ui/search-input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { formatDate } from '@/lib/format';
import { useCan } from '@/shell/me-context';
import { LAB_TYPE_META, LabTypeBadge } from './lab-types';

const ALL = 'all';

/**
 * Labs for staff (ADR-0018): the labs a trainer wrote (an administrator sees them all), where each
 * stands — published, checked, in the catalogue, placed in lessons — and how learners within the
 * viewer's scope are doing with it. Authors put their own checked labs in the catalogue here.
 */
export function StaffLabs({ basePath, questionBase }: { basePath: string; questionBase: string }) {
  const queryClient = useQueryClient();
  const canPublish = useCan('practice:publish_own');
  const canReview = useCan('practice:review');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [type, setType] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [catalogue, setCatalogue] = useState(ALL);
  const [mine, setMine] = useState(false);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (type !== ALL) params.set('type', type);
  if (status !== ALL) params.set('status', status);
  if (catalogue !== ALL) params.set('catalogue', catalogue);
  if (mine) params.set('author', 'me');
  const query = useQuery({
    queryKey: ['labs', 'staff', params.toString()],
    queryFn: () => api<Paginated<LabSummary>>(`/practice/labs?${params.toString()}`),
  });

  const listing = useMutation({
    mutationFn: (lab: LabSummary) =>
      api<QuestionSummary>(`/practice/labs/${lab.questionId}/catalogue`, {
        method: 'POST',
        body: { inCatalogue: !lab.inCatalogue, points: lab.points || 10 },
      }),
    onSuccess: async (_, lab) => {
      toast.success(lab.inCatalogue ? 'Taken out of the Labs' : 'In the Labs catalogue');
      await queryClient.invalidateQueries({ queryKey: ['labs', 'staff'] });
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'That could not be changed just now'),
  });

  const restart = () => setPage(1);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Search labs"
          aria-label="Search labs"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            restart();
          }}
          wrapperClassName="w-full sm:w-64"
        />
        <NativeSelect
          className="w-auto"
          aria-label="Kind of lab"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            restart();
          }}
        >
          <option value={ALL}>Every kind</option>
          {LAB_TYPES.map((value) => (
            <option key={value} value={value}>
              {LAB_TYPE_META[value as LabType].label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          className="w-auto"
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            restart();
          }}
        >
          <option value={ALL}>Any status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="retired">Retired</option>
        </NativeSelect>
        <NativeSelect
          className="w-auto"
          aria-label="In the catalogue"
          value={catalogue}
          onChange={(e) => {
            setCatalogue(e.target.value);
            restart();
          }}
        >
          <option value={ALL}>In the catalogue or not</option>
          <option value="in">In the catalogue</option>
          <option value="out">Not in the catalogue</option>
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={mine}
            onCheckedChange={(checked) => {
              setMine(checked === true);
              restart();
            }}
          />
          Only mine
        </label>
        <div className="ml-auto flex gap-2">
          {(['coding', 'debugging', 'web'] as const).map((kind) => (
            <Button key={kind} asChild variant={kind === 'web' ? 'default' : 'outline'} size="sm">
              <Link href={`${questionBase}/new?type=${kind}`}>
                <Plus aria-hidden="true" />
                {LAB_TYPE_META[kind].label} lab
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {query.isPending ? <LoadingRows /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No labs here"
          description="A lab is a coding, SQL, debugging or web question. Write one, check its reference solution in the sandbox, publish it, then put it in the Labs or in a course lesson."
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Lab</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Catalogue</TableHead>
                <TableHead className="text-right">Lessons</TableHead>
                {canReview ? <TableHead className="text-right">Learners</TableHead> : null}
                <TableHead>Updated</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((lab) => {
                const listable = lab.status === 'published' && lab.validated;
                return (
                  <TableRow key={lab.questionId}>
                    <TableCell>
                      <Link
                        href={`${basePath}/${lab.questionId}/preview`}
                        className="block font-medium hover:text-brand hover:underline"
                      >
                        {lab.title}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {DIFFICULTY_LABELS[lab.difficulty] ?? lab.difficulty}
                        {lab.authorName ? ` · by ${lab.authorName}` : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <LabTypeBadge type={lab.type} />
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-col items-start gap-1">
                        <StatusBadge status={lab.status} />
                        <span
                          className={
                            lab.validated
                              ? 'inline-flex items-center gap-1 text-xs text-success'
                              : 'inline-flex items-center gap-1 text-xs text-muted-foreground'
                          }
                        >
                          {lab.validated ? (
                            <CircleCheck className="size-3.5" aria-hidden="true" />
                          ) : (
                            <CircleDashed className="size-3.5" aria-hidden="true" />
                          )}
                          {lab.validated ? 'Checked' : 'Not checked'}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      {lab.inCatalogue ? (
                        <span className="text-sm">In, {lab.points} points</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not listed</span>
                      )}
                      {canPublish && lab.canEdit && (listable || lab.inCatalogue) ? (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="block h-auto px-0"
                          disabled={listing.isPending}
                          onClick={() => listing.mutate(lab)}
                        >
                          {lab.inCatalogue ? 'Take out' : 'Put in the Labs'}
                        </Button>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{lab.lessonCount}</TableCell>
                    {canReview ? (
                      <TableCell className="text-right tabular-nums">
                        {!lab.attempts
                          ? '—'
                          : lab.attempts.learners === 0
                            ? 'None yet'
                            : `${lab.attempts.solved} of ${lab.attempts.learners} solved`}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(lab.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <span className="flex justify-end gap-0.5">
                        <RowAction
                          href={`${basePath}/${lab.questionId}/preview`}
                          label={`Preview ${lab.title}`}
                          tip="Preview as a learner"
                          icon={Eye}
                        />
                        {canReview ? (
                          <RowAction
                            href={`${basePath}/${lab.questionId}/attempts`}
                            label={`Attempts at ${lab.title}`}
                            tip="Learners’ attempts"
                            icon={Users}
                          />
                        ) : null}
                        {lab.canEdit ? (
                          <RowAction
                            href={`${questionBase}/${lab.questionId}`}
                            label={`Edit ${lab.title}`}
                            tip="Edit"
                            icon={Pencil}
                          />
                        ) : null}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
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
    </div>
  );
}

function RowAction({
  href,
  label,
  tip,
  icon: Icon,
}: {
  href: string;
  label: string;
  tip: string;
  icon: typeof Eye;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="icon-sm">
          <Link href={href} aria-label={label}>
            <Icon aria-hidden="true" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}
