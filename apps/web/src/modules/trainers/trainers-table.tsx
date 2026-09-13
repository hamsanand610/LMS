'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { emailSchema, mobileSchema, type Paginated, type TrainerSummary } from '@lms/shared';
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
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { useCan } from '@/shell/me-context';

const ALL = 'all';

export function TrainersTable() {
  const canManage = useCan('trainers:manage');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState(ALL);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (subject !== ALL) params.set('subject', subject);

  const query = useQuery({
    queryKey: ['trainers', params.toString()],
    queryFn: () => api<Paginated<TrainerSummary>>(`/trainers?${params.toString()}`),
  });
  const subjects = useQuery({
    queryKey: ['trainer-subjects'],
    queryFn: () => api<string[]>('/trainers/subjects'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name or email"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
          aria-label="Search trainers"
        />
        <Select
          value={subject}
          onValueChange={(v) => {
            setSubject(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48" aria-label="Filter by subject">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All subjects</SelectItem>
            {(subjects.data ?? []).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {canManage ? <NewTrainerDialog /> : null}
      </div>

      {query.isPending ? (
        <LoadingRows rows={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title="No trainers yet"
          description="Add the people who will teach; they receive an invitation to set a password."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Subjects</TableHead>
                  <TableHead>Batches</TableHead>
                  <TableHead>Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((trainer) => (
                  <TableRow key={trainer.id}>
                    <TableCell>
                      <Link
                        href={`/admin/trainers/${trainer.id}`}
                        className="font-medium hover:underline"
                      >
                        {trainer.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{trainer.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {trainer.subjects.length ? trainer.subjects.join(', ') : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">{trainer.batchCount}</TableCell>
                    <TableCell>
                      <StatusBadge status={trainer.accountStatus} />
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
            noun="trainers"
          />
        </>
      )}
    </div>
  );
}

const formSchema = z.object({
  name: z.string().trim().min(2, 'Enter the full name').max(120),
  email: emailSchema,
  mobile: z.union([mobileSchema, z.literal('')]),
  subjects: z.string(),
  headline: z.string().max(120),
  bio: z.string().max(1000),
});
type Values = z.infer<typeof formSchema>;

function NewTrainerDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '', mobile: '', subjects: '', headline: '', bio: '' },
  });

  const create = useMutation({
    mutationFn: (values: Values) =>
      api<TrainerSummary>('/trainers', {
        body: {
          name: values.name,
          email: values.email,
          mobile: values.mobile || undefined,
          subjects: values.subjects
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          headline: values.headline,
          bio: values.bio,
          sendInvitation: true,
        },
      }),
    onSuccess: (trainer) => {
      void queryClient.invalidateQueries({ queryKey: ['trainers'] });
      void queryClient.invalidateQueries({ queryKey: ['trainer-subjects'] });
      toast.success(`${trainer.name} added; an invitation is on its way`);
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      if (isApiError(error) && (error.code === 'email_taken' || error.code === 'trainer_exists')) {
        form.setError('email', { message: error.message });
      } else {
        toast.error(isApiError(error) ? error.message : 'Could not add the trainer');
      }
    },
  });

  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New trainer</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate>
          <DialogHeader>
            <DialogTitle>Add a trainer</DialogTitle>
            <DialogDescription>
              They receive an invitation and land in the trainer portal once they accept.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trainer-name">Full name</Label>
              <Input id="trainer-name" {...form.register('name')} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trainer-email">Email</Label>
              <Input id="trainer-email" type="email" {...form.register('email')} />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trainer-mobile">Mobile (optional)</Label>
              <Input id="trainer-mobile" placeholder="+919876543210" {...form.register('mobile')} />
              <FieldError message={errors.mobile?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trainer-subjects">Subjects (comma separated)</Label>
              <Input
                id="trainer-subjects"
                placeholder="Core Java, SQL"
                {...form.register('subjects')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trainer-headline">Headline</Label>
              <Input
                id="trainer-headline"
                placeholder="Core Java trainer"
                {...form.register('headline')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trainer-bio">Bio</Label>
              <Textarea id="trainer-bio" rows={3} {...form.register('bio')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add trainer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
