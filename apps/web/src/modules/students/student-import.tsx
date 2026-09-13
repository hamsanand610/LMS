'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import type { BatchSummary, ImportJobResult, Paginated } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';

const NONE = 'none';
const MAX_BYTES = 5 * 1024 * 1024;
/** How long to follow a queued import before giving up on the page (the job keeps running). */
const JOB_TIMEOUT_MS = 120_000;

/** Polls an import job until the worker marks it done or failed. */
async function waitForJob(job: ImportJobResult): Promise<ImportJobResult> {
  const deadline = Date.now() + JOB_TIMEOUT_MS;
  let current = job;
  while (current.status === 'queued' || current.status === 'running') {
    if (Date.now() > deadline)
      throw new Error(
        'The import is taking longer than expected; check the list of recent imports.',
      );
    await new Promise((resolve) => setTimeout(resolve, 700));
    current = await api<ImportJobResult>(`/students/import/${job.id}`);
  }
  return current;
}

/**
 * Upload → check → import. The check is a real dry run on the server, so what it reports is
 * exactly what the import will do.
 */
export function StudentImport() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('');
  const [batchId, setBatchId] = useState(NONE);
  const [sendInvitations, setSendInvitations] = useState(true);
  const [preview, setPreview] = useState<ImportJobResult | null>(null);
  const [result, setResult] = useState<ImportJobResult | null>(null);

  const batches = useQuery({
    queryKey: ['batches', 'options'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
  });
  const history = useQuery({
    queryKey: ['student-imports'],
    queryFn: () => api<ImportJobResult[]>('/students/import'),
  });

  const run = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const started = await api<ImportJobResult>('/students/import', {
        body: {
          content,
          filename: filename || 'students.csv',
          batchId: batchId === NONE ? null : batchId,
          sendInvitations,
          dryRun,
        },
      });
      // The API queues the work, so follow the job until the worker has finished it.
      return waitForJob(started);
    },
    onSuccess: (job) => {
      if (job.dryRun) {
        setPreview(job);
        setResult(null);
        toast.success(`Checked ${job.total} rows`);
      } else {
        setResult(job);
        setPreview(null);
        void queryClient.invalidateQueries({ queryKey: ['students'] });
        void queryClient.invalidateQueries({ queryKey: ['student-imports'] });
        toast.success(`${job.created} students imported`);
      }
    },
    onError: (error) => {
      if (isApiError(error) && error.problem?.detail) toast.error(error.problem.detail);
      else toast.error(isApiError(error) ? error.message : 'The import could not be started');
    },
  });

  const busy = run.isPending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error('The file is larger than 5 MB');
      return;
    }
    setContent(await file.text());
    setFilename(file.name);
    setPreview(null);
    setResult(null);
  };

  const downloadTemplate = async () => {
    try {
      const csv = await api<string>('/students/import/template');
      const blob = new Blob([typeof csv === 'string' ? csv : String(csv)], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student-import-template.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the template');
    }
  };

  const rowCount = content ? Math.max(content.trim().split('\n').length - 1, 0) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose a file</CardTitle>
          <CardDescription>
            A comma or tab separated sheet with a header row. `name` and `email` are required; the
            other columns are optional. Up to 5,000 rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="import-file">Sheet</Label>
              <Input
                id="import-file"
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => void downloadTemplate()}>
              Download template
            </Button>
          </div>
          {content ? (
            <p className="text-sm text-muted-foreground">
              {filename} · {rowCount} data row{rowCount === 1 ? '' : 's'}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Batch for rows without a batch code</Label>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No batch</SelectItem>
                {(batches.data?.data ?? [])
                  .filter((b) => b.status === 'planned' || b.status === 'running')
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={sendInvitations}
              onCheckedChange={(v) => setSendInvitations(v === true)}
            />
            Send each new student an invitation email
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Check, then import</CardTitle>
          <CardDescription>
            Checking writes nothing. Import creates the accounts that passed the check.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!content || busy}
              onClick={() => run.mutate(true)}
            >
              {busy && run.variables === true ? 'Checking…' : 'Check the file'}
            </Button>
            <Button
              type="button"
              disabled={!content || busy || preview === null}
              onClick={() => run.mutate(false)}
            >
              {busy && run.variables === false ? 'Importing…' : 'Import students'}
            </Button>
          </div>

          {preview ? <ImportReport job={preview} heading="Check result" /> : null}
          {result ? (
            <>
              <ImportReport job={result} heading="Import result" />
              <Button variant="outline" onClick={() => router.push('/admin/students')}>
                Open the student list
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent imports</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isPending ? (
            <LoadingRows rows={3} />
          ) : history.isError ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : history.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing imported yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="text-sm">
                      {job.filename}
                      {job.dryRun ? (
                        <span className="ml-1 text-xs text-muted-foreground">(check)</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums">{job.total}</TableCell>
                    <TableCell className="tabular-nums">{job.created}</TableCell>
                    <TableCell className="tabular-nums">{job.failed + job.skipped}</TableCell>
                    <TableCell className="capitalize">{job.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ImportReport({ job, heading }: { job: ImportJobResult; heading: string }) {
  const problems = job.failed + job.skipped;
  return (
    <div className="space-y-3">
      <Alert variant={problems > 0 ? 'destructive' : 'default'}>
        <AlertTitle>{heading}</AlertTitle>
        <AlertDescription>
          {job.created} of {job.total} rows {job.dryRun ? 'would be imported' : 'imported'}
          {problems > 0 ? `; ${problems} need attention.` : '.'}
        </AlertDescription>
      </Alert>
      {job.errors.length > 0 ? (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Row</TableHead>
                <TableHead className="w-32">Column</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Problem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {job.errors.map((error, index) => (
                <TableRow key={`${error.row}-${error.column}-${index}`}>
                  <TableCell className="tabular-nums">{error.row}</TableCell>
                  <TableCell className="font-mono text-xs">{error.column ?? '—'}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs">{error.value}</TableCell>
                  <TableCell className="text-sm">{error.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
