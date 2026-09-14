'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import type {
  ExecutionLanguage,
  PracticeProblemDetail,
  PracticeSubmissionRecord,
  TrustLevel,
} from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import type { RunCase } from '@/lib/execution/runner';
import { CodeEditor, type EditorResult } from './code-editor';

interface DriverInfo {
  driver: string;
  trust: TrustLevel;
  clientRuns: boolean;
  languages: string[];
}

/** Statement on the left, editor on the right, history underneath. */
export function PracticeWorkspace({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const problem = useQuery({
    queryKey: ['practice', slug],
    queryFn: () => api<PracticeProblemDetail>(`/practice/problems/${slug}`),
  });
  const driver = useQuery({
    queryKey: ['practice', 'driver'],
    queryFn: () => api<DriverInfo>('/practice/driver'),
  });
  const cases = useQuery({
    queryKey: ['practice', slug, 'cases'],
    queryFn: () =>
      api<{ clientRuns: boolean; cases: RunCase[] }>(`/practice/problems/${slug}/cases`),
  });
  const history = useQuery({
    queryKey: ['practice', slug, 'submissions'],
    queryFn: () => api<PracticeSubmissionRecord[]>(`/practice/problems/${slug}/submissions`),
  });

  const submit = useMutation({
    mutationFn: (result: EditorResult) =>
      api<PracticeSubmissionRecord>(`/practice/problems/${slug}/submissions`, {
        method: 'POST',
        body: {
          language: result.language,
          code: result.code,
          result: {
            language: result.language,
            verdict: result.outcome.verdict,
            driver: result.outcome.driver,
            durationMs: result.outcome.durationMs,
            compileError: '',
            results: result.outcome.results,
          },
        },
      }),
    onSuccess: async (record) => {
      await queryClient.invalidateQueries({ queryKey: ['practice', slug] });
      await queryClient.invalidateQueries({ queryKey: ['practice', 'summary'] });
      toast[record.verdict === 'passed' ? 'success' : 'error'](
        record.verdict === 'passed'
          ? `Accepted: ${record.passed} of ${record.total} cases passed.`
          : `${record.passed} of ${record.total} cases passed.`,
      );
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'That submission could not be recorded'),
  });

  if (problem.isPending) return <LoadingRows rows={6} />;
  if (problem.isError)
    return <ErrorState error={problem.error} onRetry={() => problem.refetch()} />;
  const detail = problem.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/practice" className="hover:underline">
          Practice
        </Link>
        <span aria-hidden>/</span>
        <span className="capitalize">{detail.difficulty}</span>
        <span aria-hidden>·</span>
        <span>{detail.points} points</span>
        {detail.status === 'solved' ? (
          <Badge className="ml-2 bg-success-soft text-success">Solved</Badge>
        ) : null}
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-balance">{detail.title}</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">The problem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="whitespace-pre-wrap text-sm leading-6">{detail.body}</p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Examples</p>
              {detail.samples.map((sample, index) => (
                <pre
                  key={sample.id}
                  className="overflow-x-auto rounded-md border border-border p-2 text-xs"
                >
                  Example {index + 1}
                  {'\n'}Input: {sample.input}
                  {'\n'}Output: {sample.expectedOutput}
                </pre>
              ))}
              {detail.hiddenTestCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {detail.hiddenTestCount} further case
                  {detail.hiddenTestCount === 1 ? '' : 's'} are run when you submit.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your solution</CardTitle>
          </CardHeader>
          <CardContent>
            {cases.isPending || driver.isPending ? (
              <LoadingRows rows={4} />
            ) : (
              <CodeEditor
                languages={detail.languages as ExecutionLanguage[]}
                starterCode={detail.starterCode}
                samples={detail.samples.map((s) => ({
                  id: s.id,
                  input: s.input,
                  expectedOutput: s.expectedOutput,
                }))}
                gradingCases={cases.data?.cases ?? []}
                timeLimitMs={detail.timeLimitMs}
                trust={driver.data?.trust ?? 'untrusted'}
                busy={submit.isPending}
                onSubmit={(result) => submit.mutate(result)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {history.data && history.data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Verdict</TableHead>
                    <TableHead className="text-right">Cases</TableHead>
                    <TableHead>Checked by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.data.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="tabular-nums">
                        {new Date(record.submittedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="capitalize">{record.language}</TableCell>
                      <TableCell
                        className={record.verdict === 'passed' ? 'text-success' : 'text-danger'}
                      >
                        {record.verdict === 'passed' ? 'Accepted' : record.verdict}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {record.passed} / {record.total}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.trust === 'trusted' ? 'the server' : 'your browser'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
