'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { TEST_KINDS, TEST_STATUSES, type Paginated, type TestSummary } from '@lms/shared';
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
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';

const ALL = 'all';

export function TestsTable({ basePath = '/admin/tests' }: { basePath?: string }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(ALL);
  const [kind, setKind] = useState(ALL);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (status !== ALL) params.set('status', status);
  if (kind !== ALL) params.set('kind', kind);

  const query = useQuery({
    queryKey: ['tests', params.toString()],
    queryFn: () => api<Paginated<TestSummary>>(`/tests?${params.toString()}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search tests"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
          aria-label="Search tests"
        />
        <Select
          value={kind}
          onValueChange={(value) => {
            setKind(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36" aria-label="Filter by kind">
            <SelectValue placeholder="Any kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any kind</SelectItem>
            {TEST_KINDS.map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value}
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
            {TEST_STATUSES.map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <NewTestDialog basePath={basePath} />
      </div>

      {query.isPending ? <LoadingRows /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No tests yet"
          description="A test is a paper of sections and questions, opened to a batch for a window of time."
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Minutes</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead className="text-right">Marks</TableHead>
                <TableHead className="text-right">Windows</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((test) => (
                <TableRow key={test.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" href={`${basePath}/${test.id}`}>
                      {test.title}
                    </Link>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{test.description}</p>
                  </TableCell>
                  <TableCell className="capitalize">{test.kind}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {test.settings.durationMinutes}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{test.questionCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{test.totalMarks}</TableCell>
                  <TableCell className="text-right tabular-nums">{test.scheduleCount}</TableCell>
                  <TableCell>
                    <StatusBadge status={test.status} />
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
          noun="tests"
        />
      ) : null}
    </div>
  );
}

function NewTestDialog({ basePath }: { basePath: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('weekly');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const router = useRouter();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      api<TestSummary>('/tests', {
        method: 'POST',
        body: {
          title,
          kind,
          settings: {
            durationMinutes,
            maxAttempts: 1,
            shuffleQuestions: false,
            shuffleOptions: false,
            resultPolicy: 'on_release',
            reviewPolicy: 'full',
            trackTabSwitches: true,
            requireFullScreen: false,
            showRank: false,
          },
        },
      }),
    onSuccess: async (test) => {
      await queryClient.invalidateQueries({ queryKey: ['tests'] });
      setOpen(false);
      setTitle('');
      toast.success(`${test.title} created`);
      router.push(`${basePath}/${test.id}`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The test could not be created'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="ml-auto">New test</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New test</DialogTitle>
          <DialogDescription>
            Name it and set how long it runs; the paper comes next.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-title">Title</Label>
            <Input id="test-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="test-kind">Kind</Label>
              <select
                id="test-kind"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {TEST_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-duration">Minutes</Label>
              <Input
                id="test-duration"
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={create.isPending || title.length < 3} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating…' : 'Create test'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
