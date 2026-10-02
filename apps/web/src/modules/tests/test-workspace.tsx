'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  QUESTION_TYPE_LABELS,
  TEST_QUESTION_TYPES,
  RESULT_POLICIES,
  REVIEW_POLICIES,
  type BatchSummary,
  type Paginated,
  type QuestionSummary,
  type QuestionType,
  type TestDetail,
  type TestGradingItem,
  type TestMonitor,
  type TestResultRow,
  type TestScheduleRecord,
  type TestSettings,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { StatStrip } from '@/components/stat-strip';
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
import { useParentPath } from '@/lib/use-parent-path';
import { useCan } from '@/shell/me-context';
import { PageHeader } from '@/shell/page-header';
import { NativeSelect } from '@/components/ui/native-select';
import { formatDate, formatDateTime, formatTimeWithSeconds } from '@/lib/format';

/** Everything staff do to one test. */
export function TestWorkspace({ testId }: { testId: string }) {
  const listHref = useParentPath();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['test', testId],
    queryFn: () => api<TestDetail>(`/tests/${testId}`),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) =>
      api(`/tests/${testId}/status`, { method: 'POST', body: { status } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test', testId] });
      await queryClient.invalidateQueries({ queryKey: ['tests'] });
      toast.success('Status changed');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'That status could not be set'),
  });

  if (query.isPending) return <LoadingRows rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const test = query.data;

  return (
    <>
      <PageHeader
        back={{ href: listHref, label: 'All tests' }}
        eyebrow="Test"
        title={test.title}
        description={test.description || 'No description yet.'}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={test.status} />
            {test.status === 'published' ? null : (
              <Button onClick={() => setStatus.mutate('published')}>Publish</Button>
            )}
          </div>
        }
      />
      <StatStrip
        className="mb-6"
        items={[
          { label: 'Sections', value: String(test.sectionCount) },
          { label: 'Questions', value: String(test.questionCount) },
          { label: 'Marks', value: String(test.totalMarks) },
          { label: 'Minutes', value: String(test.settings.durationMinutes) },
        ]}
      />

      <Tabs defaultValue="paper">
        <TabsList>
          <TabsTrigger value="paper">Paper</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="schedules">Windows</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="grading">Grading</TabsTrigger>
        </TabsList>
        <TabsContent value="paper" className="pt-4">
          <PaperEditor key={query.dataUpdatedAt} testId={testId} detail={test} />
        </TabsContent>
        <TabsContent value="settings" className="pt-4">
          <SettingsPanel key={query.dataUpdatedAt} testId={testId} detail={test} />
        </TabsContent>
        <TabsContent value="schedules" className="pt-4">
          <SchedulesPanel testId={testId} />
        </TabsContent>
        <TabsContent value="results" className="pt-4">
          <ResultsPanel testId={testId} />
        </TabsContent>
        <TabsContent value="grading" className="pt-4">
          <GradingPanel testId={testId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

interface SectionDraft {
  id?: string;
  title: string;
  instructions: string;
  questions: {
    questionId: string;
    title: string;
    type: string;
    marks: number;
    negativeMarks: number;
  }[];
}

function PaperEditor({ testId, detail }: { testId: string; detail: TestDetail }) {
  const [sections, setSections] = useState<SectionDraft[]>(() =>
    detail.sections.map((section) => ({
      id: section.id,
      title: section.title,
      instructions: section.instructions,
      questions: section.questions.map((q) => ({
        questionId: q.questionId,
        title: q.title,
        type: q.type,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
      })),
    })),
  );
  const [picking, setPicking] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () =>
      api<TestDetail>(`/tests/${testId}/paper`, {
        method: 'PUT',
        body: {
          sections: sections.map((section) => ({
            ...(section.id ? { id: section.id } : {}),
            title: section.title,
            instructions: section.instructions,
            questions: section.questions.map((q) => ({
              questionId: q.questionId,
              marks: q.marks,
              negativeMarks: q.negativeMarks,
            })),
          })),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test', testId] });
      toast.success('Paper saved');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The paper could not be saved'),
  });

  const update = (index: number, change: Partial<SectionDraft>) =>
    setSections((current) => current.map((s, i) => (i === index ? { ...s, ...change } : s)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          The paper cannot change while anybody is sitting the test.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setSections((current) => [
                ...current,
                { title: `Section ${current.length + 1}`, instructions: '', questions: [] },
              ])
            }
          >
            Add section
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save paper'}
          </Button>
        </div>
      </div>

      {sections.length === 0 ? (
        <EmptyState
          title="No sections yet"
          description="Add a section and pick questions from the bank."
        />
      ) : null}

      {sections.map((section, index) => (
        <Card key={section.id ?? `new-${index}`}>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={section.title}
                onChange={(e) => update(index, { title: e.target.value })}
                className="max-w-sm font-medium"
                aria-label={`Section ${index + 1} title`}
              />
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setSections((current) => current.filter((_, i) => i !== index))}
              >
                Remove section
              </Button>
            </div>
            <Input
              value={section.instructions}
              onChange={(e) => update(index, { instructions: e.target.value })}
              placeholder="Instructions for this section (optional)"
              aria-label={`Section ${index + 1} instructions`}
            />
          </CardHeader>
          <CardContent className="space-y-2">
            {section.questions.map((question, questionIndex) => (
              <div
                key={question.questionId}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{question.title}</span>
                <span className="text-xs text-muted-foreground">
                  {QUESTION_TYPE_LABELS[question.type as QuestionType] ?? question.type}
                </span>
                <div className="flex items-center gap-1">
                  <Label
                    className="text-xs text-muted-foreground"
                    htmlFor={`marks-${question.questionId}`}
                  >
                    Marks
                  </Label>
                  <Input
                    id={`marks-${question.questionId}`}
                    type="number"
                    min={1}
                    className="w-20"
                    value={question.marks}
                    onChange={(e) =>
                      update(index, {
                        questions: section.questions.map((q, i) =>
                          i === questionIndex ? { ...q, marks: Number(e.target.value) || 1 } : q,
                        ),
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Label
                    className="text-xs text-muted-foreground"
                    htmlFor={`negative-${question.questionId}`}
                  >
                    Negative
                  </Label>
                  <Input
                    id={`negative-${question.questionId}`}
                    type="number"
                    min={0}
                    step="0.25"
                    className="w-20"
                    value={question.negativeMarks}
                    onChange={(e) =>
                      update(index, {
                        questions: section.questions.map((q, i) =>
                          i === questionIndex
                            ? { ...q, negativeMarks: Number(e.target.value) || 0 }
                            : q,
                        ),
                      })
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    update(index, {
                      questions: section.questions.filter((_, i) => i !== questionIndex),
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
        <PickerDialog
          chosen={new Set(sections[picking]?.questions.map((q) => q.questionId) ?? [])}
          onClose={() => setPicking(null)}
          onPick={(question) => {
            const target = sections[picking];
            if (!target || target.questions.some((q) => q.questionId === question.id)) return;
            update(picking, {
              questions: [
                ...target.questions,
                {
                  questionId: question.id,
                  title: question.title,
                  type: question.type,
                  marks: question.marks,
                  negativeMarks: 0,
                },
              ],
            });
          }}
        />
      ) : null}
    </div>
  );
}

function PickerDialog({
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
          <DialogDescription>
            Published questions a timed paper can take: choices, written answers and code.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search the bank"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search the bank"
        />
        <div className="space-y-1">
          {query.isPending ? <LoadingRows rows={4} /> : null}
          {(query.data?.data ?? [])
            .filter((question) => TEST_QUESTION_TYPES.includes(question.type))
            .map((question) => (
              <div
                key={question.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{question.title}</span>
                <span className="text-xs text-muted-foreground">
                  {QUESTION_TYPE_LABELS[question.type] ?? question.type} · {question.marks}
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
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsPanel({ testId, detail }: { testId: string; detail: TestDetail }) {
  const [settings, setSettings] = useState<TestSettings>(detail.settings);
  const [instructions, setInstructions] = useState(detail.instructions);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () =>
      api(`/tests/${testId}`, { method: 'PATCH', body: { settings, instructions } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test', testId] });
      toast.success('Settings saved');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The settings could not be saved'),
  });

  const set = (change: Partial<TestSettings>) =>
    setSettings((current) => ({ ...current, ...change }));

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="settings-duration">Minutes</Label>
          <Input
            id="settings-duration"
            type="number"
            min={1}
            value={settings.durationMinutes}
            onChange={(e) => set({ durationMinutes: Number(e.target.value) || 60 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-attempts">Attempts allowed</Label>
          <Input
            id="settings-attempts"
            type="number"
            min={1}
            value={settings.maxAttempts}
            onChange={(e) => set({ maxAttempts: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-result">When learners see their score</Label>
          <NativeSelect
            id="settings-result"
            className="w-full"
            value={settings.resultPolicy}
            onChange={(e) => set({ resultPolicy: e.target.value as TestSettings['resultPolicy'] })}
          >
            {RESULT_POLICIES.map((value) => (
              <option key={value} value={value}>
                {value === 'on_release' ? 'When results are released' : 'As soon as they submit'}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-review">How much they may review</Label>
          <NativeSelect
            id="settings-review"
            className="w-full"
            value={settings.reviewPolicy}
            onChange={(e) => set({ reviewPolicy: e.target.value as TestSettings['reviewPolicy'] })}
          >
            {REVIEW_POLICIES.map((value) => (
              <option key={value} value={value}>
                {value === 'full'
                  ? 'The whole paper with answers'
                  : value === 'score_only'
                    ? 'The score only'
                    : 'Nothing'}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-2">
        {[
          ['shuffleQuestions', 'Shuffle the questions for each learner'],
          ['shuffleOptions', 'Shuffle the options within a question'],
          ['trackTabSwitches', 'Count tab switches and show them to staff'],
          ['requireFullScreen', 'Ask the learner to go full screen'],
          ['showRank', 'Show each learner their rank once results are out'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={settings[key as keyof TestSettings] as boolean}
              aria-label={label}
              onCheckedChange={(checked) =>
                set({ [key]: checked === true } as Partial<TestSettings>)
              }
            />
            {label}
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-instructions">Instructions shown before the test</Label>
        <Textarea
          id="settings-instructions"
          rows={4}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      <Button disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? 'Saving…' : 'Save settings'}
      </Button>
    </div>
  );
}

function SchedulesPanel({ testId }: { testId: string }) {
  const canSchedule = useCan('tests:schedule');
  const [open, setOpen] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['test', testId, 'schedules'],
    queryFn: () => api<TestScheduleRecord[]>(`/tests/${testId}/schedules`),
  });
  const batches = useQuery({
    queryKey: ['batches', 'options'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
    enabled: open,
  });

  const schedule = useMutation({
    mutationFn: () =>
      api<TestScheduleRecord>(`/tests/${testId}/schedules`, {
        method: 'POST',
        body: {
          batchId,
          opensAt: new Date(opensAt).toISOString(),
          closesAt: new Date(closesAt).toISOString(),
        },
      }),
    onSuccess: async (record) => {
      await queryClient.invalidateQueries({ queryKey: ['test', testId] });
      setOpen(false);
      toast.success(`${record.batchCode} has the test; ${record.learners} learners told.`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The window could not be opened'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          A window is when one batch may sit the test. Everyone in it is told.
        </p>
        {canSchedule ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Open a window</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Open this test to a batch</DialogTitle>
                <DialogDescription>
                  The timer starts when a learner begins, and never runs past the close.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-batch">Batch</Label>
                  <NativeSelect
                    id="schedule-batch"
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-opens">Opens</Label>
                    <Input
                      id="schedule-opens"
                      type="datetime-local"
                      value={opensAt}
                      onChange={(e) => setOpensAt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-closes">Closes</Label>
                    <Input
                      id="schedule-closes"
                      type="datetime-local"
                      value={closesAt}
                      onChange={(e) => setClosesAt(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!batchId || !opensAt || !closesAt || schedule.isPending}
                  onClick={() => schedule.mutate()}
                >
                  {schedule.isPending ? 'Opening…' : 'Open the window'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {query.isPending ? <LoadingRows rows={3} /> : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          title="No windows yet"
          description="Publish the test, then open it to a batch for a period of time."
        />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <div className="space-y-3">
          {query.data.map((record) => (
            <ScheduleCard key={record.id} testId={testId} record={record} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ScheduleCard({ testId, record }: { testId: string; record: TestScheduleRecord }) {
  const canRelease = useCan('tests:release');
  const canMonitor = useCan('tests:monitor');
  const queryClient = useQueryClient();
  const [showMonitor, setShowMonitor] = useState(false);

  const monitor = useQuery({
    queryKey: ['test', testId, 'monitor', record.id],
    queryFn: () => api<TestMonitor>(`/tests/${testId}/schedules/${record.id}/monitor`),
    enabled: showMonitor,
    refetchInterval: showMonitor ? 10_000 : false,
  });

  const release = useMutation({
    mutationFn: () =>
      api<{ notified: number }>(`/tests/${testId}/schedules/${record.id}/release`, {
        method: 'POST',
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['test', testId] });
      toast.success(`Results are out; ${result.notified} learner(s) told.`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The results could not be released'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {record.batchCode} — {record.batchName}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(record.opensAt)} to {formatDateTime(record.closesAt)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatStrip
          items={[
            { label: 'Learners', value: String(record.learners) },
            { label: 'Started', value: String(record.started) },
            { label: 'Submitted', value: String(record.submitted) },
            { label: 'Results', value: record.releasedAt ? 'Out' : 'Held' },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {canMonitor ? (
            <Button variant="outline" size="sm" onClick={() => setShowMonitor((v) => !v)}>
              {showMonitor ? 'Hide the monitor' : 'Watch it live'}
            </Button>
          ) : null}
          {canRelease && !record.releasedAt ? (
            <Button size="sm" disabled={release.isPending} onClick={() => release.mutate()}>
              {release.isPending ? 'Releasing…' : 'Release results'}
            </Button>
          ) : null}
        </div>

        {showMonitor && monitor.data ? (
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="tabular-nums">
              {monitor.data.notStarted} not started · {monitor.data.inProgress} sitting ·{' '}
              {monitor.data.submitted} submitted
            </p>
            {monitor.data.flagged.length > 0 ? (
              <div className="mt-2">
                <p className="font-medium">Left the tab</p>
                {monitor.data.flagged.map((entry) => (
                  <p key={entry.attemptId} className="text-xs text-muted-foreground">
                    {entry.name}: {entry.tabSwitches} time{entry.tabSwitches === 1 ? '' : 's'}
                  </p>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              As of {formatTimeWithSeconds(monitor.data.asOf)}; refreshes every ten seconds.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ResultsPanel({ testId }: { testId: string }) {
  const schedules = useQuery({
    queryKey: ['test', testId, 'schedules'],
    queryFn: () => api<TestScheduleRecord[]>(`/tests/${testId}/schedules`),
  });
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const chosen = scheduleId ?? schedules.data?.[0]?.id ?? null;

  const results = useQuery({
    queryKey: ['test', testId, 'results', chosen],
    queryFn: () => api<TestResultRow[]>(`/tests/${testId}/schedules/${chosen}/results`),
    enabled: Boolean(chosen),
  });

  if (schedules.isPending) return <LoadingRows rows={3} />;
  if (!schedules.data || schedules.data.length === 0) {
    return (
      <EmptyState
        title="No windows yet"
        description="Results appear once a batch has sat the test."
      />
    );
  }

  return (
    <div className="space-y-3">
      <NativeSelect
        value={chosen ?? ''}
        aria-label="Choose a window"
        onChange={(e) => setScheduleId(e.target.value)}
      >
        {schedules.data.map((schedule) => (
          <option key={schedule.id} value={schedule.id}>
            {schedule.batchCode} · {formatDate(schedule.opensAt)}
          </option>
        ))}
      </NativeSelect>

      {results.isPending ? <LoadingRows rows={4} /> : null}
      {results.data && results.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody has sat it yet.</p>
      ) : null}
      {results.data && results.data.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Per cent</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Tab switches</TableHead>
                <TableHead className="text-right">To mark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.data.map((row) => (
                <TableRow key={row.attemptId}>
                  <TableCell>
                    <span className="font-medium">{row.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{row.studentCode}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.score} / {row.totalMarks}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.percentage}%</TableCell>
                  <TableCell>
                    {row.submittedAt ? formatDateTime(row.submittedAt) : 'Still sitting'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.tabSwitches}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.pendingGrading}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

function GradingPanel({ testId }: { testId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['test', testId, 'grading'],
    queryFn: () => api<TestGradingItem[]>(`/tests/${testId}/grading/queue`),
  });

  if (query.isPending) return <LoadingRows rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        title="Nothing to mark"
        description="Written answers appear here once learners submit. Results cannot be released until the queue is empty."
      />
    );
  }

  return (
    <div className="space-y-3">
      {query.data.map((item) => (
        <TestGradingCard
          key={item.answerId}
          item={item}
          onGraded={async () => {
            await queryClient.invalidateQueries({ queryKey: ['test', testId] });
          }}
        />
      ))}
    </div>
  );
}

function TestGradingCard({ item, onGraded }: { item: TestGradingItem; onGraded: () => void }) {
  const [marks, setMarks] = useState(0);
  const [comment, setComment] = useState('');

  const grade = useMutation({
    mutationFn: () =>
      api(`/attempts/${item.attemptId}/answers/${item.answerId}/grade`, {
        method: 'PATCH',
        body: { marks, comment },
      }),
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
          {item.studentName} · {item.studentCode} · up to {item.maxMarks} marks
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
          {item.answer || 'Nothing was written.'}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor={`test-marks-${item.answerId}`}>Marks</Label>
            <Input
              id={`test-marks-${item.answerId}`}
              type="number"
              min={0}
              max={item.maxMarks}
              className="w-24"
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value) || 0)}
            />
          </div>
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor={`test-comment-${item.answerId}`}>Comment</Label>
            <Textarea
              id={`test-comment-${item.answerId}`}
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
