'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  BatchDetail as BatchDetailData,
  BatchMemberRow,
  BatchStatus,
  Paginated,
  TrainerSummary,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { StatStrip } from '@/components/stat-strip';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BatchAttendance } from '@/modules/attendance/batch-attendance';
import { api } from '@/lib/api/http';
import { formatDate, formatDateRange, humanise } from '@/lib/format';
import { useParentPath } from '@/lib/use-parent-path';
import { isApiError } from '@/lib/api/errors';
import { BatchContent } from '@/modules/courses/batch-content';
import { TimetableEditor } from '@/modules/schedule/timetable-editor';
import { useCan } from '@/shell/me-context';
import { PageHeader } from '@/shell/page-header';

interface Candidate {
  id: string;
  studentCode: string;
  name: string;
  email: string;
  status: string;
  otherBatches: number;
}

export function BatchDetail({
  batchId,
  readOnly = false,
}: {
  batchId: string;
  readOnly?: boolean;
}) {
  const listHref = useParentPath();
  const canManage = useCan('batches:manage') && !readOnly;
  // The trainer portal shows the same batch; its links stay there.
  const portal = readOnly ? '/trainer' : '/admin';
  const query = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => api<BatchDetailData>(`/batches/${batchId}`),
  });

  if (query.isPending) return <LoadingRows rows={8} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const batch = query.data;

  return (
    <>
      <PageHeader
        back={{ href: listHref, label: 'All batches' }}
        eyebrow="Batch"
        title={batch.code}
        description={`${batch.name} · ${batch.program.name} · ${formatDateRange(batch.startDate, batch.endDate)}`}
        actions={
          canManage ? <StatusControl batch={batch} /> : <StatusBadge status={batch.status} />
        }
      />

      <StatStrip
        className="mb-6"
        items={[
          { label: 'Students', value: `${batch.studentCount} / ${batch.capacity}` },
          { label: 'Trainers', value: String(batch.trainerCount) },
          { label: 'Mode', value: humanise(batch.mode) },
        ]}
      />

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="trainers">Trainers</TabsTrigger>
          <TabsTrigger value="schedule">Timetable</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="students">
          <MembersTab batchId={batchId} canManage={canManage} portal={portal} />
        </TabsContent>
        <TabsContent value="trainers">
          <TrainersTab batch={batch} canManage={canManage} />
        </TabsContent>
        <TabsContent value="schedule">
          <TimetableEditor batchId={batchId} />
        </TabsContent>
        <TabsContent value="attendance" className="pt-4">
          <BatchAttendance batchId={batchId} portal={readOnly ? 'trainer' : 'admin'} />
        </TabsContent>
        <TabsContent value="content">
          <BatchContent batchId={batchId} coursesBase={`${portal}/courses`} />
        </TabsContent>
        <TabsContent value="reports" className="pt-4">
          <BatchReports batchId={batchId} portal={portal} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function StatusControl({ batch }: { batch: BatchDetailData }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<BatchStatus | null>(null);

  const change = useMutation({
    mutationFn: (status: BatchStatus) =>
      api(`/batches/${batch.id}/status`, { method: 'POST', body: { status } }),
    onSuccess: (_data, status) => {
      void queryClient.invalidateQueries({ queryKey: ['batch', batch.id] });
      void queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success(
        status === 'running'
          ? 'The batch is running; its students have been told'
          : `Batch moved to ${status}`,
      );
      setPending(null);
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Could not change the status');
      setPending(null);
    },
  });

  if (batch.allowedTransitions.length === 0) return <StatusBadge status={batch.status} />;
  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={batch.status} />
      {batch.allowedTransitions.map((status) => (
        <Button
          key={status}
          variant={status === 'running' ? 'default' : 'outline'}
          size="sm"
          disabled={change.isPending}
          onClick={() => setPending(status)}
          className="capitalize"
        >
          {status === 'running' ? 'Start batch' : `Mark ${status}`}
        </Button>
      ))}
      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">Move to {pending}</DialogTitle>
            <DialogDescription>
              {pending === 'running'
                ? 'Every student in the batch is notified that their batch has started.'
                : 'This is recorded in the audit log.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button disabled={change.isPending} onClick={() => pending && change.mutate(pending)}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembersTab({
  batchId,
  canManage,
  portal,
}: {
  batchId: string;
  canManage: boolean;
  portal: string;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (includeInactive) params.set('includeInactive', 'true');
  const query = useQuery({
    queryKey: ['batch-members', batchId, params.toString()],
    queryFn: () =>
      api<Paginated<BatchMemberRow>>(`/batches/${batchId}/members?${params.toString()}`),
  });

  const remove = useMutation({
    mutationFn: (studentId: string) =>
      api(
        `/batches/${batchId}/members/${studentId}?reason=${encodeURIComponent('Removed by staff')}`,
        {
          method: 'DELETE',
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['batch-members', batchId] });
      void queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      toast.success('Student removed from the batch');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not remove the student'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={includeInactive}
            onCheckedChange={(v) => setIncludeInactive(v === true)}
          />
          Show students who left
        </label>
        <div className="flex-1" />
        {canManage ? <Button onClick={() => setAddOpen(true)}>Add students</Button> : null}
      </div>

      {query.isPending ? (
        <LoadingRows rows={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title="No students in this batch"
          description="Add students from the list, or import a sheet with this batch code."
          action={canManage ? <Button onClick={() => setAddOpen(true)}>Add students</Button> : null}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((member) => (
                  <TableRow key={`${member.studentId}-${member.joinedAt}`}>
                    <TableCell>
                      <Link
                        href={`${portal}/students/${member.studentId}`}
                        className="font-medium hover:underline"
                      >
                        {member.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {member.studentCode} · {member.email}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={member.isActive ? member.status : 'left'} />
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {formatDate(member.joinedAt)}
                      {member.leftAt ? ` – ${formatDate(member.leftAt)}` : ''}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        {member.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(member.studentId)}
                          >
                            Remove
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
            noun="students"
          />
        </>
      )}

      <AddMembersDialog batchId={batchId} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AddMembersDialog({
  batchId,
  open,
  onOpenChange,
}: {
  batchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const candidates = useQuery({
    queryKey: ['batch-candidates', batchId, q],
    queryFn: () =>
      api<Candidate[]>(`/batches/${batchId}/members/candidates?q=${encodeURIComponent(q)}`),
    enabled: open,
  });

  const add = useMutation({
    mutationFn: () =>
      api<{ added: number }>(`/batches/${batchId}/members`, { body: { studentIds: selected } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['batch-members', batchId] });
      void queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(`${result.added} student${result.added === 1 ? '' : 's'} added`);
      setSelected([]);
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not add the students'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add students to this batch</DialogTitle>
          <DialogDescription>Students already in the batch are not listed.</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search name, email or student code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search students to add"
        />
        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          {candidates.isPending ? (
            <LoadingRows rows={4} />
          ) : candidates.isError ? (
            <ErrorState error={candidates.error} onRetry={() => void candidates.refetch()} />
          ) : candidates.data.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No students match.</p>
          ) : (
            <ul className="divide-y divide-border">
              {candidates.data.map((candidate) => (
                <li key={candidate.id}>
                  <label className="flex cursor-pointer items-center gap-3 p-3">
                    <Checkbox
                      checked={selected.includes(candidate.id)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) =>
                          checked === true
                            ? [...prev, candidate.id]
                            : prev.filter((id) => id !== candidate.id),
                        )
                      }
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{candidate.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {candidate.studentCode} · {candidate.email}
                        {candidate.otherBatches > 0
                          ? ` · already in ${candidate.otherBatches} batch(es)`
                          : ''}
                      </span>
                    </span>
                    <StatusBadge status={candidate.status} />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={selected.length === 0 || add.isPending} onClick={() => add.mutate()}>
            Add{' '}
            {selected.length > 0
              ? `${selected.length} student${selected.length === 1 ? '' : 's'}`
              : 'students'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TrainersTab({ batch, canManage }: { batch: BatchDetailData; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(
    batch.trainers.map((t) => ({ trainerId: t.trainerId, subject: t.subject, role: t.role })),
  );
  const trainers = useQuery({
    queryKey: ['trainers', 'options'],
    queryFn: () => api<Paginated<TrainerSummary>>('/trainers?pageSize=100'),
    enabled: canManage,
  });

  const save = useMutation({
    mutationFn: () =>
      api(`/batches/${batch.id}/trainers`, { method: 'PUT', body: { assignments: rows } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['batch', batch.id] });
      void queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Trainer assignments saved');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not save the assignments'),
  });

  if (!canManage) {
    return batch.trainers.length === 0 ? (
      <EmptyState
        title="No trainers assigned"
        description="An administrator assigns trainers to this batch."
      />
    ) : (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trainer</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batch.trainers.map((t) => (
              <TableRow key={`${t.trainerId}-${t.subject}`}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.subject}</TableCell>
                <TableCell className="capitalize">{t.role}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  const options = trainers.data?.data ?? [];
  const dirty =
    JSON.stringify(rows) !==
    JSON.stringify(
      batch.trainers.map((t) => ({ trainerId: t.trainerId, subject: t.subject, role: t.role })),
    );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Trainer</TableHead>
              <TableHead className="min-w-40">Subject</TableHead>
              <TableHead className="w-36">Role</TableHead>
              <TableHead className="w-24 text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-sm text-muted-foreground">
                  No trainers assigned yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Select
                      value={row.trainerId}
                      onValueChange={(v) =>
                        setRows((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, trainerId: v } : r)),
                        )
                      }
                    >
                      <SelectTrigger aria-label="Trainer">
                        <SelectValue placeholder="Choose a trainer" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.subject}
                      placeholder="Core Java"
                      aria-label="Subject"
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, subject: e.target.value } : r)),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.role}
                      onValueChange={(v) =>
                        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, role: v } : r)))
                      }
                    >
                      <SelectTrigger aria-label="Role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="assistant">Assistant</SelectItem>
                        <SelectItem value="guest">Guest</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => setRows((prev) => [...prev, { trainerId: '', subject: '', role: 'lead' }])}
        >
          Add a row
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          disabled={!dirty}
          onClick={() =>
            setRows(
              batch.trainers.map((t) => ({
                trainerId: t.trainerId,
                subject: t.subject,
                role: t.role,
              })),
            )
          }
        >
          Discard
        </Button>
        <Button
          disabled={!dirty || save.isPending || rows.some((r) => !r.trainerId || !r.subject.trim())}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save assignments'}
        </Button>
      </div>
    </div>
  );
}

const BATCH_REPORTS = [
  {
    name: 'progress',
    title: 'Course progress',
    text: 'Each learner, each course, and how far through it they are.',
  },
  {
    name: 'attendance',
    title: 'Attendance',
    text: 'Classes held and attended, by learner and by subject.',
  },
  { name: 'assessments', title: 'Test results', text: 'Scores of every test this batch sat.' },
  {
    name: 'assignments',
    title: 'Assignments',
    text: 'What was handed in, and what is still to come.',
  },
] as const;

/** This batch's reports, already filtered to it: the same figures, rows and exports. */
function BatchReports({ batchId, portal }: { batchId: string; portal: string }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {BATCH_REPORTS.map((report) => (
        <li key={report.name}>
          <Link
            href={`${portal}/reports/${report.name}?batchId=${batchId}`}
            className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-surface-2"
          >
            <span className="font-medium">{report.title}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{report.text}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
