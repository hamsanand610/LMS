'use client';

import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/http';

interface Check {
  ok: boolean;
  detail?: string;
  driver?: string;
}

interface HealthResponse {
  version: string;
  env: string;
  clientKey: string;
  time: string;
  checks: {
    db: Check;
    storage: Check;
    email: Check;
    queue: { queued: number; active: number; failed: number; mode: string; error?: string };
  };
  execution: { driver: string; serverExecution: boolean };
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <Badge className={ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}>
      {ok ? 'OK' : 'Problem'}
    </Badge>
  );
}

export function SystemHealthCards() {
  const query = useQuery({
    queryKey: ['admin-health'],
    queryFn: () => api<HealthResponse>('/admin/health'),
    refetchInterval: 30_000,
  });
  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const { checks, execution } = query.data;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <HealthCard
        title="Database"
        ok={checks.db.ok}
        detail={checks.db.detail ?? 'PostgreSQL reachable'}
      />
      <HealthCard
        title="Storage"
        ok={checks.storage.ok}
        detail={checks.storage.detail ?? `Driver: ${checks.storage.driver ?? 's3'}`}
      />
      <HealthCard
        title="Email"
        ok={checks.email.ok}
        detail={checks.email.detail ?? `Driver: ${checks.email.driver ?? 'smtp'}`}
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Background jobs</CardTitle>
          <StatusBadge ok={!checks.queue.error && checks.queue.failed === 0} />
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Mode: {checks.queue.mode}</p>
          <p>
            Queued {checks.queue.queued} · Active {checks.queue.active} · Failed{' '}
            {checks.queue.failed}
          </p>
          {checks.queue.error ? <p className="text-danger">{checks.queue.error}</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Code execution</CardTitle>
          <Badge variant="secondary">{execution.driver}</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {execution.serverExecution
            ? 'Trusted server-side grading through an isolated Judge0 service.'
            : 'Browser sandbox prototype: code runs in the visitor’s browser; results are marked untrusted.'}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deployment</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Version {query.data.version}</p>
          <p>Environment: {query.data.env}</p>
          <p>Client: {query.data.clientKey}</p>
          <p>Checked at {new Date(query.data.time).toLocaleTimeString()}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthCard({ title, ok, detail }: { title: string; ok: boolean; detail: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <StatusBadge ok={ok} />
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}
