'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { FeatureFlag } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
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
    </div>
  );
}
