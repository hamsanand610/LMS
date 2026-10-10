'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationRow,
  type ApplicationStatusInput,
  type DriveDetail,
  type DriveStatus,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { StatStrip } from '@/components/stat-strip';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
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
import { saveFile } from '@/lib/files/save-file';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/shell/page-header';
import { EligibilityList } from './drive-detail';
import { DriveFacts } from './drives-board';
import { DriveForm } from './drive-form';

const STAGES: ApplicationStatusInput['status'][] = [
  'applied',
  'shortlisted',
  'selected',
  'rejected',
];

/** One drive for staff: its state, the rules, and every applicant with their stage. */
export function AdminDrive({ id }: { id: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [stageFor, setStageFor] = useState<ApplicationRow | null>(null);
  const key = ['drive', 'staff', id];
  const drive = useQuery({ queryKey: key, queryFn: () => api<DriveDetail>(`/drives/${id}`) });
  const applicants = useQuery({
    queryKey: ['drive-applications', id],
    queryFn: () => api<ApplicationRow[]>(`/drives/${id}/applications`),
  });

  // A résumé opens through a short link the server signs and audits (ADM-07).
  const openResume = useMutation({
    mutationFn: (applicationId: string) =>
      api<{ url: string }>(`/drives/${id}/applications/${applicationId}/resume`),
    onSuccess: ({ url }) => window.open(url, '_blank', 'noopener'),
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The resume could not be opened'),
  });
  const exportApplicants = useMutation({
    mutationFn: () =>
      api<{ filename: string; csv: string }>(`/drives/${id}/applications/export`, {
        method: 'POST',
      }),
    onSuccess: ({ filename, csv }) => saveFile(filename, csv, 'text/csv'),
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The applicants could not be exported'),
  });

  const setStatus = useMutation({
    mutationFn: (status: DriveStatus) =>
      api<DriveDetail>(`/drives/${id}/status`, { method: 'POST', body: { status } }),
    onSuccess: (saved) => {
      client.setQueryData(key, saved);
      void client.invalidateQueries({ queryKey: ['drives'] });
      toast.success(
        saved.status === 'open'
          ? 'The drive is open. Eligible learners have been told.'
          : saved.status === 'closed'
            ? 'Applications closed'
            : 'Back to draft',
      );
    },
    onError: (error: Error) => toast.error(isApiError(error) ? error.message : 'That did not work'),
  });
  const remove = useMutation({
    mutationFn: () => api(`/drives/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['drives'] });
      toast.success('Drive removed');
      router.push('/admin/placements');
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'The drive could not be removed'),
  });

  if (drive.isPending) return <LoadingRows rows={6} />;
  if (drive.isError) return <ErrorState error={drive.error} onRetry={() => drive.refetch()} />;
  const data = drive.data;
  const rows = applicants.data ?? [];
  const count = (status: string) => rows.filter((r) => r.status === status).length;

  return (
    <>
      <PageHeader
        back={{ href: '/admin/placements', label: 'Drives' }}
        eyebrow={`${data.company.name} · ${data.code}`}
        title={data.role}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={data.status} />
            <DriveFacts drive={data} />
          </div>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {data.status === 'draft' ? (
              <Button disabled={setStatus.isPending} onClick={() => setStatus.mutate('open')}>
                Open the drive
              </Button>
            ) : null}
            {data.status === 'open' ? (
              <Button
                variant="outline"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate('closed')}
              >
                Close applications
              </Button>
            ) : null}
            {data.status === 'closed' ? (
              <Button
                variant="outline"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate('open')}
              >
                Reopen
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              Edit
            </Button>
            {data.applicantCount === 0 && rows.length === 0 ? (
              <Button variant="ghost" onClick={() => setRemoving(true)}>
                <Trash2 aria-hidden="true" />
                Remove
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="space-y-8">
        <StatStrip
          items={[
            { label: 'Applications close', value: formatDateTime(data.applyBy) },
            { label: 'Applied', value: rows.filter((r) => r.status !== 'withdrawn').length },
            { label: 'Shortlisted', value: count('shortlisted') },
            {
              label: 'Selected',
              value: count('selected'),
              tone: count('selected') > 0 ? 'success' : 'default',
            },
          ]}
        />

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-[15px] font-semibold">About the role</h2>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground-secondary">
              {data.description || 'No description yet.'}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Official application:{' '}
              {data.applyUrl ? (
                <a
                  href={data.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium break-all text-brand hover:underline"
                >
                  {data.applyUrl}
                </a>
              ) : (
                'none (learners apply through the platform)'
              )}
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-[15px] font-semibold">Who can apply</h2>
            <div className="mt-2">
              <EligibilityList drive={data} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {data.publishedAt
                ? `Opened ${formatDateTime(data.publishedAt)}.`
                : 'Not opened yet: learners cannot see it.'}
            </p>
          </section>
        </div>

        <section aria-labelledby="applicants-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="applicants-heading" className="text-base font-semibold">
              Applicants
            </h2>
            {rows.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                disabled={exportApplicants.isPending}
                onClick={() => exportApplicants.mutate()}
              >
                Export CSV
              </Button>
            ) : null}
          </div>
          {applicants.isPending ? <LoadingRows rows={4} /> : null}
          {applicants.isError ? (
            <ErrorState error={applicants.error} onRetry={() => applicants.refetch()} />
          ) : null}
          {applicants.data && rows.length === 0 ? (
            <EmptyState
              title="Nobody has applied yet"
              description={
                data.status === 'open'
                  ? 'Eligible learners were told when the drive opened.'
                  : 'Open the drive so eligible learners can apply.'
              }
            />
          ) : null}
          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Learner</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Attendance</TableHead>
                    <TableHead>Resume</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="sr-only">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <p className="font-medium">{row.student.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.student.studentCode} · {row.student.email}
                        </p>
                      </TableCell>
                      <TableCell>{row.batchCodes.join(', ') || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.attendancePct === null ? '—' : `${row.attendancePct}%`}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.resume ? (
                          <Button
                            variant="link"
                            className="h-auto p-0"
                            disabled={openResume.isPending}
                            onClick={() => openResume.mutate(row.id)}
                          >
                            {row.resume.title}
                          </Button>
                        ) : (
                          'None on file'
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatDateTime(row.appliedAt)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={row.status}
                          label={APPLICATION_STATUS_LABELS[row.status]}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {row.status !== 'withdrawn' ? (
                          <Button size="sm" variant="outline" onClick={() => setStageFor(row)}>
                            Update<span className="sr-only"> {row.student.name}</span>
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </section>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit the drive</DialogTitle>
            <DialogDescription>Learners see changes straight away.</DialogDescription>
          </DialogHeader>
          <DriveForm
            drive={data}
            onCancel={() => setEditing(false)}
            onSaved={(saved) => {
              client.setQueryData(key, saved);
              void client.invalidateQueries({ queryKey: ['drives'] });
              setEditing(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this drive?</DialogTitle>
            <DialogDescription>
              Nobody has applied, so nothing is lost. A drive with applications is closed instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {stageFor ? (
        <StageDialog
          driveId={id}
          row={stageFor}
          onClose={() => setStageFor(null)}
          onSaved={() => {
            void client.invalidateQueries({ queryKey: ['drive-applications', id] });
            void client.invalidateQueries({ queryKey: key });
            setStageFor(null);
          }}
        />
      ) : null}
    </>
  );
}

function StageDialog({
  driveId,
  row,
  onClose,
  onSaved,
}: {
  driveId: string;
  row: ApplicationRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<ApplicationStatusInput['status']>(
    row.status === 'withdrawn' ? 'applied' : row.status,
  );
  const [note, setNote] = useState(row.note);
  const save = useMutation({
    mutationFn: () =>
      api<ApplicationRow>(`/drives/${driveId}/applications/${row.id}`, {
        method: 'PATCH',
        body: { status, note },
      }),
    onSuccess: () => {
      toast.success(`${row.student.name}: ${APPLICATION_STATUS_LABELS[status]}`);
      onSaved();
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'The stage could not be saved'),
  });
  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row.student.name}</DialogTitle>
          <DialogDescription>
            The learner is told about the new stage, with your note if you write one.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="stage">Stage</Label>
            <NativeSelect
              id="stage"
              className="w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatusInput['status'])}
            >
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {APPLICATION_STATUS_LABELS[stage]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stage-note">Note to the learner (optional)</Label>
            <Textarea
              id="stage-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Technical interview on Monday at 10 am, Block B."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save stage'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
