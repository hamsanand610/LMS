'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { AttemptState, ExecutionLanguage } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { PageHeader } from '@/shell/page-header';
import { formatRemaining, useNow } from './use-now';

interface AnswerDraft {
  optionIds: string[];
  text: string;
  code: string;
  language: string;
  flagged: boolean;
}

/** The page before the test: what it is, what the rules are, and the button that starts the clock. */
export function TestInstructions({ testId }: { testId: string }) {
  const router = useRouter();
  const start = useMutation({
    mutationFn: () => api<AttemptState>(`/tests/${testId}/attempts`, { method: 'POST' }),
    onSuccess: (state) => {
      router.push(`/tests/${testId}/attempt?attempt=${state.attemptId}`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The test could not be started'),
  });

  return (
    <>
      <PageHeader
        title="Before you start"
        description="Read this, then start when you are ready."
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">How this works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="ml-5 list-disc space-y-2">
            <li>
              The clock belongs to the server. It keeps running if you close the tab, and the paper
              is submitted for you when it reaches zero.
            </li>
            <li>Your answers are saved as you go, so a dropped connection costs you nothing.</li>
            <li>
              Opening the test in a second tab carries on the same attempt; it does not start
              another.
            </li>
            <li>If the test counts tab switches, your trainer sees the number.</li>
          </ul>
          <Button disabled={start.isPending} onClick={() => start.mutate()}>
            {start.isPending ? 'Starting…' : 'Start the test'}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

/** The paper itself. */
export function TestAttempt({ attemptId }: { attemptId: string }) {
  const query = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => api<AttemptState>(`/attempts/${attemptId}/state`),
  });

  if (query.isPending) return <LoadingRows rows={8} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <Paper key={query.dataUpdatedAt} state={query.data} />;
}

function Paper({ state }: { state: AttemptState }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const now = useNow();
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>(() =>
    Object.fromEntries(
      state.questions.map((question) => [
        question.testQuestionId,
        {
          optionIds: question.optionIds,
          text: question.text,
          code: question.code,
          language: question.language || (question.coding?.languages[0] ?? ''),
          flagged: question.flagged,
        },
      ]),
    ),
  );
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(state.savedAt);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * The countdown is anchored to what the server said was left when the paper was fetched, then
   * ticks down from there. A client clock that is wrong changes nothing, and the server submits
   * the paper at the real deadline whatever this shows (plan AC-07.1).
   */
  const [mountedAt] = useState(() => now);
  const [secondsAtMount] = useState(() => state.secondsRemaining);
  const remaining = Math.max(0, secondsAtMount - Math.floor((now - mountedAt) / 1000));

  const save = useMutation({
    mutationFn: (payload: Record<string, AnswerDraft>) =>
      api<{ savedAt: string }>(`/attempts/${state.attemptId}/answers`, {
        method: 'PATCH',
        body: {
          answers: Object.entries(payload).map(([testQuestionId, answer]) => ({
            testQuestionId,
            optionIds: answer.optionIds,
            text: answer.text,
            code: answer.code,
            language: answer.language,
            flagged: answer.flagged,
            timeSpentSeconds: 0,
          })),
        },
      }),
    onSuccess: (result) => setSavedAt(result.savedAt),
    onError: (error) => {
      if (isApiError(error) && error.problem?.code === 'attempt_expired') {
        toast.error('Time is up; your paper was submitted.');
        router.push(`/tests/${state.testId}/result`);
        return;
      }
      toast.error('That answer could not be saved just now; it will be retried.');
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      await save.mutateAsync(answers);
      return api(`/attempts/${state.attemptId}/submit`, { method: 'POST', body: { auto: false } });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-tests'] });
      toast.success('Submitted.');
      router.push(`/tests/${state.testId}/result`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The paper could not be submitted'),
  });

  /** Debounced autosave, scheduled from the change handler rather than from an effect. */
  const scheduleSave = (next: Record<string, AnswerDraft>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save.mutate(next), 1200);
  };

  const update = (questionId: string, change: Partial<AnswerDraft>) => {
    setAnswers((current) => {
      const next = { ...current, [questionId]: { ...current[questionId]!, ...change } };
      scheduleSave(next);
      return next;
    });
  };

  /**
   * Counting tab switches. The effect only subscribes to the browser; it sets no state, so the
   * count shown to staff comes from the server rather than from anything kept here.
   */
  const trackTabSwitches = state.settings.trackTabSwitches;
  const attemptId = state.attemptId;
  useEffect(() => {
    if (!trackTabSwitches) return;
    const handler = () => {
      if (document.visibilityState !== 'hidden') return;
      void api(`/attempts/${attemptId}/events`, {
        method: 'POST',
        body: { type: 'tab_switch', occurredAt: new Date().toISOString() },
      }).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [attemptId, trackTabSwitches]);

  if (remaining === 0 && state.status === 'in_progress' && !submit.isPending) {
    // The server submits it; this only stops the learner typing into a closed paper.
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Time is up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Your paper has been submitted with the answers that were saved.</p>
          <Button onClick={() => router.push(`/tests/${state.testId}/result`)}>
            See what happens next
          </Button>
        </CardContent>
      </Card>
    );
  }

  const question = state.questions[index];
  const answered = (id: string) => {
    const answer = answers[id];
    return Boolean(answer && (answer.optionIds.length > 0 || answer.text || answer.code));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
        <div>
          <p className="font-medium">{state.title}</p>
          <p className="text-xs text-muted-foreground">
            {savedAt ? `Saved at ${new Date(savedAt).toLocaleTimeString()}` : 'Not saved yet'}
            {save.isPending ? ' · saving…' : ''}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p
            className={`text-2xl font-semibold tabular-nums ${
              remaining < 120 ? 'text-danger' : ''
            }`}
          >
            {formatRemaining(remaining)}
          </p>
          <p className="text-xs text-muted-foreground">left</p>
        </div>
        <Button onClick={() => setConfirming(true)}>Submit the paper</Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {state.questions.map((item, i) => (
          <button
            key={item.testQuestionId}
            type="button"
            aria-label={`Question ${i + 1}${answered(item.testQuestionId) ? ', answered' : ''}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={`size-9 rounded-md border text-sm tabular-nums ${
              i === index
                ? 'border-primary bg-primary text-primary-foreground'
                : answers[item.testQuestionId]?.flagged
                  ? 'border-warning bg-warning-soft text-warning'
                  : answered(item.testQuestionId)
                    ? 'border-success bg-success-soft text-success'
                    : 'border-border'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {question ? (
        <Card>
          <CardHeader className="gap-2">
            <CardTitle className="text-base">
              {index + 1}. {question.title}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {question.marks} mark{question.marks === 1 ? '' : 's'}
              {question.negativeMarks > 0
                ? ` · ${question.negativeMarks} off for a wrong answer`
                : ''}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-wrap text-sm leading-6">{question.body}</p>

            {question.options.length > 0 ? (
              <div className="space-y-2">
                {question.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center gap-3 rounded-md border border-border p-3 text-sm"
                  >
                    <Checkbox
                      checked={answers[question.testQuestionId]?.optionIds.includes(option.id)}
                      aria-label={option.body}
                      onCheckedChange={(checked) => {
                        const current = answers[question.testQuestionId]?.optionIds ?? [];
                        const next =
                          question.type === 'mcq_multi'
                            ? checked === true
                              ? [...current, option.id]
                              : current.filter((id) => id !== option.id)
                            : checked === true
                              ? [option.id]
                              : [];
                        update(question.testQuestionId, { optionIds: next });
                      }}
                    />
                    <span>{option.body}</span>
                  </label>
                ))}
              </div>
            ) : null}

            {question.type === 'descriptive' ? (
              <div className="space-y-2">
                <Label htmlFor="attempt-text">Your answer</Label>
                <Textarea
                  id="attempt-text"
                  rows={8}
                  value={answers[question.testQuestionId]?.text ?? ''}
                  onChange={(e) => update(question.testQuestionId, { text: e.target.value })}
                />
              </div>
            ) : null}

            {question.type === 'coding' && question.coding ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="attempt-language" className="text-xs text-muted-foreground">
                    Language
                  </Label>
                  <select
                    id="attempt-language"
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={answers[question.testQuestionId]?.language ?? ''}
                    onChange={(e) =>
                      update(question.testQuestionId, {
                        language: e.target.value,
                        code:
                          answers[question.testQuestionId]?.code ||
                          (question.coding?.starterCode[e.target.value] ?? ''),
                      })
                    }
                  >
                    {question.coding.languages.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea
                  aria-label="Your solution"
                  className="min-h-56 font-mono text-xs"
                  spellCheck={false}
                  value={
                    answers[question.testQuestionId]?.code ||
                    question.coding.starterCode[
                      (answers[question.testQuestionId]?.language ??
                        question.coding.languages[0]) as ExecutionLanguage
                    ] ||
                    ''
                  }
                  onChange={(e) => update(question.testQuestionId, { code: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Coding answers in a test are marked after you submit, not while you type.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={answers[question.testQuestionId]?.flagged ?? false}
                  aria-label="Flag this question to come back to"
                  onCheckedChange={(checked) =>
                    update(question.testQuestionId, { flagged: checked === true })
                  }
                />
                Come back to this one
              </label>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={index >= state.questions.length - 1}
                onClick={() => setIndex((i) => Math.min(state.questions.length - 1, i + 1))}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit the paper?</DialogTitle>
            <DialogDescription>
              {state.questions.filter((q) => !answered(q.testQuestionId)).length} question(s) are
              unanswered. You cannot come back to the paper once it is submitted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep working
            </Button>
            <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
