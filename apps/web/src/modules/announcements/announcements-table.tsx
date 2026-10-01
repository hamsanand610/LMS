'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  type AnnouncementItem,
  type BatchSummary,
  formatDateTime,
  type Paginated,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
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
import { useMe } from '@/shell/me-context';

const ROLE_CHOICES = [
  { key: 'student', label: 'Students' },
  { key: 'trainer', label: 'Trainers' },
  { key: 'admin', label: 'Admins' },
];

export function AnnouncementsTable() {
  const me = useMe();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ['announcements', page],
    queryFn: () => api<Paginated<AnnouncementItem>>(`/announcements?page=${page}&pageSize=25`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement removed');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not remove it'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>New announcement</Button>
      </div>

      {query.isPending ? (
        <LoadingRows rows={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title="No announcements yet"
          description="Announcements reach a whole audience at once and stay visible for a window you choose."
          action={<Button onClick={() => setOpen(true)}>New announcement</Button>}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Announcement</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Reached</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.title}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{item.body}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {describeAudience(item)}
                      <p className="text-xs text-muted-foreground">
                        {item.channels.join(', ').replace('in_app', 'in app')}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {formatDateTime(item.startsAt, { timeZone: me.organization.timezone })}
                      {item.endsAt
                        ? ` → ${formatDateTime(item.endsAt, { timeZone: me.organization.timezone })}`
                        : ''}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {item.deliveredAt ? item.recipientCount : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(item.id)}
                      >
                        Remove
                      </Button>
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
            noun="announcements"
          />
        </>
      )}

      <NewAnnouncementDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function describeAudience(item: AnnouncementItem): string {
  const parts: string[] = [];
  if (item.audience.roleKeys.length) parts.push(item.audience.roleKeys.join(', '));
  if (item.audience.batchIds.length) parts.push(`${item.audience.batchIds.length} batch(es)`);
  return parts.length === 0 ? 'Everyone' : parts.join(' · ');
}

function NewAnnouncementDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState('');
  const [email, setEmail] = useState(false);

  const batches = useQuery({
    queryKey: ['batches', 'options'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
    enabled: open,
  });

  const audience = { roleKeys, batchIds, programIds: [] as string[] };
  const preview = useQuery({
    queryKey: ['broadcast-preview', JSON.stringify(audience)],
    queryFn: () =>
      api<{ recipients: number }>('/notifications/broadcast/preview', { body: { audience } }),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      api<AnnouncementItem>('/announcements', {
        body: {
          title,
          body,
          audience,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          channels: email ? ['in_app', 'email'] : ['in_app'],
        },
      }),
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success(
        item.status === 'active'
          ? `Sent to ${item.recipientCount} people`
          : 'Scheduled; it goes out at the start time',
      );
      onOpenChange(false);
      setTitle('');
      setBody('');
      setRoleKeys([]);
      setBatchIds([]);
      setEndsAt('');
      setEmail(false);
    },
    onError: (error) => {
      if (isApiError(error) && error.problem?.errors?.length) {
        toast.error(error.problem.errors.map((e) => e.message).join(' '));
      } else {
        toast.error(isApiError(error) ? error.message : 'Could not create the announcement');
      }
    },
  });

  const toggle = (list: string[], value: string, set: (next: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New announcement</DialogTitle>
          <DialogDescription>
            Leave the audience empty to reach everyone. Nothing is sent before the start time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="a-title">Title</Label>
            <Input
              id="a-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-body">Message</Label>
            <Textarea id="a-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-3">
              {ROLE_CHOICES.map((role) => (
                <label key={role.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={roleKeys.includes(role.key)}
                    onCheckedChange={() => toggle(roleKeys, role.key, setRoleKeys)}
                  />
                  {role.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Batches</Label>
            <div className="flex max-h-32 flex-wrap gap-3 overflow-y-auto rounded-md border border-border p-2">
              {(batches.data?.data ?? []).map((batch) => (
                <label key={batch.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={batchIds.includes(batch.id)}
                    onCheckedChange={() => toggle(batchIds, batch.id, setBatchIds)}
                  />
                  {batch.code}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="a-start">Starts</Label>
              <Input
                id="a-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-end">Ends (optional)</Label>
              <Input
                id="a-end"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={email} onCheckedChange={(v) => setEmail(v === true)} />
            Also send it by email
          </label>
          <p className="text-sm text-muted-foreground">
            This reaches about {preview.data?.recipients ?? 0} people.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={title.trim().length < 2 || body.trim().length === 0 || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Saving…' : 'Create announcement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
