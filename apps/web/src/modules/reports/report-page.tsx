'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  BatchSummary,
  ExportFormat,
  ExportJobRecord,
  Paginated,
  ReportCell,
  ReportData,
  ReportFilterKey,
  ReportName,
} from '@lms/shared';
import { BarChartCard, LineChartCard } from '@/components/charts';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';
import { PageHeader } from '@/shell/page-header';

type Filters = Partial<Record<ReportFilterKey, string>>;

/**
 * One report (plan DP-A25): a filter bar, summary tiles, a chart, a sortable table with a column
 * chooser, the definitions behind every figure, and an export of exactly what is on the screen.
 */
export function ReportPage({
  name,
  exportsHref,
  canExport,
}: {
  name: ReportName;
  exportsHref: string;
  canExport: boolean;
}) {
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const [hidden, setHidden] = useState<string[]>([]);

  const search = new URLSearchParams({ page: String(page), pageSize: '25' });
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value);
  }
  if (sort) search.set('sort', sort);

  const query = useQuery({
    queryKey: ['report', name, search.toString()],
    queryFn: () => api<ReportData>(`/reports/${name}?${search}`),
  });

  const batches = useQuery({
    queryKey: ['report-batches'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
  });

  const requestExport = useMutation({
    mutationFn: (format: ExportFormat) =>
      api<ExportJobRecord>('/exports', {
        method: 'POST',
        body: { report: name, format, params: { ...filters, ...(sort ? { sort } : {}) } },
      }),
    onSuccess: (job) => {
      toast.success(`Preparing ${job.filename}`, {
        description: 'It appears in Exports when the file is ready.',
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setFilter = (key: ReportFilterKey, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  if (query.isPending) return <LoadingRows rows={8} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const report = query.data;
  const columns = report.columns.filter((column) => !hidden.includes(column.key));

  return (
    <>
      <PageHeader
        title={report.title}
        description={report.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <DefinitionsDrawer report={report} />
            {canExport ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => requestExport.mutate('csv')}
                  disabled={requestExport.isPending}
                >
                  Export CSV
                </Button>
                <Button
                  onClick={() => requestExport.mutate('xlsx')}
                  disabled={requestExport.isPending}
                >
                  Export Excel
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        {report.filters.includes('from') ? (
          <>
            <div>
              <Label htmlFor="from" className="text-xs">
                From
              </Label>
              <Input
                id="from"
                type="date"
                value={filters.from ?? ''}
                onChange={(event) => setFilter('from', event.target.value)}
                className="h-9 w-40"
              />
            </div>
            <div>
              <Label htmlFor="to" className="text-xs">
                To
              </Label>
              <Input
                id="to"
                type="date"
                value={filters.to ?? ''}
                onChange={(event) => setFilter('to', event.target.value)}
                className="h-9 w-40"
              />
            </div>
          </>
        ) : null}

        {report.filters.includes('batchId') ? (
          <div>
            <Label htmlFor="batch" className="text-xs">
              Batch
            </Label>
            <select
              id="batch"
              value={filters.batchId ?? ''}
              onChange={(event) => setFilter('batchId', event.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">Every batch</option>
              {(batches.data?.data ?? []).map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.code}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {report.filters.includes('q') ? (
          <div className="min-w-48 flex-1">
            <Label htmlFor="q" className="text-xs">
              Search
            </Label>
            <Input
              id="q"
              value={filters.q ?? ''}
              onChange={(event) => setFilter('q', event.target.value)}
              placeholder="Name, code or batch"
              className="h-9"
            />
          </div>
        ) : null}

        <ColumnChooser
          columns={report.columns}
          hidden={hidden}
          onToggle={(key) =>
            setHidden((current) =>
              current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
            )
          }
        />

        {Object.values(filters).some(Boolean) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({});
              setPage(1);
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {report.summary.map((tile) => (
          <Card key={tile.key}>
            <CardHeader className="pb-2">
              <CardDescription>{tile.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {tile.value === null ? '—' : tile.value}
                {tile.value !== null && tile.unit === 'percent' ? '%' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{tile.definition}</CardContent>
          </Card>
        ))}
      </div>

      {report.chart ? (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{report.chart.title}</CardTitle>
            <CardDescription>{report.chart.note}</CardDescription>
          </CardHeader>
          <CardContent>
            {report.chart.kind === 'line' ? (
              <LineChartCard
                data={report.chart.data}
                xKey={report.chart.xKey}
                series={report.chart.series}
                unit="%"
              />
            ) : (
              <BarChartCard
                data={report.chart.data}
                xKey={report.chart.xKey}
                series={report.chart.series}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      {report.rows.length === 0 ? (
        <EmptyState
          title="Nothing matches these filters"
          description="Widen the dates or clear the filters to see more."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={
                        column.type === 'number' || column.type === 'percent'
                          ? 'text-right'
                          : undefined
                      }
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => {
                            setSort(sort === column.key ? `-${column.key}` : column.key);
                            setPage(1);
                          }}
                        >
                          {column.label}
                          {sort === column.key ? ' ▲' : sort === `-${column.key}` ? ' ▼' : ''}
                        </button>
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row, index) => (
                  <TableRow key={String(row[columns[0]?.key ?? 'id'] ?? index)}>
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={
                          column.type === 'number' || column.type === 'percent'
                            ? 'text-right tabular-nums'
                            : undefined
                        }
                      >
                        <Cell value={row[column.key] ?? null} type={column.type} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3">
            <PaginationBar
              page={report.meta.page}
              pageSize={report.meta.pageSize}
              total={report.meta.total}
              onPageChange={setPage}
              noun="rows"
            />
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Read at {new Date(report.asOf).toLocaleTimeString()}.{' '}
        {canExport ? (
          <>
            An export has the same {report.meta.total} rows as this table.{' '}
            <Link href={exportsHref} className="underline">
              Your exports
            </Link>
            .
          </>
        ) : null}
      </p>
    </>
  );
}

function Cell({ value, type }: { value: ReportCell; type: string }) {
  if (value === null || value === '') return <span className="text-muted-foreground">—</span>;
  if (type === 'percent') return <>{value}%</>;
  if (type === 'status') return <StatusBadge status={String(value)} />;
  return <>{value}</>;
}

function ColumnChooser({
  columns,
  hidden,
  onToggle,
}: {
  columns: ReportData['columns'];
  hidden: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          Columns
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Columns</SheetTitle>
          <SheetDescription>
            Hiding a column changes the table, not the export: a file always carries every column.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 p-4">
          {columns.map((column) => (
            <label key={column.key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!hidden.includes(column.key)}
                onCheckedChange={() => onToggle(column.key)}
              />
              {column.label}
            </label>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DefinitionsDrawer({ report }: { report: ReportData }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">What these mean</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{report.title}</SheetTitle>
          <SheetDescription>How every figure on this page is worked out.</SheetDescription>
        </SheetHeader>
        <dl className="space-y-4 p-4 text-sm">
          {report.definitions.map((definition) => (
            <div key={definition.term}>
              <dt className="font-medium">{definition.term}</dt>
              <dd className="text-muted-foreground">{definition.text}</dd>
            </div>
          ))}
          {report.summary.map((tile) => (
            <div key={tile.key}>
              <dt className="font-medium">{tile.label}</dt>
              <dd className="text-muted-foreground">{tile.definition}</dd>
            </div>
          ))}
        </dl>
      </SheetContent>
    </Sheet>
  );
}
