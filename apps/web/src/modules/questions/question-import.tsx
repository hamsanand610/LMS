'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type { QuestionImportResult } from '@lms/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { publicEnv } from '@/lib/env';

/** Bulk loading objective questions: check the sheet first, then write it. */
export function QuestionImport({ basePath = '/admin/question-bank' }: { basePath?: string }) {
  const [content, setContent] = useState('');
  const [publish, setPublish] = useState(false);
  const [checked, setChecked] = useState<QuestionImportResult | null>(null);
  const [imported, setImported] = useState<QuestionImportResult | null>(null);

  const run = useMutation({
    mutationFn: (dryRun: boolean) =>
      api<QuestionImportResult>('/questions/import', {
        method: 'POST',
        body: { content, dryRun, publish },
      }),
    onSuccess: (result, dryRun) => {
      if (dryRun) {
        setChecked(result);
        setImported(null);
        toast.success(
          result.failed === 0
            ? `${result.total} rows read, nothing wrong with any of them.`
            : `${result.failed} row(s) cannot be used; they are listed below.`,
        );
      } else {
        setImported(result);
        toast.success(`${result.imported} question(s) imported.`);
      }
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The sheet could not be read'),
  });

  const readFile = async (file: File) => {
    setContent(await file.text());
    setChecked(null);
    setImported(null);
  };

  const shown = imported ?? checked;

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Start from the template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            The sheet carries multiple-choice, true/false and written questions. A coding question
            needs its test cases, which a flat sheet cannot hold, so those are written in the
            editor.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href={`${publicEnv.apiUrl}/api/v1/questions/import/template`}>
              Download the template
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Paste or upload the sheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            aria-label="Choose a sheet"
            className="block text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
          <Textarea
            aria-label="Sheet contents"
            rows={8}
            className="font-mono text-xs"
            placeholder="title,body,type,subject,topic,difficulty,marks,..."
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setChecked(null);
              setImported(null);
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={publish}
              onCheckedChange={(value) => setPublish(value === true)}
              aria-label="Publish the imported questions"
            />
            Publish them straight away, rather than importing as drafts
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!content || run.isPending}
              onClick={() => run.mutate(true)}
            >
              {run.isPending ? 'Checking…' : 'Check the sheet'}
            </Button>
            <Button
              disabled={!content || run.isPending || !checked}
              onClick={() => run.mutate(false)}
            >
              Import
            </Button>
          </div>
          {!checked ? (
            <p className="text-xs text-muted-foreground">
              Checking writes nothing. It reads every row and tells you what would happen.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {shown ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {imported ? '3. What was imported' : '3. What would happen'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-4">
              <Stat label="Rows" value={String(shown.total)} />
              <Stat label="Imported" value={String(shown.imported)} />
              <Stat label="Already there" value={String(shown.skipped)} />
              <Stat label="Rejected" value={String(shown.failed)} />
            </div>

            {shown.errors.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Label className="sr-only">Rows that cannot be used</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Line</TableHead>
                      <TableHead className="w-40">Column</TableHead>
                      <TableHead>What is wrong</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.errors.map((error, index) => (
                      <TableRow key={`${error.row}-${index}`}>
                        <TableCell className="tabular-nums">{error.row}</TableCell>
                        <TableCell>{error.column}</TableCell>
                        <TableCell>{error.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Every row can be used.</p>
            )}

            {imported ? (
              <Button variant="outline" asChild>
                <Link href={basePath}>Back to the bank</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
