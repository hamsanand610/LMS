'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import type { BatchSummary, FeatureFlag, Paginated } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';

export function FeatureFlagsTable() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const query = useQuery({ queryKey: ['flags'], queryFn: () => api<FeatureFlag[]>('/flags') });
  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      api<FeatureFlag>(`/flags/${encodeURIComponent(key)}`, { method: 'PATCH', body: { enabled } }),
    onSuccess: (flag) => {
      queryClient.setQueryData<FeatureFlag[]>(['flags'], (old) =>
        old?.map((f) => (f.key === flag.key ? flag : f)),
      );
      toast.success(`${flag.key} ${flag.enabled ? 'enabled' : 'disabled'}`);
      router.refresh();
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not update the flag'),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0)
    return (
      <EmptyState
        title="No flags yet"
        description="Modules that can be switched on or off will appear here as they are added."
      />
    );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Flag</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Audience</TableHead>
            <TableHead className="text-right">Enabled</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data.map((flag) => (
            <TableRow key={flag.key}>
              <TableCell className="font-mono text-xs">{flag.key}</TableCell>
              <TableCell className="max-w-md text-sm text-muted-foreground">
                {flag.description}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{flag.kind}</Badge>
                {flag.locked ? (
                  <Badge variant="outline" className="ml-1">
                    core
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-sm">
                {flag.locked ? (
                  <span className="text-muted-foreground">Everyone</span>
                ) : (
                  <Button variant="link" className="h-auto p-0" onClick={() => setEditing(flag)}>
                    {describeAudience(flag)}
                  </Button>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Switch
                  aria-label={`Toggle ${flag.key}`}
                  checked={flag.enabled}
                  disabled={flag.locked || toggle.isPending}
                  onCheckedChange={(enabled) => toggle.mutate({ key: flag.key, enabled })}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {editing ? (
        <AudienceDialog
          flag={editing}
          onClose={() => setEditing(null)}
          onSaved={(flag) => {
            queryClient.setQueryData<FeatureFlag[]>(['flags'], (old) =>
              old?.map((f) => (f.key === flag.key ? flag : f)),
            );
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function describeAudience(flag: FeatureFlag): string {
  const { roleKeys, batchIds } = flag.audience;
  if (roleKeys.length === 0 && batchIds.length === 0) return 'Everyone';
  const parts = [];
  if (roleKeys.length > 0) parts.push(`${roleKeys.length} role${roleKeys.length === 1 ? '' : 's'}`);
  if (batchIds.length > 0)
    parts.push(`${batchIds.length} batch${batchIds.length === 1 ? '' : 'es'}`);
  return parts.join(' · ');
}

/**
 * Who an optional module reaches while it is on (Phases 3–4, D5): some roles, some batches, or
 * everyone. The server enforces it; staff without a batch of their own and the Super Admin are
 * never shut out.
 */
function AudienceDialog({
  flag,
  onClose,
  onSaved,
}: {
  flag: FeatureFlag;
  onClose: () => void;
  onSaved: (flag: FeatureFlag) => void;
}) {
  const [roleKeys, setRoleKeys] = useState<string[]>(flag.audience.roleKeys);
  const [batchIds, setBatchIds] = useState<string[]>(flag.audience.batchIds);
  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<{ key: string; name: string }[]>('/roles'),
  });
  const batches = useQuery({
    queryKey: ['batches', 'options'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
  });
  const save = useMutation({
    mutationFn: () =>
      api<FeatureFlag>(`/flags/${encodeURIComponent(flag.key)}`, {
        method: 'PATCH',
        body: { audience: { roleKeys, batchIds } },
      }),
    onSuccess: (saved) => {
      toast.success(`${saved.key}: audience saved`);
      onSaved(saved);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The audience could not be saved'),
  });
  const toggle = (list: string[], value: string, set: (next: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Who sees {flag.key}</DialogTitle>
          <DialogDescription>
            Leave both empty for everyone. Choosing batches reaches their learners and trainers;
            staff without a batch of their own are never shut out.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Roles</legend>
            <div className="flex flex-wrap gap-3">
              {(roles.data ?? []).map((role) => {
                const id = `audience-role-${role.key}`;
                return (
                  <div key={role.key} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={roleKeys.includes(role.key)}
                      onCheckedChange={() => toggle(roleKeys, role.key, setRoleKeys)}
                    />
                    <Label htmlFor={id} className="font-normal">
                      {role.name}
                    </Label>
                  </div>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Batches</legend>
            <div className="flex max-h-48 flex-wrap gap-3 overflow-y-auto rounded-md border border-border p-2">
              {(batches.data?.data ?? []).map((batch) => {
                const id = `audience-batch-${batch.id}`;
                return (
                  <div key={batch.id} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={batchIds.includes(batch.id)}
                      onCheckedChange={() => toggle(batchIds, batch.id, setBatchIds)}
                    />
                    <Label htmlFor={id} className="font-normal">
                      {batch.code}
                    </Label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save audience'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
