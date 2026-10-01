'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  assignmentPublishSchema,
  type AssignmentPublicationRecord,
  type BatchSummary,
  type Paginated,
  type StudentSummary,
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { SearchInput } from '@/components/ui/search-input';
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
import { formatDate, formatDateTime, plural } from '@/lib/format';
import { useCan } from '@/shell/me-context';

type Audience = 'batch' | 'learners';

/** A `datetime-local` value in the browser's time, as an ISO instant; empty means none. */
function toInstant(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function Dates({ record }: { record: AssignmentPublicationRecord }) {
  return (
    <>
      <TableCell className="text-xs tabular-nums">
        {record.opensAt ? formatDateTime(record.opensAt) : 'At once'}
      </TableCell>
      <TableCell className="text-xs tabular-nums">
        {record.dueAt ? formatDateTime(record.dueAt) : 'No date'}
      </TableCell>
      <TableCell className="text-xs tabular-nums">
        {record.closesAt ? formatDateTime(record.closesAt) : '—'}
      </TableCell>
    </>
  );
}

/**
 * Who has the assignment and when it is due. It can go to a whole batch or to named learners
 * (a make-up, an extension); each audience has its own dates, and withdrawing keeps the answers.
 */
export function PublishPanel({
  assignmentId,
  hasQuestions,
}: {
  assignmentId: string;
  hasQuestions: boolean;
}) {
  const canPublish = useCan('assignments:publish');
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Audience | null>(null);

  const query = useQuery({
    queryKey: ['assignment', assignmentId, 'publications'],
    queryFn: () => api<AssignmentPublicationRecord[]>(`/assignments/${assignmentId}/publications`),
  });

  const withdraw = useMutation({
    mutationFn: (publicationId: string) =>
      api(`/assignments/${assignmentId}/publications/${publicationId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] });
      toast.success('Withdrawn. Answers already given are kept.');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'It could not be withdrawn'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Publishing puts the assignment in the learners’ list and tells them about it. Each
          audience keeps its own opening, due and closing dates.
        </p>
        {canPublish ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!hasQuestions}
              onClick={() => setDialog('learners')}
            >
              <UserPlus aria-hidden="true" />
              Give to named learners
            </Button>
            <Button disabled={!hasQuestions} onClick={() => setDialog('batch')}>
              <Users aria-hidden="true" />
              Publish to a batch
            </Button>
          </div>
        ) : null}
      </div>
      {!hasQuestions ? (
        <p className="text-sm text-warning">
          Add questions on the Structure tab before publishing.
        </p>
      ) : null}

      {query.isPending ? <LoadingRows rows={3} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          title="Not given to anybody yet"
          description="Publish it to a batch, or to named learners, and it appears in their assignments."
        />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Audience</TableHead>
                <TableHead className="text-right">Learners</TableHead>
                <TableHead>Opens</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Closes</TableHead>
                <TableHead>Published</TableHead>
                {canPublish ? <TableHead className="w-28" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {record.audience === 'batch' ? (
                      <>
                        {record.batchCode} — {record.batchName}
                      </>
                    ) : (
                      <>
                        {record.studentName}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {record.studentCode} · one learner
                        </span>
                      </>
                    )}
                    {record.note ? (
                      <p className="text-xs font-normal text-muted-foreground">{record.note}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{record.learners}</TableCell>
                  <Dates record={record} />
                  <TableCell className="text-xs tabular-nums">
                    {formatDate(record.publishedAt)}
                  </TableCell>
                  {canPublish ? (
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={withdraw.isPending}
                        onClick={() => withdraw.mutate(record.id)}
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

      {dialog ? (
        <PublishDialog
          assignmentId={assignmentId}
          audience={dialog}
          onAudienceChange={setDialog}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function PublishDialog({
  assignmentId,
  audience,
  onAudienceChange,
  onClose,
}: {
  assignmentId: string;
  audience: Audience;
  onAudienceChange: (audience: Audience) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [batchId, setBatchId] = useState('');
  const [learners, setLearners] = useState<StudentSummary[]>([]);
  const [opensAt, setOpensAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const batches = useQuery({
    queryKey: ['batches', 'options'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
  });

  const publish = useMutation({
    mutationFn: (body: unknown) =>
      api<AssignmentPublicationRecord[]>(`/assignments/${assignmentId}/publish`, {
        method: 'POST',
        body,
      }),
    onSuccess: async (records) => {
      await queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] });
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      const reached = records.reduce((sum, record) => sum + record.learners, 0);
      toast.success(
        records.length === 1 && records[0]!.audience === 'batch'
          ? `Given to ${records[0]!.batchCode}: ${plural(reached, 'learner')}.`
          : `Given to ${plural(reached, 'learner')}.`,
      );
      onClose();
    },
    onError: (error) =>
      setProblem(isApiError(error) ? error.message : 'The assignment could not be published'),
  });

  const submit = () => {
    const candidate = {
      batchId: audience === 'batch' ? batchId || null : null,
      studentIds: audience === 'learners' ? learners.map((l) => l.id) : [],
      opensAt: toInstant(opensAt),
      dueAt: toInstant(dueAt),
      closesAt: toInstant(closesAt),
      note: note.trim(),
    };
    const parsed = assignmentPublishSchema.safeParse(candidate);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? 'Check the dates');
      return;
    }
    setProblem(null);
    publish.mutate(parsed.data);
  };

  const ready = audience === 'batch' ? batchId !== '' : learners.length > 0;

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish this assignment</DialogTitle>
          <DialogDescription>
            {audience === 'batch'
              ? 'Everyone in the batch gets it, and is told about it.'
              : 'Only the learners you pick get it, with their own dates.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            role="radiogroup"
            aria-label="Who gets it"
            className="inline-flex rounded-lg bg-surface-2 p-1 text-sm"
          >
            {(['batch', 'learners'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={audience === value}
                onClick={() => onAudienceChange(value)}
                className={
                  audience === value
                    ? 'rounded-md bg-surface px-3 py-1.5 font-medium text-foreground shadow-sm'
                    : 'rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground'
                }
              >
                {value === 'batch' ? 'A batch' : 'Named learners'}
              </button>
            ))}
          </div>

          {audience === 'batch' ? (
            <div className="space-y-2">
              <Label htmlFor="publish-batch">Batch</Label>
              <NativeSelect
                id="publish-batch"
                className="w-full"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
              >
                <option value="">Choose a batch</option>
                {(batches.data?.data ?? [])
                  .filter((batch) => batch.status !== 'archived')
                  .map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.code} — {batch.name}
                    </option>
                  ))}
              </NativeSelect>
            </div>
          ) : (
            <LearnerPicker chosen={learners} onChange={setLearners} />
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="publish-opens">Opens</Label>
              <Input
                id="publish-opens"
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-due">Due date (optional)</Label>
              <Input
                id="publish-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-closes">Closes</Label>
              <Input
                id="publish-closes"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Left empty, it opens now, has no due date, and takes late answers as the late rule
            allows. After it closes nothing more can be submitted.
          </p>
          <div className="space-y-2">
            <Label htmlFor="publish-note">Note to the learners (optional)</Label>
            <Textarea
              id="publish-note"
              rows={2}
              maxLength={240}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {problem ? (
            <p role="alert" className="text-sm text-danger">
              {problem}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!ready || publish.isPending} onClick={submit}>
            {publish.isPending ? 'Publishing…' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LearnerPicker({
  chosen,
  onChange,
}: {
  chosen: StudentSummary[];
  onChange: (learners: StudentSummary[]) => void;
}) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(text.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [text]);

  const results = useQuery({
    queryKey: ['students', 'picker', q],
    queryFn: () =>
      api<Paginated<StudentSummary>>(`/students?pageSize=8&q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  });
  const chosenIds = new Set(chosen.map((l) => l.id));

  return (
    <div className="space-y-2">
      <Label htmlFor="publish-learner-search">Learners</Label>
      <SearchInput
        id="publish-learner-search"
        placeholder="Name or learner code"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
      />
      {q.length >= 2 ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto" aria-label="Matching learners">
          {(results.data?.data ?? []).map((learner) => (
            <li
              key={learner.id}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {learner.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {learner.studentCode}
                  {learner.batches[0] ? ` · ${learner.batches[0].code}` : ''}
                </span>
              </span>
              <Button
                size="xs"
                variant={chosenIds.has(learner.id) ? 'ghost' : 'outline'}
                disabled={chosenIds.has(learner.id) || chosen.length >= 200}
                onClick={() => onChange([...chosen, learner])}
              >
                {chosenIds.has(learner.id) ? 'Added' : 'Add'}
              </Button>
            </li>
          ))}
          {results.data && results.data.data.length === 0 ? (
            <li className="text-sm text-muted-foreground">Nobody matches.</li>
          ) : null}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Type two or more letters to search.</p>
      )}
      {chosen.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Chosen learners">
          {chosen.map((learner) => (
            <li
              key={learner.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pr-1 pl-2.5 text-xs text-brand"
            >
              {learner.name}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-primary/10"
                aria-label={`Remove ${learner.name}`}
                onClick={() => onChange(chosen.filter((l) => l.id !== learner.id))}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
