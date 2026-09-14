'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  AssignmentQuestionView,
  ExecutionLanguage,
  QuestionDetail,
  SubmissionResult,
} from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import type { RunCase } from '@/lib/execution/runner';
import { CodeEditor, type EditorResult } from '@/modules/practice/code-editor';

interface WorkspaceData {
  placement: AssignmentQuestionView;
  question: QuestionDetail;
  previousId: string | null;
  nextId: string | null;
  lastSubmission: SubmissionResult | null;
}

/** Answering one question of an assignment, whatever its type. */
export function QuestionWorkspace({
  assignmentId,
  placementId,
}: {
  assignmentId: string;
  placementId: string;
}) {
  const query = useQuery({
    queryKey: ['assignment-question', assignmentId, placementId],
    queryFn: () => api<WorkspaceData>(`/assignments/${assignmentId}/questions/${placementId}`),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return (
    <Workspace
      key={query.dataUpdatedAt}
      assignmentId={assignmentId}
      placementId={placementId}
      data={query.data}
    />
  );
}

function Workspace({
  assignmentId,
  placementId,
  data,
}: {
  assignmentId: string;
  placementId: string;
  data: WorkspaceData;
}) {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [result, setResult] = useState<SubmissionResult | null>(data.lastSubmission);

  const cases = useQuery({
    queryKey: ['assignment-question', assignmentId, placementId, 'cases'],
    queryFn: () =>
      api<{ clientRuns: boolean; cases: RunCase[] }>(
        `/assignments/${assignmentId}/questions/${placementId}/cases`,
      ),
    enabled: data.question.type === 'coding',
  });

  const submit = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<SubmissionResult>(`/assignments/${assignmentId}/questions/${placementId}/submissions`, {
        method: 'POST',
        body,
      }),
    onSuccess: async (submission) => {
      setResult(submission);
      await queryClient.invalidateQueries({ queryKey: ['my-assignment', assignmentId] });
      await queryClient.invalidateQueries({ queryKey: ['my-assignments'] });
      toast[submission.status === 'correct' ? 'success' : 'info'](
        submission.status === 'correct'
          ? `Correct: ${submission.marks} of ${submission.maxMarks} marks.`
          : submission.status === 'awaiting_grading'
            ? 'Submitted. Your trainer will mark it.'
            : `${submission.marks} of ${submission.maxMarks} marks.`,
      );
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'That answer could not be submitted'),
  });

  const question = data.question;
  const multi = question.type === 'mcq_multi';
  const objective =
    question.type === 'mcq_single' ||
    question.type === 'mcq_multi' ||
    question.type === 'true_false';
  const solved = result?.status === 'correct' || result?.status === 'partial';
  const exhausted = result?.attemptsLeft === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/assignments/${assignmentId}`} className="hover:underline">
          Back to the assignment
        </Link>
        <span aria-hidden>·</span>
        <span className="capitalize">{data.placement.difficulty}</span>
        <span aria-hidden>·</span>
        <span>{data.placement.marks} marks</span>
        {result ? (
          <Badge
            className={
              result.status === 'correct'
                ? 'bg-success-soft text-success'
                : result.status === 'awaiting_grading'
                  ? 'bg-warning-soft text-warning'
                  : 'bg-muted text-muted-foreground'
            }
          >
            {result.status === 'awaiting_grading' ? 'Waiting to be marked' : result.status}
          </Badge>
        ) : null}
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-balance">{question.title}</h1>
      <p className="whitespace-pre-wrap text-sm leading-6">{question.body}</p>

      {objective ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {multi ? 'Choose every correct option' : 'Choose one option'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {question.options.map((option) => {
              const isChosen = chosen.includes(option.id);
              const wasRight = result?.correctOptionIds?.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={`flex items-center gap-3 rounded-md border p-3 text-sm ${
                    wasRight ? 'border-success bg-success-soft' : 'border-border'
                  }`}
                >
                  <Checkbox
                    checked={isChosen}
                    disabled={solved || exhausted || submit.isPending}
                    aria-label={option.body}
                    onCheckedChange={(checked) =>
                      setChosen((current) =>
                        checked === true
                          ? multi
                            ? [...current, option.id]
                            : [option.id]
                          : current.filter((id) => id !== option.id),
                      )
                    }
                  />
                  <span>{option.body}</span>
                </label>
              );
            })}
            <Button
              disabled={chosen.length === 0 || solved || exhausted || submit.isPending}
              onClick={() => submit.mutate({ optionIds: chosen })}
            >
              {submit.isPending ? 'Checking…' : 'Submit answer'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {question.type === 'descriptive' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your answer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="answer-text" className="sr-only">
              Your answer
            </Label>
            <Textarea
              id="answer-text"
              rows={8}
              value={text}
              disabled={result?.status === 'awaiting_grading' || submit.isPending}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your answer here."
            />
            <Button
              disabled={text.trim().length === 0 || submit.isPending || Boolean(result)}
              onClick={() => submit.mutate({ text })}
            >
              {submit.isPending ? 'Submitting…' : 'Submit answer'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {question.type === 'coding' && question.coding ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your solution</CardTitle>
          </CardHeader>
          <CardContent>
            {cases.isPending ? (
              <LoadingRows rows={4} />
            ) : (
              <CodeEditor
                languages={question.coding.languages as ExecutionLanguage[]}
                starterCode={question.coding.starterCode}
                samples={question.coding.testCases
                  .filter((c) => c.input !== undefined)
                  .map((c) => ({
                    id: c.id,
                    input: c.input ?? '',
                    expectedOutput: c.expectedOutput ?? '',
                  }))}
                gradingCases={cases.data?.cases ?? []}
                timeLimitMs={question.coding.timeLimitMs}
                trust={result?.trust ?? 'untrusted'}
                busy={submit.isPending}
                submitLabel="Submit answer"
                onSubmit={(editor: EditorResult) =>
                  submit.mutate({
                    code: editor.code,
                    language: editor.language,
                    execution: {
                      driver: editor.outcome.driver,
                      verdict: editor.outcome.verdict,
                      durationMs: editor.outcome.durationMs,
                      results: editor.outcome.results,
                    },
                  })
                }
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="tabular-nums">
              {result.marks} of {result.maxMarks} marks, attempt {result.attempts}
              {result.attemptsLeft !== null ? `, ${result.attemptsLeft} left` : ''}
            </p>
            {result.totalTests !== undefined ? (
              <p className="tabular-nums">
                {result.passedTests} of {result.totalTests} cases passed
                <span className="ml-2 text-xs text-muted-foreground">
                  {result.trust === 'trusted'
                    ? 'verified by the server'
                    : 'verified in your browser'}
                </span>
              </p>
            ) : null}
            {result.explanation ? (
              <div className="rounded-md bg-muted p-3">
                <p className="font-medium">Why</p>
                <p className="text-muted-foreground">{result.explanation}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button variant="outline" asChild disabled={!data.previousId}>
          <Link
            href={
              data.previousId
                ? `/assignments/${assignmentId}/q/${data.previousId}`
                : `/assignments/${assignmentId}`
            }
          >
            <ChevronLeft className="size-4" aria-hidden /> Previous
          </Link>
        </Button>
        {data.nextId ? (
          <Button variant="outline" asChild className="ml-auto">
            <Link href={`/assignments/${assignmentId}/q/${data.nextId}`}>
              Next <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" asChild className="ml-auto">
            <Link href={`/assignments/${assignmentId}`}>Back to the assignment</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
