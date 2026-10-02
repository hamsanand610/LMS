'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowUpDown,
  BookOpen,
  Columns3,
  Download,
  FileSpreadsheet,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  REPORT_FILTER_KEYS,
  type BatchSummary,
  type ExportFormat,
  type ExportJobRecord,
  type Paginated,
  type ReportCell,
  type ReportData,
  type ReportFilterKey,
  type ReportName,
} from '@lms/shared';
import { BarChartCard, LineChartCard } from '@/components/charts';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
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
import { NativeSelect } from '@/components/ui/native-select';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

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
  // A link from a batch or a course opens the report already filtered to it.
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() =>
    Object.fromEntries(
      REPORT_FILTER_KEYS.flatMap((key) => {
        const value = params.get(key);
        return value ? [[key, value]] : [];
      }),
    ),
  );
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
        back={{ href: exportsHref.replace(/\/exports$/, '/reports'), label: 'Reports' }}
        eyebrow="Report"
        title={report.title}
        description={report.description}
        actions={
          <>
            <DefinitionsDrawer report={report} />
            {canExport ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => requestExport.mutate('csv')}
                  disabled={requestExport.isPending}
                >
                  <Download aria-hidden="true" />
                  Export CSV
                </Button>
                <Button
                  onClick={() => requestExport.mutate('xlsx')}
                  disabled={requestExport.isPending}
                >
                  <FileSpreadsheet aria-hidden="true" />
                  Export Excel
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
        {report.filters.includes('from') ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs text-muted-foreground">
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
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs text-muted-foreground">
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
          <div className="space-y-1">
            <Label htmlFor="batch" className="text-xs text-muted-foreground">
              Batch
            </Label>
            <NativeSelect
              id="batch"
              value={filters.batchId ?? ''}
              onChange={(event) => setFilter('batchId', event.target.value)}
              className="min-w-40"
            >
              <option value="">Every batch</option>
              {(batches.data?.data ?? []).map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.code}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        {report.filters.includes('q') ? (
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor="q" className="text-xs text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="q"
                value={filters.q ?? ''}
                onChange={(event) => setFilter('q', event.target.value)}
                placeholder="Name, code or batch"
                className="h-9 pl-9"
              />
            </div>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {Object.values(filters).some(Boolean) ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({});
                setPage(1);
              }}
            >
              <X aria-hidden="true" />
              Clear
            </Button>
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
        </div>
      </div>

      {report.summary.length > 0 ? (
        <dl className="mb-6 flex flex-wrap gap-px overflow-hidden rounded-xl border border-border bg-border">
          {report.summary.map((tile) => (
            <div key={tile.key} className="min-w-0 flex-1 basis-56 bg-card px-5 py-4">
              <dt className="text-xs text-muted-foreground">{tile.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                {tile.value === null ? '—' : tile.value}
                {tile.value !== null && tile.unit === 'percent' ? '%' : ''}
              </dd>
              <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {tile.definition}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {report.chart ? (
        <section className="mb-6 rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            {/* A paragraph, not a heading: the page's one heading is the report's name. */}
            <p className="text-base font-semibold text-foreground">{report.chart.title}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{report.chart.note}</p>
          </div>
          {report.chart.kind === 'line' ? (
            <LineChartCard
              data={report.chart.data}
              xKey={report.chart.xKey}
              series={report.chart.series}
              unit="%"
              label={report.chart.title}
            />
          ) : (
            <BarChartCard
              data={report.chart.data}
              xKey={report.chart.xKey}
              series={report.chart.series}
              label={report.chart.title}
            />
          )}
        </section>
      ) : null}

      {report.rows.length === 0 ? (
        <EmptyState
          title="Nothing matches these filters"
          description="Widen the dates or clear the filters to see more."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => {
                    const numeric = column.type === 'number' || column.type === 'percent';
                    const direction =
                      sort === column.key
                        ? 'ascending'
                        : sort === `-${column.key}`
                          ? 'descending'
                          : undefined;
                    return (
                      <TableHead
                        key={column.key}
                        aria-sort={column.sortable ? (direction ?? 'none') : undefined}
                        className={numeric ? 'text-right' : undefined}
                      >
                        {column.sortable ? (
                          <button
                            type="button"
                            className={cn(
                              'group/sort inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground',
                              direction && 'text-foreground',
                            )}
                            onClick={() => {
                              setSort(sort === column.key ? `-${column.key}` : column.key);
                              setPage(1);
                            }}
                          >
                            {column.label}
                            {direction ? (
                              <span className="text-brand">
                                {direction === 'ascending' ? ' ▲' : ' ▼'}
                              </span>
                            ) : (
                              <ArrowUpDown
                                className="size-3 opacity-40 transition-opacity group-hover/sort:opacity-80"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        ) : (
                          column.label
                        )}
                      </TableHead>
                    );
                  })}
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
        Read at {formatTime(report.asOf)}.{' '}
        {canExport ? (
          <>
            An export has the same {report.meta.total} rows as this table.{' '}
            <Link
              href={exportsHref}
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
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
          <Columns3 aria-hidden="true" />
          Columns
          {hidden.length > 0 ? (
            <span className="rounded-full bg-surface-2 px-1.5 text-[11px] text-muted-foreground tabular-nums">
              {columns.length - hidden.length}/{columns.length}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Columns</SheetTitle>
          <SheetDescription>
            Hiding a column changes the table, not the export: a file always carries every column.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-1 p-4">
          {columns.map((column) => (
            <label
              key={column.key}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-surface-2"
            >
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
        <Button variant="ghost">
          <BookOpen aria-hidden="true" />
          What these mean
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{report.title}</SheetTitle>
          <SheetDescription>How every figure on this page is worked out.</SheetDescription>
        </SheetHeader>
        <dl className="space-y-4 p-4 text-sm leading-relaxed">
          {report.definitions.map((definition) => (
            <div key={definition.term}>
              <dt className="font-medium text-foreground">{definition.term}</dt>
              <dd className="text-muted-foreground">{definition.text}</dd>
            </div>
          ))}
          {report.summary.map((tile) => (
            <div key={tile.key}>
              <dt className="font-medium text-foreground">{tile.label}</dt>
              <dd className="text-muted-foreground">{tile.definition}</dd>
            </div>
          ))}
        </dl>
      </SheetContent>
    </Sheet>
  );
}
