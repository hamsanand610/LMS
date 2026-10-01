'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { type Paginated, programCreateSchema, type ProgramSummary } from '@lms/shared';
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
import { SearchInput } from '@/components/ui/search-input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { useCan } from '@/shell/me-context';

export function ProgramsTable() {
  const queryClient = useQueryClient();
  const canManage = useCan('programs:manage');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);

  const query = useQuery({
    queryKey: ['programs', params.toString()],
    queryFn: () => api<Paginated<ProgramSummary>>(`/programs?${params.toString()}`),
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      api(`/programs/${id}`, { method: 'PATCH', body: { status: 'archived' } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.success('Programme archived');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not archive the programme'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Search name or code"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          wrapperClassName="w-full max-w-xs"
          aria-label="Search programmes"
        />
        <div className="flex-1" />
        {canManage ? <NewProgramDialog /> : null}
      </div>

      {query.isPending ? (
        <LoadingRows rows={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title="No programmes yet"
          description="A programme is the curriculum template a batch runs. Create one before adding batches."
          action={canManage ? <NewProgramDialog /> : null}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Programme</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Batches</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell>
                      <p className="font-medium">{program.name}</p>
                      {program.description ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {program.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{program.code}</TableCell>
                    <TableCell className="tabular-nums">{program.durationWeeks} weeks</TableCell>
                    <TableCell className="tabular-nums">{program.batchCount}</TableCell>
                    <TableCell>
                      <StatusBadge status={program.status} />
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        {program.status === 'active' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={archive.isPending}
                            onClick={() => archive.mutate(program.id)}
                          >
                            Archive
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
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
            noun="programmes"
          />
        </>
      )}
    </div>
  );
}

type Values = z.infer<typeof programCreateSchema>;

function NewProgramDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<z.input<typeof programCreateSchema>, unknown, Values>({
    resolver: zodResolver(programCreateSchema),
    defaultValues: { code: '', name: '', durationWeeks: 24, description: '' },
  });

  const create = useMutation({
    mutationFn: (values: Values) => api<ProgramSummary>('/programs', { body: values }),
    onSuccess: (program) => {
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.success(`Programme ${program.code} created`);
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'code_taken') {
        form.setError('code', { message: error.message });
      } else {
        toast.error(isApiError(error) ? error.message : 'Could not create the programme');
      }
    },
  });

  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New programme</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate>
          <DialogHeader>
            <DialogTitle>Create a programme</DialogTitle>
            <DialogDescription>
              Batches are created from a programme and inherit its length.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="program-code">Code</Label>
              <Input id="program-code" placeholder="JFS" {...form.register('code')} />
              <FieldError message={errors.code?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-name">Name</Label>
              <Input id="program-name" placeholder="Java Full-Stack" {...form.register('name')} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-weeks">Duration (weeks)</Label>
              <Input
                id="program-weeks"
                type="number"
                min={1}
                max={260}
                {...form.register('durationWeeks', { valueAsNumber: true })}
              />
              <FieldError message={errors.durationWeeks?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-description">Description</Label>
              <Textarea id="program-description" rows={3} {...form.register('description')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create programme'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
