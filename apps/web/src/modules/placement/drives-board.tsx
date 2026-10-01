'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Clock, MapPin, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  APPLICATION_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  type DriveCard,
  type Paginated,
  type PlacementSummary,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatStrip } from '@/components/stat-strip';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { formatDateTime, formatRelativeDay } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { CompanyLogo } from './company-logo';

type View = 'open' | 'applied' | 'closed';

/** What a drive card says about the learner's standing: applied, may apply, or why not. */
export function DriveStanding({ drive }: { drive: DriveCard }) {
  if (drive.application && drive.application.status !== 'withdrawn') {
    return (
      <StatusBadge
        status={drive.application.status}
        label={APPLICATION_STATUS_LABELS[drive.application.status]}
      />
    );
  }
  if (drive.eligible) return <StatusBadge status="open" label="You can apply" />;
  if (drive.status !== 'open') return <StatusBadge status="closed" label="Closed" />;
  return <StatusBadge status="ineligible" label="Not eligible" tone="neutral" />;
}

export function DriveFacts({ drive, className }: { drive: DriveCard; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground', className)}>
      <li>{EMPLOYMENT_TYPE_LABELS[drive.employmentType]}</li>
      {drive.location ? (
        <li className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" aria-hidden="true" />
          {drive.location}
        </li>
      ) : null}
      {drive.packageText ? (
        <li className="inline-flex items-center gap-1">
          <Wallet className="size-3.5" aria-hidden="true" />
          {drive.packageText}
        </li>
      ) : null}
    </ul>
  );
}

/** The learner's drives: open ones to apply to, the ones applied to, and the ones gone by. */
export function DrivesBoard({ companyId }: { companyId?: string }) {
  const now = useNow();
  const [view, setView] = useState<View>('open');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ view, page: String(page), pageSize: '20' });
  if (companyId) params.set('companyId', companyId);
  const query = useQuery({
    queryKey: ['drives', params.toString()],
    queryFn: () => api<Paginated<DriveCard>>(`/drives?${params.toString()}`),
  });
  const summary = useQuery({
    queryKey: ['placement-summary'],
    queryFn: () => api<PlacementSummary>('/me/placement'),
  });

  return (
    <div className="space-y-5">
      {summary.data ? (
        <StatStrip
          items={[
            { label: 'Open to you', value: summary.data.eligibleOpen },
            { label: 'Applied', value: summary.data.applied },
            { label: 'Shortlisted', value: summary.data.shortlisted },
            { label: 'Selected', value: summary.data.selected },
          ]}
        />
      ) : null}

      <Tabs
        value={view}
        onValueChange={(value) => {
          setView(value as View);
          setPage(1);
        }}
      >
        <TabsList variant="segmented" aria-label="Show">
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="applied">Applied</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isPending ? <LoadingRows rows={4} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title={
            view === 'open'
              ? 'No drive is open right now'
              : view === 'applied'
                ? 'You have not applied to anything yet'
                : 'Nothing has closed yet'
          }
          description={
            view === 'open'
              ? 'You are told as soon as a drive you can apply to opens. Meanwhile, interview prep is always open.'
              : 'Applications and their stages appear here.'
          }
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {query.data.data.map((drive) => {
              const closed =
                drive.status !== 'open' || (now !== null && Date.parse(drive.applyBy) <= now);
              return (
                <li key={drive.id}>
                  <Link
                    href={`/placements/${drive.id}`}
                    className="group/row flex items-start gap-4 px-4 py-4 transition-colors hover:bg-surface-2/60 sm:items-center"
                  >
                    <CompanyLogo name={drive.company.name} logoUrl={drive.company.logoUrl} />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block truncate font-semibold text-foreground">
                        {drive.role}
                      </span>
                      <span className="block truncate text-sm text-foreground-secondary">
                        {drive.company.name} · {drive.code}
                      </span>
                      <DriveFacts drive={drive} />
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                      <DriveStanding drive={drive} />
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {closed
                          ? `Closed ${formatDateTime(drive.applyBy)}`
                          : `Closes ${now === null ? formatDateTime(drive.applyBy) : formatRelativeDay(drive.applyBy, now)}`}
                      </span>
                    </span>
                    <ChevronRight
                      className="hidden size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover/row:translate-x-0.5 sm:block"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
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
  );
}
