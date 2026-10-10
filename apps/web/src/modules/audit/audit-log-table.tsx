'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { type Paginated, formatDateTime } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { saveFile } from '@/lib/files/save-file';
import { useMe, useScope } from '@/shell/me-context';

interface AuditRow {
  id: string;
  occurredAt: string;
  actor: { id: string; name: string } | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  requestId: string | null;
}

/** At most this many entries go into one export; narrow the filters for more. */
const EXPORT_LIMIT = 2_000;

/**
 * The audit log (P-I07). The Super Admin reads the institute's; anyone else holding `audit:read`
 * at `own` reads their own actions, as the requirements' matrix sets it. Filters by action,
 * resource, person and dates; what the filters show can be exported as CSV.
 */
export function AuditLogTable() {
  const me = useMe();
  const readsAll = useScope('audit:read') === 'all';
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [actorId, setActorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const filters = new URLSearchParams();
  if (action) filters.set('action', action);
  if (resourceType) filters.set('resourceType', resourceType);
  if (actorId) filters.set('actorId', actorId);
  if (from) filters.set('from', new Date(`${from}T00:00:00`).toISOString());
  if (to) filters.set('to', new Date(`${to}T23:59:59`).toISOString());
  const params = new URLSearchParams(filters);
  params.set('page', String(page));
  params.set('pageSize', '25');
  const people = useQuery({
    queryKey: ['users', 'options'],
    queryFn: () => api<Paginated<{ id: string; name: string }>>('/users?pageSize=100&sort=name'),
    enabled: readsAll,
  });

  /** Every entry the filters select (up to the limit), as a CSV file. */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: AuditRow[] = [];
      for (let next = 1; rows.length < EXPORT_LIMIT; next += 1) {
        const pageParams = new URLSearchParams(filters);
        pageParams.set('page', String(next));
        pageParams.set('pageSize', '100');
        const chunk = await api<Paginated<AuditRow>>(`/audit-logs?${pageParams.toString()}`);
        rows.push(...chunk.data);
        if (chunk.data.length < 100) break;
      }
      // Text a spreadsheet would run as a formula (a name typed as "=…") gets a leading apostrophe,
      // as the API's own exports do (Step 6 audit).
      const cell = (value: unknown) => {
        const raw = String(value ?? '');
        const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
        return `"${text.replace(/"/g, '""')}"`;
      };
      const lines = [
        ['When', 'Actor', 'Action', 'Resource type', 'Resource', 'Summary', 'IP']
          .map(cell)
          .join(','),
        ...rows
          .slice(0, EXPORT_LIMIT)
          .map((row) =>
            [
              row.occurredAt,
              row.actor?.name ?? 'System',
              row.action,
              row.resourceType,
              row.resourceId,
              row.summary,
              row.ip,
            ]
              .map(cell)
              .join(','),
          ),
      ];
      saveFile(
        `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
        lines.join('\n'),
        'text/csv',
      );
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'The export could not be made');
    } finally {
      setExporting(false);
    }
  };
  const query = useQuery({
    queryKey: ['audit-logs', params.toString()],
    queryFn: () => api<Paginated<AuditRow>>(`/audit-logs?${params.toString()}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Action starts with… (e.g. auth., users.)"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
          aria-label="Filter by action"
        />
        <Input
          placeholder="Resource type (e.g. user)"
          value={resourceType}
          onChange={(e) => {
            setResourceType(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
          aria-label="Filter by resource type"
        />
        {readsAll ? (
          <NativeSelect
            aria-label="Filter by person"
            value={actorId}
            onChange={(e) => {
              setActorId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Anyone</option>
            {(people.data?.data ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        <Input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          className="w-40"
          aria-label="From"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          className="w-40"
          aria-label="To"
        />
        <Button variant="outline" disabled={exporting} onClick={() => void exportCsv()}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>
      {readsAll ? null : (
        <p className="text-sm text-muted-foreground">
          You see your own actions; the institute’s whole log is the Super Admin’s.
        </p>
      )}
      {query.isPending ? (
        <LoadingRows rows={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title="No audit entries match"
          description={
            action || resourceType || actorId || from || to
              ? 'Try clearing the filters.'
              : 'Actions appear here as people use the platform.'
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      {formatDateTime(row.occurredAt, { timeZone: me.organization.timezone })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.actor?.name ?? <span className="text-muted-foreground">system</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.action}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.resourceType}
                      {row.resourceId ? (
                        <span className="block truncate font-mono">{row.resourceId}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm">{row.summary}</TableCell>
                    <TableCell className="text-right">
                      <DetailsDialog row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {query.data.meta.page} · {query.data.meta.total} entries
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * query.data.meta.pageSize >= query.data.meta.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DetailsDialog({ row }: { row: AuditRow }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{row.action}</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-[120px_1fr] gap-2 text-sm">
          <dt className="text-muted-foreground">Request</dt>
          <dd className="font-mono text-xs">{row.requestId ?? '—'}</dd>
          <dt className="text-muted-foreground">IP</dt>
          <dd className="font-mono text-xs">{row.ip ?? '—'}</dd>
        </dl>
        <div className="grid gap-3 sm:grid-cols-2">
          <JsonBlock title="Before" value={row.before} />
          <JsonBlock title="After" value={row.after} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 text-xs">
        {value === null || value === undefined ? '—' : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
