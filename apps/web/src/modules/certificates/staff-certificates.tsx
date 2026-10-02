'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Paginated, StaffCertificateRecord } from '@lms/shared';
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
} from '@/components/ui/dialog';
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
import { formatDate } from '@/lib/format';
import { useCan } from '@/shell/me-context';

type Action = { kind: 'revoke' | 'reinstate'; certificate: StaffCertificateRecord };

/**
 * Certificates for staff (D9). Administrators revoke and reinstate them with a reason and draw
 * a PDF again; the certificate's words stay what they were at issue. Trainers read their batches'.
 */
export function StaffCertificates() {
  const canManage = useCan('certificates:manage');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q.trim()) params.set('q', q.trim());
  if (status) params.set('status', status);
  const query = useQuery({
    queryKey: ['certificates', 'staff', params.toString()],
    queryFn: () => api<Paginated<StaffCertificateRecord>>(`/certificates?${params.toString()}`),
  });
  const redraw = useMutation({
    mutationFn: (id: string) => api(`/certificates/${id}/redraw`, { method: 'POST' }),
    onSuccess: () => toast.success('The PDF was drawn again'),
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The PDF could not be drawn'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          wrapperClassName="w-full max-w-xs"
          placeholder="Search learner, code or student code"
          aria-label="Search certificates"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <NativeSelect
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any status</option>
          <option value="issued">In force</option>
          <option value="revoked">Revoked</option>
        </NativeSelect>
      </div>
      {query.isPending ? <LoadingRows rows={4} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No certificates yet"
          description="A certificate is issued when a learner completes a course."
        />
      ) : null}
      {query.data && query.data.data.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((certificate) => (
                  <TableRow key={certificate.id}>
                    <TableCell>
                      <p className="font-medium">{certificate.learnerName}</p>
                      <p className="text-xs text-muted-foreground">{certificate.studentCode}</p>
                    </TableCell>
                    <TableCell>{certificate.courseTitle}</TableCell>
                    <TableCell className="font-mono text-xs">{certificate.code}</TableCell>
                    <TableCell>{formatDate(certificate.issuedAt)}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={certificate.status}
                        label={certificate.status === 'issued' ? 'In force' : 'Revoked'}
                        tone={certificate.status === 'issued' ? 'success' : 'danger'}
                      />
                      {certificate.revokedReason ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {certificate.revokedReason}
                        </p>
                      ) : null}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="space-x-2 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setAction({
                              kind: certificate.status === 'issued' ? 'revoke' : 'reinstate',
                              certificate,
                            })
                          }
                        >
                          {certificate.status === 'issued' ? 'Revoke' : 'Reinstate'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={redraw.isPending}
                          onClick={() => redraw.mutate(certificate.id)}
                        >
                          Redraw PDF
                        </Button>
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
            noun="certificates"
          />
        </>
      ) : null}
      {action ? (
        <ReasonDialog
          action={action}
          onClose={() => setAction(null)}
          onDone={async () => {
            setAction(null);
            await queryClient.invalidateQueries({ queryKey: ['certificates'] });
          }}
        />
      ) : null}
    </div>
  );
}

function ReasonDialog({
  action,
  onClose,
  onDone,
}: {
  action: Action;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const revoke = action.kind === 'revoke';
  const save = useMutation({
    mutationFn: () =>
      api(`/certificates/${action.certificate.id}/${action.kind}`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => {
      toast.success(
        revoke ? 'Revoked; the learner has been told' : 'Reinstated; the learner has been told',
      );
      onDone();
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'That could not be saved'),
  });
  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {revoke ? 'Revoke this certificate' : 'Reinstate this certificate'}
          </DialogTitle>
          <DialogDescription>
            {action.certificate.learnerName} · {action.certificate.courseTitle}.{' '}
            {revoke
              ? 'Its public check will say it was revoked, and it can no longer be downloaded.'
              : 'It will be in force again, as it was issued.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="certificate-reason">Reason</Label>
          <Textarea
            id="certificate-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={revoke ? 'destructive' : 'default'}
            disabled={reason.trim().length < 3 || save.isPending}
            onClick={() => save.mutate()}
          >
            {revoke ? 'Revoke' : 'Reinstate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
