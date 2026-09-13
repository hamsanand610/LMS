'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  BATCH_MODES,
  BATCH_STATUSES,
  batchCreateSchema,
  type BatchSummary,
  type Paginated,
  type ProgramSummary,
} from '@lms/shared';
import { FieldError } from '@/components/field-error';
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
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { useCan } from '@/shell/me-context';

const ALL = 'all';

/** `basePath` differs per portal: admins manage batches, trainers only read their own. */
export function BatchesTable({ basePath = '/admin/batches' }: { basePath?: string }) {
  const canManage = useCan('batches:manage');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(ALL);
  const [programId, setProgramId] = useState(ALL);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (status !== ALL) params.set('status', status);
  if (programId !== ALL) params.set('programId', programId);

  const query = useQuery({
    queryKey: ['batches', params.toString()],
    queryFn: () => api<Paginated<BatchSummary>>(`/batches?${params.toString()}`),
  });
  const programs = useQuery({
    queryKey: ['programs', 'options'],
    queryFn: () => api<Paginated<ProgramSummary>>('/programs?pageSize=100'),
    enabled: canManage,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name or code"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
          aria-label="Search batches"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {BATCH_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManage ? (
          <Select
            value={programId}
            onValueChange={(v) => {
              setProgramId(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-52" aria-label="Filter by programme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All programmes</SelectItem>
              {(programs.data?.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <div className="flex-1" />
        {canManage ? <NewBatchDialog programs={programs.data?.data ?? []} /> : null}
      </div>

      {query.isPending ? (
        <LoadingRows rows={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title={canManage ? 'No batches yet' : 'You are not assigned to a batch'}
          description={
            canManage
              ? 'A batch is a cohort running a programme between two dates.'
              : 'Once an administrator assigns you to a batch it appears here.'
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Programme</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Trainers</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <Link
                        href={`${basePath}/${batch.id}`}
                        className="font-medium hover:underline"
                      >
                        {batch.code}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {batch.name} · {batch.mode}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{batch.program.name}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {batch.startDate} → {batch.endDate}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {batch.studentCount}
                      <span className="text-xs text-muted-foreground"> / {batch.capacity}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{batch.trainerCount}</TableCell>
                    <TableCell>
                      <StatusBadge status={batch.status} />
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
            noun="batches"
          />
        </>
      )}
    </div>
  );
}

type Values = z.infer<typeof batchCreateSchema>;

function NewBatchDialog({ programs }: { programs: ProgramSummary[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const active = programs.filter((p) => p.status === 'active');
  const form = useForm<z.input<typeof batchCreateSchema>, unknown, Values>({
    resolver: zodResolver(batchCreateSchema),
    defaultValues: {
      programId: '',
      code: '',
      name: '',
      mode: 'offline',
      startDate: '',
      endDate: '',
      capacity: 60,
      custom: {},
    },
  });

  const create = useMutation({
    mutationFn: (values: Values) => api<BatchSummary>('/batches', { body: values }),
    onSuccess: (batch) => {
      void queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success(`Batch ${batch.code} created`);
      setOpen(false);
      form.reset();
      router.push(`/admin/batches/${batch.id}`);
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'code_taken')
        form.setError('code', { message: error.message });
      else if (isApiError(error) && error.problem?.errors?.length) {
        for (const issue of error.problem.errors) {
          form.setError(issue.path as keyof Values, { message: issue.message });
        }
      } else {
        toast.error(isApiError(error) ? error.message : 'Could not create the batch');
      }
    },
  });

  const [programValue, modeValue] = useWatch({
    control: form.control,
    name: ['programId', 'mode'],
  });
  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={active.length === 0}>New batch</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate>
          <DialogHeader>
            <DialogTitle>Create a batch</DialogTitle>
            <DialogDescription>
              Add students and trainers next; the batch starts when you set it to running.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4">
            <div className="space-y-2">
              <Label>Programme</Label>
              <Select
                value={programValue}
                onValueChange={(v) => form.setValue('programId', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a programme" />
                </SelectTrigger>
                <SelectContent>
                  {active.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.programId?.message} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="batch-code">Code</Label>
                <Input id="batch-code" placeholder="JFS-2026-B1" {...form.register('code')} />
                <FieldError message={errors.code?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-name">Name</Label>
                <Input
                  id="batch-name"
                  placeholder="Java Full-Stack 2026 — Batch 1"
                  {...form.register('name')}
                />
                <FieldError message={errors.name?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-start">Start date</Label>
                <Input id="batch-start" type="date" {...form.register('startDate')} />
                <FieldError message={errors.startDate?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-end">End date</Label>
                <Input id="batch-end" type="date" {...form.register('endDate')} />
                <FieldError message={errors.endDate?.message} />
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select
                  value={modeValue ?? 'offline'}
                  onValueChange={(v) => form.setValue('mode', v as Values['mode'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BATCH_MODES.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-capacity">Capacity</Label>
                <Input
                  id="batch-capacity"
                  type="number"
                  min={1}
                  max={1000}
                  {...form.register('capacity', { valueAsNumber: true })}
                />
                <FieldError message={errors.capacity?.message} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create batch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
