'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  formatDateTime,
  type BatchSummary,
  type FeedbackFormDetail,
  type FeedbackFormStatus,
  type FeedbackFormSummary,
  type FeedbackQuestionKind,
  type Paginated,
  type TrainerSummary,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
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
import { Switch } from '@/components/ui/switch';
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
import { useCan, useMe } from '@/shell/me-context';

export const FEEDBACK_STATUS: Record<FeedbackFormStatus, { label: string; tone: StatusTone }> = {
  scheduled: { label: 'Scheduled', tone: 'info' },
  open: { label: 'Open', tone: 'success' },
  between_rounds: { label: 'Next round Friday', tone: 'neutral' },
  closed: { label: 'Closed', tone: 'neutral' },
};

/**
 * Feedback forms for staff. An administrator sees and gives every form; a trainer sees the forms
 * about them, whose figures are theirs to read (F-18, D10).
 */
export function FeedbackForms({ basePath }: { basePath: string }) {
  const me = useMe();
  const canManage = useCan('feedback:manage');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['feedback', 'forms', page],
    queryFn: () => api<Paginated<FeedbackFormSummary>>(`/feedback/forms?page=${page}&pageSize=25`),
  });

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden /> New form
          </Button>
        </div>
      ) : null}
      {query.isPending ? <LoadingRows rows={4} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No feedback forms yet"
          description={
            canManage
              ? 'Give a batch a form, once or every week from Friday to Sunday. Answers are anonymous unless you say otherwise.'
              : 'Forms about you appear here; their figures show once five learners have answered.'
          }
        />
      ) : null}
      {query.data && query.data.data.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>About</TableHead>
                  <TableHead>Runs</TableHead>
                  <TableHead className="text-right">Answers</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" href={`${basePath}/${form.id}`}>
                        {form.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {form.anonymous ? 'Anonymous' : 'Named'}
                      </p>
                    </TableCell>
                    <TableCell>{form.batch.code}</TableCell>
                    <TableCell className="text-sm">
                      {[form.trainer?.name, form.course?.title].filter(Boolean).join(' · ') || '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {form.cadence === 'weekly' ? 'Every week, Friday to Sunday' : 'Once'}
                      <p className="text-muted-foreground">
                        from {formatDateTime(form.opensAt, { timeZone: me.organization.timezone })}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{form.responses}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={form.status}
                        label={FEEDBACK_STATUS[form.status].label}
                        tone={FEEDBACK_STATUS[form.status].tone}
                      />
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
            noun="forms"
          />
        </>
      ) : null}
      {canManage ? <NewFormDialog open={open} onOpenChange={setOpen} basePath={basePath} /> : null}
    </div>
  );
}

interface DraftQuestion {
  id: string;
  kind: FeedbackQuestionKind;
  prompt: string;
  required: boolean;
  options: string;
}

const STARTER: DraftQuestion[] = [
  {
    id: 'pace',
    kind: 'rating',
    prompt: 'How was the pace of this week?',
    required: true,
    options: '',
  },
  {
    id: 'clarity',
    kind: 'rating',
    prompt: 'How clear were the explanations?',
    required: true,
    options: '',
  },
  {
    id: 'comment',
    kind: 'text',
    prompt: 'Anything you would change?',
    required: false,
    options: '',
  },
];

