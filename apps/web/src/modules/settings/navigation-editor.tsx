'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PORTALS, type Portal } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';

interface NavItemConfig {
  key: string;
  label: string;
  route: string;
  icon: string;
  order: number;
  group?: string;
  hidden: boolean;
  defaultLabel: string;
  defaultOrder: number;
}

interface NavConfig {
  portal: Portal;
  items: NavItemConfig[];
}

export function NavigationEditor() {
  const [portal, setPortal] = useState<Portal>('admin');
  return (
    <Tabs value={portal} onValueChange={(v) => setPortal(v as Portal)}>
      <TabsList>
        {PORTALS.map((p) => (
          <TabsTrigger key={p} value={p} className="capitalize">
            {p}
          </TabsTrigger>
        ))}
      </TabsList>
      {PORTALS.map((p) => (
        <TabsContent key={p} value={p}>
          <PortalNavigation portal={p} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function PortalNavigation({ portal }: { portal: Portal }) {
  const query = useQuery({
    queryKey: ['navigation', portal],
    queryFn: () => api<NavConfig>(`/navigation/${portal}`),
  });
  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.items.length === 0)
    return (
      <EmptyState
        title="No navigation items"
        description="This portal has no menu items. Switch on a module under Feature flags to add its pages."
      />
    );
  // Remount the editor whenever fresh server data arrives so its draft starts from the saved state.
  return (
    <PortalNavigationEditor key={query.dataUpdatedAt} portal={portal} initial={query.data.items} />
  );
}

function PortalNavigationEditor({ portal, initial }: { portal: Portal; initial: NavItemConfig[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<NavItemConfig[]>(initial);

  const save = useMutation({
    mutationFn: (next: NavItemConfig[]) =>
      api<NavConfig>(`/navigation/${portal}`, {
        method: 'PATCH',
        // Only real overrides are stored; defaults come from the module manifests.
        body: next.map((i) => ({
          key: i.key,
          label: i.label.trim() && i.label.trim() !== i.defaultLabel ? i.label.trim() : undefined,
          order: i.order !== i.defaultOrder ? i.order : undefined,
          hidden: i.hidden || undefined,
        })),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['navigation', portal], data);
      toast.success(`${portal} navigation saved`);
      router.refresh();
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not save navigation'),
  });

  const update = (key: string, patch: Partial<NavItemConfig>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-40">Item</TableHead>
              <TableHead className="min-w-48">Label</TableHead>
              <TableHead className="w-24">Order</TableHead>
              <TableHead>Route</TableHead>
              <TableHead className="text-right">Visible</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...items]
              .sort((a, b) => a.order - b.order)
              .map((item) => (
                <TableRow key={item.key}>
                  <TableCell>
                    <p className="text-sm font-medium">{item.defaultLabel}</p>
                    <p className="text-xs text-muted-foreground">{item.group ?? '—'}</p>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.label}
                      maxLength={40}
                      onChange={(e) => update(item.key, { label: e.target.value })}
                      aria-label={`Label for ${item.defaultLabel}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={1000}
                      value={item.order}
                      onChange={(e) => update(item.key, { order: Number(e.target.value) })}
                      aria-label={`Order for ${item.defaultLabel}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.route}
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={!item.hidden}
                      onCheckedChange={(v) => update(item.key, { hidden: !v })}
                      aria-label={`Show ${item.defaultLabel}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={!dirty} onClick={() => setItems(initial)}>
          Discard
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setItems((prev) =>
              prev.map((i) => ({
                ...i,
                label: i.defaultLabel,
                order: i.defaultOrder,
                hidden: false,
              })),
            )
          }
        >
          Reset to defaults
        </Button>
        <Button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate(items)}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
