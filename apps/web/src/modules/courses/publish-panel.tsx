'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  BatchSummary,
  Paginated,
  ProgramSummary,
  PublicationRecord,
  PublicationScope,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { useCan } from '@/shell/me-context';
import { NativeSelect } from '@/components/ui/native-select';
import { formatDate } from '@/lib/format';

/** Who a course has been given to, and the controls to change that. */
export function PublishPanel({ courseId }: { courseId: string }) {
  const canPublish = useCan('courses:publish');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['course', courseId, 'publications'],
    queryFn: () => api<PublicationRecord[]>(`/courses/${courseId}/publications`),
  });

  const withdraw = useMutation({
    mutationFn: (publicationId: string) =>
      api<{ removed: number }>(`/courses/${courseId}/publications/${publicationId}`, {
        method: 'DELETE',
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(
        result.removed === 0
          ? 'Withdrawn. Everyone who had started keeps their progress.'
          : `Withdrawn from ${result.removed} learner${result.removed === 1 ? '' : 's'} who had not started.`,
      );
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The course could not be withdrawn'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Publishing enrols everyone the audience covers. Withdrawing removes only the learners who
          had not started.
        </p>
        {canPublish ? <PublishDialog courseId={courseId} /> : null}
      </div>

      {query.isPending ? <LoadingRows rows={3} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          title="Not published yet"
          description="Nobody can see this course. Publish it to a batch, a programme or the whole institute."
        />
      ) : null}

      {query.data && query.data.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Audience</TableHead>
                <TableHead className="text-right">Learners</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Note</TableHead>
                {canPublish ? <TableHead className="w-24" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((publication) => (
                <TableRow key={publication.id}>
                  <TableCell className="font-medium">{publication.scopeLabel}</TableCell>
                  <TableCell className="text-right tabular-nums">{publication.enrolled}</TableCell>
                  <TableCell>{formatDate(publication.publishedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{publication.note || '—'}</TableCell>
                  {canPublish ? (
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={withdraw.isPending}
                        onClick={() => withdraw.mutate(publication.id)}
                      >
                        Withdraw
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

function PublishDialog({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [scopeType, setScopeType] = useState<PublicationScope>('batch');
  const [scopeId, setScopeId] = useState('');
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const batches = useQuery({
    queryKey: ['batches', 'options'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
    enabled: open,
  });
  const programs = useQuery({
    queryKey: ['programs', 'options'],
    queryFn: () => api<Paginated<ProgramSummary>>('/programs?pageSize=100'),
    enabled: open,
  });

  const publish = useMutation({
    mutationFn: () =>
      api<PublicationRecord>(`/courses/${courseId}/publish`, {
        method: 'POST',
        body: { scopeType, scopeId: scopeType === 'all' ? null : scopeId, note },
      }),
    onSuccess: async (publication) => {
      await queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      setOpen(false);
      setNote('');
      toast.success(
        `Published to ${publication.scopeLabel}: ${publication.enrolled} learner${
          publication.enrolled === 1 ? '' : 's'
        } enrolled.`,
      );
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The course could not be published'),
  });

  const options =
    scopeType === 'batch'
      ? (batches.data?.data ?? []).map((b) => ({ id: b.id, label: `${b.code} — ${b.name}` }))
      : (programs.data?.data ?? []).map((p) => ({ id: p.id, label: `${p.code} — ${p.name}` }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Publish</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish this course</DialogTitle>
          <DialogDescription>
            Everyone in the audience is enrolled straight away and told about it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="publish-scope">Audience</Label>
            <NativeSelect
              id="publish-scope"
              className="w-full"
              value={scopeType}
              onChange={(e) => {
                setScopeType(e.target.value as PublicationScope);
                setScopeId('');
              }}
            >
              <option value="batch">One batch</option>
              <option value="program">A whole programme</option>
              <option value="all">Everyone at the institute</option>
            </NativeSelect>
          </div>
          {scopeType === 'all' ? null : (
            <div className="space-y-2">
              <Label htmlFor="publish-target">
                {scopeType === 'batch' ? 'Batch' : 'Programme'}
              </Label>
              <NativeSelect
                id="publish-target"
                className="w-full"
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
              >
                <option value="">Choose one</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="publish-note">Note (optional)</Label>
            <Input
              id="publish-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What changed in this release"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={publish.isPending || (scopeType !== 'all' && !scopeId)}
            onClick={() => publish.mutate()}
          >
            {publish.isPending ? 'Publishing…' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
