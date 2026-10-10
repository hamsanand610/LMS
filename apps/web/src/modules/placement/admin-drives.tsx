'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DriveCard, DriveStatus, Paginated } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SearchInput } from '@/components/ui/search-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/shell/page-header';
import { CompanyLogo } from './company-logo';
import { DriveForm } from './drive-form';

type Filter = 'all' | DriveStatus;

/** The drives board as staff run it: every drive, its stage, and how many applied. */
export function AdminDrives() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (filter !== 'all') params.set('status', filter);
  if (q.trim()) params.set('q', q.trim());
  const query = useQuery({
    queryKey: ['drives', 'staff', params.toString()],
    queryFn: () => api<Paginated<DriveCard>>(`/drives?${params.toString()}`),
  });

  return (
    <>
      <PageHeader
        title="Drives"
        description="Recruitment drives, who may apply, and where each application stands. A drive starts as a draft; opening it tells every eligible learner."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            New drive
          </Button>
        }
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            filter
            value={filter}
            onValueChange={(value) => {
              setFilter(value as Filter);
              setPage(1);
            }}
          >
            <TabsList variant="segmented" aria-label="Show">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Drafts</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </Tabs>
          <SearchInput
            wrapperClassName="w-full sm:w-72"
            placeholder="Search by role or company"
            aria-label="Search drives"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {query.isPending ? <LoadingRows rows={5} /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
        {query.data && query.data.data.length === 0 ? (
          <EmptyState
            title="No drives yet"
            description="Add the company first, then post its drive with the closing date and who may apply."
            action={<Button onClick={() => setCreating(true)}>New drive</Button>}
          />
        ) : null}

        {query.data && query.data.data.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drive</TableHead>
                    <TableHead>Closes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Applied</TableHead>
                    <TableHead className="text-right">Selected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.data.map((drive) => (
                    <TableRow key={drive.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <CompanyLogo
                            name={drive.company.name}
                            logoUrl={drive.company.logoUrl}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/admin/placements/${drive.id}`}
                              className="font-medium text-foreground hover:text-brand hover:underline"
                            >
                              {drive.role}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {drive.company.name} · {drive.code}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatDateTime(drive.applyBy)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={drive.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {drive.applicantCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {drive.selectedCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={page}
              pageSize={query.data.meta.pageSize}
              total={query.data.meta.total}
              onPageChange={setPage}
              noun="drives"
            />
          </>
        ) : null}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New drive</DialogTitle>
            <DialogDescription>
              It is saved as a draft. Learners see it only once you open it.
            </DialogDescription>
          </DialogHeader>
          <DriveForm
            drive={null}
            onCancel={() => setCreating(false)}
            onSaved={(drive) => {
              setCreating(false);
              router.push(`/admin/placements/${drive.id}`);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
