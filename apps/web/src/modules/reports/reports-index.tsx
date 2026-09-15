'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ReportCatalogue } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/http';

/** The report catalogue (plan DP-A24), including the ones this build cannot produce yet. */
export function ReportsIndex({ basePath }: { basePath: string }) {
  const query = useQuery({
    queryKey: ['reports-catalogue'],
    queryFn: () => api<ReportCatalogue>('/reports'),
  });

  if (query.isPending) return <LoadingRows rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {query.data.reports.map((report) => (
          <Card key={report.name} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button variant="outline" size="sm" asChild>
                <Link href={`${basePath}/${report.name}`}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {query.data.pending.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Not in this build</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.pending.map((report) => (
              <Card key={report.name} className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-muted-foreground">{report.title}</CardTitle>
                  <CardDescription>{report.reason}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