function NewFormDialog({
  open,
  onOpenChange,
  basePath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basePath: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [batchId, setBatchId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [cadence, setCadence] = useState<'once' | 'weekly'>('weekly');
  const [opensAt, setOpensAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [closesAt, setClosesAt] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>(STARTER);

  const batches = useQuery({
    queryKey: ['batches', 'options'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
    enabled: open,
  });
  const trainers = useQuery({
    queryKey: ['trainers', 'options'],
    queryFn: () => api<Paginated<TrainerSummary>>('/trainers?pageSize=100'),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      api<FeedbackFormDetail>('/feedback/forms', {
        method: 'POST',
        body: {
          title,
          description,
          batchId,
          trainerId: trainerId || null,
          anonymous,
          cadence,
          opensAt: new Date(opensAt).toISOString(),
          closesAt: closesAt ? new Date(closesAt).toISOString() : null,
          questions: questions.map((q) => ({
            id: q.id,
            kind: q.kind,
            prompt: q.prompt,
            required: q.required,
            options:
              q.kind === 'choice'
                ? q.options
                    .split(',')
                    .map((o) => o.trim())
                    .filter(Boolean)
                : [],
          })),
        },
      }),
    onSuccess: async (form) => {
      await queryClient.invalidateQueries({ queryKey: ['feedback'] });
      onOpenChange(false);
      toast.success('The form is ready; its batch is told when it opens');
      router.push(`${basePath}/${form.id}`);
    },
    onError: (error) => {
      if (isApiError(error) && error.problem?.errors?.length) {
        toast.error(error.problem.errors.map((e) => e.message).join(' '));
      } else {
        toast.error(isApiError(error) ? error.message : 'The form could not be created');
      }
    },
  });

  const update = (index: number, patch: Partial<DraftQuestion>) =>
    setQuestions((current) => current.map((q, i) => (i === index ? { ...q, ...patch } : q)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New feedback form</DialogTitle>
          <DialogDescription>
            Its batch is told when each round opens. Figures appear once five learners answer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fb-title">Title</Label>
            <Input
              id="fb-title"
              value={title}
              maxLength={160}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-description">Introduction (optional)</Label>
            <Textarea
              id="fb-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fb-batch">Batch</Label>
              <NativeSelect
                id="fb-batch"
                className="w-full"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
              >
                <option value="">Choose a batch</option>
                {(batches.data?.data ?? []).map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.code} — {batch.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-trainer">About a trainer (optional)</Label>
              <NativeSelect
                id="fb-trainer"
                className="w-full"
                value={trainerId}
                onChange={(e) => setTrainerId(e.target.value)}
              >
                <option value="">Nobody in particular</option>
                {(trainers.data?.data ?? []).map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-cadence">Runs</Label>
              <NativeSelect
                id="fb-cadence"
                className="w-full"
                value={cadence}
                onChange={(e) => setCadence(e.target.value as 'once' | 'weekly')}
              >
                <option value="weekly">Every week, Friday to Sunday</option>
                <option value="once">Once</option>
              </NativeSelect>
            </div>
            <div className="flex items-end gap-3 pb-1">
              <Switch id="fb-anonymous" checked={anonymous} onCheckedChange={setAnonymous} />
              <Label htmlFor="fb-anonymous">Anonymous answers</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-opens">{cadence === 'weekly' ? 'Starts from' : 'Opens'}</Label>
              <Input
                id="fb-opens"
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-closes">
                {cadence === 'weekly' ? 'Stops after (optional)' : 'Closes'}
              </Label>
              <Input
                id="fb-closes"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Questions</Label>
            {questions.map((question, index) => (
              <div key={question.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <NativeSelect
                    aria-label={`Question ${index + 1} kind`}
                    value={question.kind}
                    onChange={(e) =>
                      update(index, { kind: e.target.value as FeedbackQuestionKind })
                    }
                  >
                    <option value="rating">Rating 1–5</option>
                    <option value="choice">Choice</option>
                    <option value="text">Text</option>
                  </NativeSelect>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={question.required}
                      onCheckedChange={(value) => update(index, { required: value })}
                      aria-label={`Question ${index + 1} required`}
                    />
                    Required
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    aria-label={`Remove question ${index + 1}`}
                    disabled={questions.length === 1}
                    onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                <Input
                  aria-label={`Question ${index + 1}`}
                  value={question.prompt}
                  maxLength={200}
                  onChange={(e) => update(index, { prompt: e.target.value })}
                />
                {question.kind === 'choice' ? (
                  <Input
                    aria-label={`Question ${index + 1} choices`}
                    placeholder="Choices, separated by commas"
                    value={question.options}
                    onChange={(e) => update(index, { options: e.target.value })}
                  />
                ) : null}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={questions.length >= 20}
              onClick={() =>
                setQuestions((current) => [
                  ...current,
                  {
                    id: `q-${current.length + 1}-${Date.now().toString(36)}`,
                    kind: 'rating',
                    prompt: '',
                    required: true,
                    options: '',
                  },
                ])
              }
            >
              <Plus className="size-4" aria-hidden /> Add a question
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              title.trim().length < 3 ||
              !batchId ||
              (cadence === 'once' && !closesAt) ||
              create.isPending
            }
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Creating…' : 'Create form'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
