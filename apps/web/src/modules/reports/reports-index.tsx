'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  FileCheck,
  GraduationCap,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReportCatalogue } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { SectionHeader } from '@/components/section-header';
import { api } from '@/lib/api/http';

const REPORT_ICON: Record<string, LucideIcon> = {
  students: GraduationCap,
  attendance: CalendarCheck,
  progress: TrendingUp,
  assessments: FileCheck,
  assignments: ClipboardList,
};

/** The report catalogue (plan DP-A24), including the ones this build cannot produce yet. */
export function ReportsIndex({ basePath }: { basePath: string }) {
  const query = useQuery({
    queryKey: ['reports-catalogue'],
    queryFn: () => api<ReportCatalogue>('/reports'),
  });

  if (query.isPending) return <LoadingRows rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-10">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {query.data.reports.map((report) => {
          const Icon = REPORT_ICON[report.name] ?? BarChart3;
          return (
            <li
              key={report.name}
              className="flex flex-col rounded-xl border border-border bg-card p-5 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm"
            >
              <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-brand">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-[15px] font-semibold text-foreground">{report.title}</h2>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                {report.description}
              </p>
              <Link
                href={`${basePath}/${report.name}`}
                className="group/open mt-4 inline-flex items-center gap-1.5 self-start rounded-md text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                Open
                <span className="sr-only"> the {report.title.toLowerCase()} report</span>
                <ArrowRight
                  className="size-4 transition-transform group-hover/open:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>

      {query.data.pending.length > 0 ? (
        <section aria-labelledby="pending-reports">
          <SectionHeader
            id="pending-reports"
            title="Not available yet"
            description="Listed so nobody goes looking for them, with the reason."
          />
          <ul className="flex flex-wrap gap-px overflow-hidden rounded-xl border border-dashed border-border bg-border">
            {query.data.pending.map((report) => (
              <li key={report.name} className="min-w-0 flex-1 basis-64 bg-background px-5 py-4">
                <p className="text-sm font-medium text-foreground-secondary">{report.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {report.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
