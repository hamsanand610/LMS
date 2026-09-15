'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { IntegrationRecord, IntegrationTestResult } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';

/**
 * Provider configuration (plan DP-A34). Each card says which driver the build is **actually**
 * running, because that comes from the environment at boot rather than from these rows — a driver
 * selector that changed nothing would be a page that lies. The test button probes what is running.
 */
export function IntegrationsEditor() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api<IntegrationRecord[]>('/integrations'),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
        What is saved here is the configuration a deployment would be given. The running build takes
        its drivers from its environment, so a change takes effect when that environment is updated
        — the “in use” line on each card is the truth about this one.
      </p>
      {query.data.map((integration) => (
        <IntegrationCard
          key={integration.provider}
          integration={integration}
          onSaved={(records) => client.setQueryData(['integrations'], records)}
        />
      ))}
    </div>
  );
}

function IntegrationCard({
  integration,
  onSaved,
}: {
  integration: IntegrationRecord;
  onSaved: (records: IntegrationRecord[]) => void;
}) {
  const [driver, setDriver] = useState(integration.driver);
  const [config, setConfig] = useState<Record<string, string>>(() => ({ ...integration.config }));
  const [secret, setSecret] = useState('');
  const [result, setResult] = useState<IntegrationTestResult | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api<IntegrationRecord[]>(`/integrations/${integration.provider}`, {
        method: 'PATCH',
        // An empty box leaves the stored secret alone rather than clearing it by accident.
        body: { driver, config, ...(secret ? { secret } : {}) },
      }),
    onSuccess: (records) => {
      onSaved(records);
      setSecret('');
      toast.success(`${integration.label} saved`);
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'Could not save that'),
  });

  const test = useMutation({
    mutationFn: () =>
      api<IntegrationTestResult>(`/integrations/${integration.provider}/test`, { method: 'POST' }),
    onSuccess: (outcome) => {
      setResult(outcome);
      if (outcome.ok) toast.success(`${integration.label} answered`);
      else toast.error(`${integration.label} did not answer`);
    },
    onError: (error: Error) => toast.error(isApiError(error) ? error.message : 'Could not test'),
  });

  const chosen = integration.drivers.find((entry) => entry.key === driver);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{integration.label}</CardTitle>
          <Badge className="bg-muted text-muted-foreground">
            In use: {integration.activeDriver}
          </Badge>
          {integration.hasStoredSecret ? (
            <Badge className="bg-success-soft text-success">Secret stored</Badge>
          ) : null}
        </div>
        <CardDescription>{integration.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={`driver-${integration.provider}`}>Driver</Label>
          <select
            id={`driver-${integration.provider}`}
            value={driver}
            onChange={(event) => setDriver(event.target.value)}
            className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-2 text-sm"
          >
            {integration.drivers.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
          {chosen ? <p className="mt-1 text-xs text-muted-foreground">{chosen.note}</p> : null}
        </div>

        {integration.fields.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {integration.fields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={`${integration.provider}-${field.key}`}>{field.label}</Label>
                <Input
                  id={`${integration.provider}-${field.key}`}
                  value={config[field.key] ?? ''}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
        ) : null}

        {integration.hasSecret ? (
          <div>
            <Label htmlFor={`secret-${integration.provider}`}>Secret</Label>
            <Input
              id={`secret-${integration.provider}`}
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder={
                integration.hasStoredSecret ? 'Stored. Type to replace it.' : 'Not set yet'
              }
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Write-only: it is never shown again, here or anywhere else.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => test.mutate()}
            disabled={test.isPending}
          >
            {test.isPending ? 'Testing…' : 'Test what is running'}
          </Button>
          {result ? (
            <span className={`text-sm ${result.ok ? 'text-success' : 'text-danger'}`}>
              {result.detail}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
