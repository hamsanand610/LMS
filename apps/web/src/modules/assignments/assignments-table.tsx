'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ASSIGNMENT_STATUSES,
  type AssignmentSummary,
  type Paginated,
  type TaxonomyTerm,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';

const ALL = 'all';

export function AssignmentsTable({ basePath = '/admin/assignments' }: { basePath?: string }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(ALL);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (status !== ALL) params.set('status', status);

  const query = useQuery({
    queryKey: ['assignments', params.toString()],
    queryFn: () => api<Paginated<AssignmentSummary>>(`/assignments?${params.toString()}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search assignments"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
          aria-label="Search assignments"
        />
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
            {ASSIGNMENT_STATUSES.map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <NewAssignmentDialog basePath={basePath} />
      </div>

      {query.isPending ? <LoadingRows /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="An assignment is a set of questions from the bank, grouped into modules and given to a batch."
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assignment</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Modules</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead className="text-right">Marks</TableHead>
                <TableHead className="text-right">Batches</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <Link
                      className="font-medium hover:underline"
                      href={`${basePath}/${assignment.id}`}
                    >
                      {assignment.title}
                    </Link>
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {assignment.description}
                    </p>
                  </TableCell>
                  <TableCell className="capitalize">{assignment.subject || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {assignment.moduleCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {assignment.questionCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{assignment.totalMarks}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {assignment.publicationCount}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={assignment.status} />
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
          noun="assignments"
        />
      ) : null}
    </div>
  );
}

function NewAssignmentDialog({ basePath }: { basePath: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const router = useRouter();
  const queryClient = useQueryClient();

  const subjects = useQuery({
    queryKey: ['taxonomy', 'subject'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/subject/terms'),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      api<AssignmentSummary>('/assignments', {
        method: 'POST',
        body: { title, description, subject },
      }),
    onSuccess: async (assignment) => {
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setOpen(false);
      setTitle('');
      toast.success(`${assignment.title} created`);
      router.push(`${basePath}/${assignment.id}`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The assignment could not be created'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="ml-auto">New assignment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New assignment</DialogTitle>
          <DialogDescription>Name it now; the questions come next.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assignment-title">Title</Label>
            <Input id="assignment-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignment-description">Description</Label>
            <Textarea
              id="assignment-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignment-subject">Subject</Label>
            <select
              id="assignment-subject"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">Not set</option>
              {(subjects.data ?? []).map((term) => (
                <option key={term.key} value={term.key}>
                  {term.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={create.isPending || title.length < 3} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating…' : 'Create assignment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
