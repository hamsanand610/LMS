'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  AssignmentDetail,
  AssignmentProgressRow,
  AssignmentPublicationRecord,
  BatchSummary,
  GradingQueueItem,
  Paginated,
  QuestionSummary,
  UnlockRule,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { TYPE_LABELS } from '@/modules/questions/questions-table';
import { useCan } from '@/shell/me-context';
import { PageHeader } from '@/shell/page-header';

/** Everything an author does to one assignment. */
export function AssignmentWorkspace({ assignmentId }: { assignmentId: string }) {
  const query = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: () => api<AssignmentDetail>(`/assignments/${assignmentId}`),
  });

  if (query.isPending) return <LoadingRows rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const assignment = query.data;

  return (
    <>
      <PageHeader
        title={assignment.title}
        description={assignment.description || 'No description yet.'}
        actions={<StatusBadge status={assignment.status} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Modules" value={String(assignment.moduleCount)} />
        <Stat label="Questions" value={String(assignment.questionCount)} />
        <Stat label="Marks" value={String(assignment.totalMarks)} />
        <Stat label="Batches" value={String(assignment.publicationCount)} />
      </div>

      <Tabs defaultValue="structure">
        <TabsList>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="publish">Publishing</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="grading">Grading</TabsTrigger>
        </TabsList>
        <TabsContent value="structure" className="pt-4">
          <StructureEditor
            key={query.dataUpdatedAt}
            assignmentId={assignmentId}
            detail={assignment}
          />
        </TabsContent>
        <TabsContent value="publish" className="pt-4">
          <PublishPanel assignmentId={assignmentId} />
        </TabsContent>
        <TabsContent value="progress" className="pt-4">
          <ProgressPanel assignmentId={assignmentId} />
        </TabsContent>
        <TabsContent value="grading" className="pt-4">
          <GradingPanel assignmentId={assignmentId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

interface ModuleDraft {
  id?: string;
  title: string;
  gated: boolean;
  minPercent: number;
  questions: { questionId: string; title: string; type: string; marks: number }[];
}

function StructureEditor({
  assignmentId,
  detail,
}: {
  assignmentId: string;
  detail: AssignmentDetail;
}) {
  const [modules, setModules] = useState<ModuleDraft[]>(() =>
    detail.modules.map((module) => ({
      id: module.id,
      title: module.title,
      gated: module.unlockRule.type === 'after_previous',
      minPercent: module.unlockRule.type === 'after_previous' ? module.unlockRule.minPercent : 100,
      questions: module.questions.map((q) => ({
        questionId: q.questionId,
        title: q.title,
        type: q.type,
        marks: q.marks,
      })),
    })),
  );
  const [picking, setPicking] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () =>
      api<AssignmentDetail>(`/assignments/${assignmentId}/structure`, {
        method: 'PUT',
        body: {
          modules: modules.map((module) => ({
            ...(module.id ? { id: module.id } : {}),
            title: module.title,
            unlockRule: (module.gated
              ? { type: 'after_previous', minPercent: module.minPercent }
              : { type: 'always' }) as UnlockRule,
            questions: module.questions.map((q) => ({ questionId: q.questionId, marks: q.marks })),
          })),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] });
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Structure saved');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The structure could not be saved'),
  });

  const update = (index: number, change: Partial<ModuleDraft>) =>
    setModules((current) => current.map((m, i) => (i === index ? { ...m, ...change } : m)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Questions come from the bank. A question that stays in place keeps the answers already
          given to it.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setModules((current) => [
                ...current,
                {
                  title: `Module ${current.length + 1}`,
                  gated: current.length > 0,
                  minPercent: 60,
                  questions: [],
                },
              ])
            }
          >
            Add module
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save structure'}
          </Button>
        </div>
      </div>

      {modules.length === 0 ? (
        <EmptyState
          title="No modules yet"
          description="Add a module, then pick questions from the bank to go in it."
        />
      ) : null}

      {modules.map((module, index) => (
        <Card key={module.id ?? `new-${index}`}>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={module.title}
                onChange={(e) => update(index, { title: e.target.value })}
                className="max-w-sm font-medium"
                aria-label={`Module ${index + 1} title`}
              />
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setModules((current) => current.filter((_, i) => i !== index))}
              >
                Remove module
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={module.gated}
                  onCheckedChange={(checked) => update(index, { gated: checked === true })}
                  aria-label="Open only after the previous module"
                />
                Open only after the previous module reaches
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={module.minPercent}
                disabled={!module.gated}
                onChange={(e) => update(index, { minPercent: Number(e.target.value) || 60 })}
                className="w-20"
                aria-label="Percentage of the previous module"
              />
              <span className="text-muted-foreground">per cent</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {module.questions.map((question, questionIndex) => (
              <div
                key={question.questionId}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{question.title}</span>
                <span className="text-xs text-muted-foreground">
                  {TYPE_LABELS[question.type] ?? question.type}
                </span>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  aria-label={`Marks for ${question.title}`}
                  value={question.marks}
                  onChange={(e) =>
                    update(index, {
                      questions: module.questions.map((q, i) =>
                        i === questionIndex ? { ...q, marks: Number(e.target.value) || 1 } : q,
                      ),
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    update(index, {
                      questions: module.questions.filter((_, i) => i !== questionIndex),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setPicking(index)}>
              Pick questions
            </Button>
          </CardContent>
        </Card>
      ))}

      {picking !== null ? (
        <QuestionPicker
          chosen={new Set(modules[picking]?.questions.map((q) => q.questionId) ?? [])}
          onClose={() => setPicking(null)}
          onPick={(question) => {
            const target = modules[picking];
            if (!target) return;
            if (target.questions.some((q) => q.questionId === question.id)) return;
            update(picking, {
              questions: [
                ...target.questions,
                {
                  questionId: question.id,
                  title: question.title,
                  type: question.type,
                  marks: question.marks,
                },
              ],
            });
          }}
        />
      ) : null}
    </div>
  );
}

function QuestionPicker({
  chosen,
  onPick,
  onClose,
}: {
  chosen: Set<string>;
  onPick: (question: QuestionSummary) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['questions', 'picker', q],
    queryFn: () =>
      api<Paginated<QuestionSummary>>(
        `/questions?status=published&pageSize=50${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  });

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pick questions</DialogTitle>
          <DialogDescription>Only published questions can be used.</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search the bank"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search the bank"
        />
        <div className="space-y-1">
          {query.isPending ? <LoadingRows rows={4} /> : null}
          {(query.data?.data ?? []).map((question) => (
            <div
              key={question.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{question.title}</span>
              <span className="text-xs text-muted-foreground">
                {TYPE_LABELS[question.type] ?? question.type} · {question.marks}
              </span>
              <Button
                size="sm"
                variant={chosen.has(question.id) ? 'ghost' : 'outline'}
                disabled={chosen.has(question.id)}
                onClick={() => onPick(question)}
              >
                {chosen.has(question.id) ? 'Added' : 'Add'}
              </Button>
            </div>
          ))}
          {query.data && query.data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matches.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishPanel({ assignmentId }: { assignmentId: string }) {
  const canPublish = useCan('assignments:publish');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [dueAt, setDueAt] = useState('');

  const query = useQuery({
    queryKey: ['assignment', assignmentId, 'publications'],
    queryFn: () => api<AssignmentPublicationRecord[]>(`/assignments/${assignmentId}/publications`),
  });
  const batches = useQuery({
    queryKey: ['batches', 'options'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
    enabled: open,
  });

  const publish = useMutation({
    mutationFn: () =>
      api<AssignmentPublicationRecord>(`/assignments/${assignmentId}/publish`, {
        method: 'POST',
        body: { batchId, dueAt: dueAt ? new Date(dueAt).toISOString() : null },
      }),
    onSuccess: async (record) => {
      await queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] });
      setOpen(false);
      toast.success(`Given to ${record.batchCode}: ${record.learners} learners.`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The assignment could not be published'),
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
        <p className="text-sm text-muted-foreground">
          Publishing tells the batch and puts the assignment in their list.
        </p>
        {canPublish ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Publish to a batch</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish this assignment</DialogTitle>
                <DialogDescription>
                  Everyone in the batch gets it, and is told about it.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="publish-batch">Batch</Label>
                  <select
                    id="publish-batch"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                  >
                    <option value="">Choose a batch</option>
                    {(batches.data?.data ?? []).map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.code} — {batch.name}
                      </option>
                    ))}
                  </select>
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button disabled={!batchId || publish.isPending} onClick={() => publish.mutate()}>
                  {publish.isPending ? 'Publishing…' : 'Publish'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {query.isPending ? <LoadingRows rows={3} /> : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          title="Not given to anybody yet"
          description="Publish it to a batch and everyone in that batch sees it."
        />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Learners</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Published</TableHead>
                {canPublish ? <TableHead className="w-28" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {record.batchCode} — {record.batchName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{record.learners}</TableCell>
                  <TableCell>
                    {record.dueAt ? new Date(record.dueAt).toLocaleString() : 'No date'}
                  </TableCell>
                  <TableCell>{new Date(record.publishedAt).toLocaleDateString()}</TableCell>
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
    </div>
  );
}

function ProgressPanel({ assignmentId }: { assignmentId: string }) {
  const query = useQuery({
    queryKey: ['assignment', assignmentId, 'progress'],
    queryFn: () => api<AssignmentProgressRow[]>(`/assignments/${assignmentId}/progress`),
  });

  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        title="Nobody has it yet"
        description="Publish the assignment to a batch and their progress appears here."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Learner</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead className="text-right">Solved</TableHead>
            <TableHead className="text-right">Marks</TableHead>
            <TableHead>Last activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data.map((row) => (
            <TableRow key={row.studentId}>
              <TableCell>
                <span className="font-medium">{row.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{row.studentCode}</span>
              </TableCell>
              <TableCell>{row.batchCode}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.solved} / {row.questionCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.awardedMarks} / {row.totalMarks}
              </TableCell>
              <TableCell>
                {row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleString() : 'Not started'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GradingPanel({ assignmentId }: { assignmentId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['grading', assignmentId],
    queryFn: () =>
      api<GradingQueueItem[]>(`/assignments/grading/queue?assignmentId=${assignmentId}`),
  });

  if (query.isPending) return <LoadingRows rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        title="Nothing waiting"
        description="Written answers appear here as learners submit them."
      />
    );
  }

  return (
    <div className="space-y-3">
      {query.data.map((item) => (
        <GradingCard
          key={item.submissionId}
          item={item}
          onGraded={async () => {
            await queryClient.invalidateQueries({ queryKey: ['grading', assignmentId] });
            await queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] });
          }}
        />
      ))}
    </div>
  );
}

function GradingCard({ item, onGraded }: { item: GradingQueueItem; onGraded: () => void }) {
  const [marks, setMarks] = useState(0);
  const [comment, setComment] = useState('');

  const grade = useMutation({
    mutationFn: () =>
      api(`/submissions/${item.submissionId}/grade`, { method: 'POST', body: { marks, comment } }),
    onSuccess: () => {
      toast.success('Marked');
      onGraded();
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'That could not be marked'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{item.questionTitle}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {item.studentName} · {item.studentCode} · {item.batchCode} · up to {item.maxMarks} marks
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {item.rubric ? (
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">Mark scheme</p>
            <p className="text-muted-foreground">{item.rubric}</p>
          </div>
        ) : null}
        <div className="rounded-md border border-border p-3 text-sm whitespace-pre-wrap">
          {item.answer}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor={`marks-${item.submissionId}`}>Marks</Label>
            <Input
              id={`marks-${item.submissionId}`}
              type="number"
              min={0}
              max={item.maxMarks}
              className="w-24"
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor={`comment-${item.submissionId}`}>Comment</Label>
            <Textarea
              id={`comment-${item.submissionId}`}
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <Button disabled={grade.isPending} onClick={() => grade.mutate()}>
            {grade.isPending ? 'Saving…' : 'Save mark'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
