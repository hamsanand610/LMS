'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlarmClock,
  AppWindow,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CircleCheck,
  CloudCheck,
  CloudUpload,
  Eye,
  Flag,
  Hash,
  LoaderCircle,
  RotateCcw,
  Timer,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type AttemptState,
  type ExecutionLanguage,
  type RunOutcome,
  type TestCard,
} from '@lms/shared';
import { ChoiceRow } from '@/components/choice-row';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
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
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { refreshLearnerState } from '@/lib/learner-state';
import { formatDate, formatDateTime, formatTimeWithSeconds, humanise } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/shell/page-header';
import { CodePanel } from '@/modules/workspace/code-panel';
import { formatRemaining, useNow } from './use-now';

interface AnswerDraft {
  optionIds: string[];
  text: string;
  code: string;
  language: string;
  flagged: boolean;
}

interface Rule {
  icon: LucideIcon;
  title: string;
  body: string;
}

const RULES: Rule[] = [
  {
    icon: Timer,
    title: 'The clock belongs to the server.',
    body: 'It keeps running if you close the tab, and the paper is submitted for you when it reaches zero.',
  },
  {
    icon: CloudUpload,
    title: 'Your answers are saved as you go.',
    body: 'A dropped connection costs you nothing.',
  },
  {
    icon: AppWindow,
    title: 'One attempt, however many tabs.',
    body: 'Opening the test in a second tab carries on the same attempt; it does not start another.',
  },
  {
    icon: Eye,
    title: 'Tab switches may be counted.',
    body: 'If the test counts them, your trainer sees the number.',
  },
];

/** Why a learner cannot start, in the words the test list uses. */
function blockedReason(card: TestCard): string {
  if (card.window === 'upcoming') return `This test opens ${formatDateTime(card.opensAt)}.`;
  if (card.window === 'closed') return `This test closed on ${formatDate(card.closesAt)}.`;
  return 'You have used your attempts at this test.';
}

/** The page before the test: what it is, what the rules are, and the button that starts the clock. */
export function TestInstructions({ testId }: { testId: string }) {
  const router = useRouter();
  const cards = useQuery({
    queryKey: ['my-tests'],
    queryFn: () => api<TestCard[]>('/me/tests'),
    // Whether the window is open decides the button, so this page never trusts a cached list.
    refetchOnMount: 'always',
  });
  const card =
    cards.data?.find((t) => t.testId === testId && t.window === 'live') ??
    cards.data?.find((t) => t.testId === testId);

  const start = useMutation({
    mutationFn: () => api<AttemptState>(`/tests/${testId}/attempts`, { method: 'POST' }),
    onSuccess: (state) => {
      router.push(`/tests/${testId}/attempt?attempt=${state.attemptId}`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The test could not be started'),
  });

  const resuming = card?.attemptStatus === 'in_progress' && card.canStart;
  const blocked = card && !card.canStart ? blockedReason(card) : null;
  const rules: Rule[] = card
    ? [
        ...RULES,
        {
          icon: CalendarClock,
          title: 'The window is a hard stop.',
          body: 'If it closes before your time runs out, the paper is submitted when it closes.',
        },
      ]
    : RULES;

  return (
    <>
      <PageHeader
        back={{ href: '/tests', label: 'Your tests' }}
        eyebrow={
          card
            ? [humanise(card.kind), card.subject && humanise(card.subject)]
                .filter(Boolean)
                .join(' · ')
            : 'Tests'
        }
        title="Before you start"
        description="Read this, then start when you are ready."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          {card && (card.description || card.instructions) ? (
            <section
              aria-labelledby="about-heading"
              className="rounded-xl border border-border bg-card px-5 py-4 sm:px-6"
            >
              <h2 id="about-heading" className="text-[15px] font-semibold">
                About this test
              </h2>
              {card.description ? (
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground-secondary">
                  {card.description}
                </p>
              ) : null}
              {card.instructions ? (
                <>
                  <h3 className="mt-4 text-sm font-medium text-foreground">Instructions</h3>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {card.instructions}
                  </p>
                </>
              ) : null}
            </section>
          ) : null}
          <section
            aria-labelledby="rules-heading"
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <h2
              id="rules-heading"
              className="border-b border-border px-5 py-4 text-[15px] font-semibold sm:px-6"
            >
              How this works
            </h2>
            <ul className="divide-y divide-border">
              {rules.map((rule) => {
                const Icon = rule.icon;
                return (
                  <li key={rule.title} className="flex gap-4 px-5 py-4 sm:px-6">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-foreground-secondary">
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{rule.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                        {rule.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside
          aria-label="This test"
          className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]"
        >
          {cards.isPending ? (
            <div className="space-y-3" aria-hidden="true">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : card ? (
            <>
              <p className="text-[15px] leading-snug font-semibold text-foreground">{card.title}</p>
              <dl className="mt-4 divide-y divide-border text-sm">
                <Fact icon={Timer} label="Time allowed" value={`${card.durationMinutes} minutes`} />
                <Fact icon={Hash} label="Marks" value={String(card.totalMarks)} />
                <Fact
                  icon={RotateCcw}
                  label="Attempts used"
                  value={`${card.attemptsUsed} of ${card.maxAttempts}`}
                />
                <Fact
                  icon={CalendarClock}
                  label={card.window === 'upcoming' ? 'Opens' : 'Closes'}
                  value={formatDateTime(card.window === 'upcoming' ? card.opensAt : card.closesAt)}
                />
              </dl>
            </>
          ) : null}

          {resuming ? (
            <p className="mt-4 rounded-lg bg-info-soft px-3 py-2.5 text-[13px] leading-relaxed text-info">
              You have a paper in progress. Starting carries it on where you left off; its clock has
              kept running.
            </p>
          ) : blocked ? (
            <p className="mt-4 flex gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[13px] leading-relaxed text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {blocked}
            </p>
          ) : null}

          <Button
            size="lg"
            className={cn('w-full', card || cards.isPending ? 'mt-5' : '')}
            disabled={start.isPending || Boolean(blocked)}
            onClick={() => start.mutate()}
          >
            {start.isPending ? 'Starting…' : 'Start the test'}
          </Button>
          {!blocked ? (
            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              The clock starts when you press start.
            </p>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-right font-medium whitespace-nowrap text-foreground tabular-nums">
        {value}
      </dd>
    </div>
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
  // A submitted paper is never handed back for editing; its result page shows what may be seen.
  if (query.data.status !== 'in_progress') return <Submitted testId={query.data.testId} />;
  return <Paper key={query.dataUpdatedAt} state={query.data} fetchedAt={query.dataUpdatedAt} />;
}

function Submitted({ testId }: { testId: string }) {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-card px-6 py-10 text-center shadow-sm">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-success">
        <CircleCheck className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">This paper has been submitted</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It cannot be changed any more. The result page shows your marks once they are out.
      </p>
      <Button asChild className="mt-6">
        <Link href={`/tests/${testId}/result`}>See your result</Link>
      </Button>
    </div>
  );
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function Paper({ state, fetchedAt }: { state: AttemptState; fetchedAt: number }) {
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
  const elapsed = Math.max(0, Math.floor((now - fetchedAt) / 1000));
  const remaining = Math.max(0, state.secondsRemaining - elapsed);

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
      await queryClient.invalidateQueries({ queryKey: ['attempt', state.attemptId] });
      await refreshLearnerState(queryClient);
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
      <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-card px-6 py-10 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-surface-2 text-foreground-secondary">
          <AlarmClock className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Time is up</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your paper has been submitted with the answers that were saved.
        </p>
        <Button className="mt-6" onClick={() => router.push(`/tests/${state.testId}/result`)}>
          See what happens next
        </Button>
      </div>
    );
  }

  const total = state.questions.length;
  const question = state.questions[index];
  const answered = (id: string) => {
    const answer = answers[id];
    return Boolean(answer && (answer.optionIds.length > 0 || answer.text || answer.code));
  };
  const answeredCount = state.questions.filter((q) => answered(q.testQuestionId)).length;
  const unanswered = state.questions
    .map((q, i) => (answered(q.testQuestionId) ? null : i + 1))
    .filter((n): n is number => n !== null);
  const flaggedCount = state.questions.filter((q) => answers[q.testQuestionId]?.flagged).length;

  /**
   * The palette follows the paper's order. Section headings appear only when each section is one
   * unbroken run of questions; a shuffled paper mixes them, and headings would then only repeat.
   */
  const sectionById = new Map(state.sections.map((s) => [s.id, s]));
  const runs: { sectionId: string; items: number[] }[] = [];
  state.questions.forEach((q, i) => {
    const last = runs.at(-1);
    if (last && last.sectionId === q.sectionId) last.items.push(i);
    else runs.push({ sectionId: q.sectionId, items: [i] });
  });
  const showSections =
    runs.length > 1 && new Set(runs.map((r) => r.sectionId)).size === runs.length;
  const section = question ? sectionById.get(question.sectionId) : undefined;
  const firstOfSection = runs.some((r) => r.items[0] === index);

  const tone = remaining < 120 ? 'danger' : remaining < 300 ? 'warning' : 'calm';
  const milestone =
    remaining <= 60 ? 'One minute left.' : remaining <= 300 ? 'Five minutes left.' : '';
  const draft = question ? answers[question.testQuestionId] : undefined;

  return (
    <div className="pb-4">
      {/* The console: what paper this is, whether it is saved, the clock, and the way out. */}
      <div className="glass sticky top-[calc(var(--header-height)+0.5rem)] z-20 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-(--glass-border) px-4 py-3 shadow-sm sm:px-5">
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="truncate text-[15px] font-semibold text-foreground">{state.title}</h1>
          {/* A polite live region (plan §16.5): the reassurance that work is kept is announced. */}
          <p
            role="status"
            className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            {save.isPending ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : save.isError ? (
              <>
                <TriangleAlert className="size-3.5 text-warning" aria-hidden="true" />
                <span className="text-warning">Not saved; it retries with your next change</span>
              </>
            ) : savedAt ? (
              <>
                <CloudCheck className="size-3.5 text-success" aria-hidden="true" />
                {`Saved at ${formatTimeWithSeconds(savedAt)}`}
              </>
            ) : (
              'Not saved yet'
            )}
          </p>
        </div>

        <div className="hidden w-40 md:block">
          <p className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>Answered</span>
            <span className="font-medium text-foreground">
              {answeredCount} / {total}
            </span>
          </p>
          <Progress
            value={total ? (answeredCount / total) * 100 : 0}
            tone="neutral"
            aria-hidden="true"
            className="mt-1.5 h-1"
          />
        </div>

        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors',
            tone === 'danger'
              ? 'bg-danger-soft text-danger'
              : tone === 'warning'
                ? 'bg-warning-soft text-warning'
                : 'bg-surface-2 text-foreground',
          )}
        >
          <Timer className="size-4 shrink-0" aria-hidden="true" />
          <p
            role="timer"
            className="text-xl leading-none font-semibold tracking-tight tabular-nums"
          >
            {formatRemaining(remaining)}
            <span className="sr-only"> left</span>
          </p>
          <span className="text-xs font-medium opacity-75" aria-hidden="true">
            left
          </span>
        </div>
        <p className="sr-only" aria-live="polite">
          {milestone}
        </p>

        <Button onClick={() => setConfirming(true)}>Submit the paper</Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:items-start">
        {question && draft ? (
          <section
            aria-labelledby="question-title"
            className="min-w-0 rounded-xl border border-border bg-card"
          >
            <p className="sr-only" aria-live="polite">
              {`Question ${index + 1} of ${total}`}
            </p>
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-5 py-3 sm:px-6">
              <p className="eyebrow">
                {showSections && section?.title ? `${section.title} · ` : ''}
                Question {index + 1} of {total}
              </p>
              <p className="ml-auto text-xs text-muted-foreground tabular-nums">
                {question.marks} mark{question.marks === 1 ? '' : 's'}
                {question.negativeMarks > 0 ? (
                  <span className="text-warning">
                    {' '}
                    · {question.negativeMarks} off for a wrong answer
                  </span>
                ) : null}
              </p>
            </header>

            <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
              {firstOfSection && section?.instructions ? (
                <div className="rounded-lg border border-info/25 bg-info-soft px-4 py-3 text-sm leading-relaxed text-foreground-secondary">
                  {section.title ? (
                    <p className="mb-1 font-medium text-foreground">{section.title}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{section.instructions}</p>
                </div>
              ) : null}

              <div className="space-y-3">
                <h2
                  id="question-title"
                  className="text-lg leading-snug font-semibold text-balance text-foreground"
                >
                  {question.title}
                </h2>
                {question.body ? (
                  <p className="max-w-(--reading-max) text-[15px] leading-7 whitespace-pre-wrap text-foreground-secondary">
                    {question.body}
                  </p>
                ) : null}
              </div>

              {question.options.length > 0 ? (
                <fieldset className="space-y-2.5">
                  <legend className="mb-3 text-xs font-medium text-muted-foreground">
                    {question.type === 'mcq_multi' ? 'Choose all that apply' : 'Choose one'}
                  </legend>
                  {question.options.map((option) => {
                    const checked = draft.optionIds.includes(option.id);
                    return (
                      <ChoiceRow
                        key={option.id}
                        selected={checked}
                        control={
                          <Checkbox
                            checked={checked}
                            aria-label={option.body}
                            onCheckedChange={(value) => {
                              const current = draft.optionIds;
                              const next =
                                question.type === 'mcq_multi'
                                  ? value === true
                                    ? [...current, option.id]
                                    : current.filter((id) => id !== option.id)
                                  : value === true
                                    ? [option.id]
                                    : [];
                              update(question.testQuestionId, { optionIds: next });
                            }}
                          />
                        }
                      >
                        {option.body}
                      </ChoiceRow>
                    );
                  })}
                </fieldset>
              ) : null}

              {question.type === 'descriptive' ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <Label htmlFor="attempt-text">Your answer</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {countWords(draft.text)} words
                    </span>
                  </div>
                  <Textarea
                    id="attempt-text"
                    rows={10}
                    className="leading-7"
                    value={draft.text}
                    onChange={(e) => update(question.testQuestionId, { text: e.target.value })}
                  />
                </div>
              ) : null}

              {question.type === 'coding' && question.coding ? (
                <div className="space-y-5">
                  {question.coding.testCases.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Examples</h3>
                      <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                        {question.coding.testCases.map((example, i) => (
                          <div
                            key={example.id}
                            className="min-w-0 rounded-lg border border-border bg-surface-2/50 p-3"
                          >
                            <p className="eyebrow">Example {i + 1}</p>
                            <p className="mt-2 text-xs text-muted-foreground">Input</p>
                            <pre className="mt-1 overflow-x-auto rounded-md bg-surface px-3 py-2 font-mono text-xs leading-5">
                              {example.input || '(no input)'}
                            </pre>
                            <p className="mt-2 text-xs text-muted-foreground">Expected output</p>
                            <pre className="mt-1 overflow-x-auto rounded-md bg-surface px-3 py-2 font-mono text-xs leading-5">
                              {example.expectedOutput}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* The code editor with Run on the visible cases (TRN-12); the answer is what
                      the editor holds, saved with the rest of the paper. */}
                  <CodePanel
                    key={question.testQuestionId}
                    draftKey={`test:${attemptId}:${question.testQuestionId}`}
                    languages={question.coding.languages as ExecutionLanguage[]}
                    starterCode={question.coding.starterCode}
                    samples={question.coding.testCases.map((example, i) => ({
                      id: example.id,
                      label: `Example ${i + 1}`,
                      input: example.input,
                      expectedOutput: example.expectedOutput,
                    }))}
                    run={(input) =>
                      api<RunOutcome>(
                        `/attempts/${attemptId}/questions/${question.testQuestionId}/run`,
                        { body: input },
                      )
                    }
                    savedCode={
                      draft.language && draft.code
                        ? { language: draft.language as ExecutionLanguage, code: draft.code }
                        : null
                    }
                    drafts={{
                      initial: {},
                      change: (language, code) =>
                        update(question.testQuestionId, { language, code }),
                      clear: (language) => update(question.testQuestionId, { language, code: '' }),
                      select: (language, code) =>
                        update(question.testQuestionId, { language, code }),
                    }}
                    stickyActions={false}
                    className="overflow-hidden rounded-xl border border-border xl:h-[620px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Run tries your code on the examples or on your own input. It is marked, on
                    hidden cases too, after you submit the test.
                  </p>
                </div>
              ) : null}
            </div>

            <footer className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 max-lg:glass max-lg:sticky max-lg:bottom-0 max-lg:rounded-b-xl max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
              <label
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  draft.flagged
                    ? 'bg-warning-soft text-warning'
                    : 'text-foreground-secondary hover:bg-surface-2 hover:text-foreground',
                )}
              >
                <Checkbox
                  checked={draft.flagged}
                  aria-label="Flag this question to come back to"
                  onCheckedChange={(checked) =>
                    update(question.testQuestionId, { flagged: checked === true })
                  }
                />
                <Flag className="size-3.5" aria-hidden="true" />
                <span className="max-sm:sr-only">Come back to this one</span>
              </label>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                >
                  <ArrowLeft aria-hidden="true" />
                  Previous
                </Button>
                {index < total - 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                  >
                    Next
                    <ArrowRight aria-hidden="true" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setConfirming(true)}>
                    Finish
                  </Button>
                )}
              </div>
            </footer>
          </section>
        ) : null}

        <aside
          aria-labelledby="palette-heading"
          className="rounded-xl border border-border bg-card p-4 lg:sticky lg:top-[calc(var(--header-height)+6rem)] lg:max-h-[calc(100dvh-var(--header-height)-7rem)] lg:overflow-y-auto"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="palette-heading" className="text-sm font-semibold text-foreground">
              Questions
            </h2>
            <p className="text-xs text-muted-foreground tabular-nums">
              {answeredCount} of {total} answered
            </p>
          </div>

          {runs
            .filter((_, i) => showSections || i === 0)
            .map((run, r) => {
              const items = showSections ? run.items : state.questions.map((_, i) => i);
              const title = showSections ? sectionById.get(run.sectionId)?.title : undefined;
              return (
                <div key={`${run.sectionId}-${r}`} className="mt-4">
                  {title ? <p className="eyebrow mb-2">{title}</p> : null}
                  <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
                    {items.map((i) => {
                      const item = state.questions[i]!;
                      const isAnswered = answered(item.testQuestionId);
                      const isFlagged = answers[item.testQuestionId]?.flagged ?? false;
                      const current = i === index;
                      return (
                        <li key={item.testQuestionId}>
                          <button
                            type="button"
                            aria-label={`Question ${i + 1}${isAnswered ? ', answered' : ''}${isFlagged ? ', flagged' : ''}`}
                            aria-current={current ? 'step' : undefined}
                            onClick={() => setIndex(i)}
                            className={cn(
                              'relative grid h-10 w-full place-items-center rounded-md border text-[13px] font-medium tabular-nums transition-[background-color,border-color,box-shadow]',
                              isAnswered
                                ? 'border-transparent bg-foreground text-background hover:bg-foreground/85'
                                : isFlagged
                                  ? 'border-warning/50 bg-warning-soft text-warning'
                                  : 'border-border bg-card text-foreground-secondary hover:border-border-strong hover:bg-surface-2',
                              current && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                            )}
                          >
                            {i + 1}
                            {isFlagged ? (
                              <Flag
                                className={cn(
                                  'absolute top-0.5 right-0.5 size-2.5',
                                  isAnswered ? 'text-warning-soft' : 'text-warning',
                                )}
                                aria-hidden="true"
                              />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}

          <ul
            aria-label="What the colours mean"
            className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground"
          >
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-[3px] ring-2 ring-primary ring-offset-1 ring-offset-card" />
              Current
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-[3px] bg-foreground" />
              Answered
            </li>
            <li className="flex items-center gap-2">
              <span className="grid size-3 place-items-center rounded-[3px] border border-warning/50 bg-warning-soft">
                <Flag className="size-2 text-warning" aria-hidden="true" />
              </span>
              Flagged
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-[3px] border border-border-strong bg-card" />
              Not answered
            </li>
          </ul>

          {state.settings.trackTabSwitches ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-foreground-secondary">
              <Eye className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              This test counts tab switches, and your trainer sees the number.
            </p>
          ) : null}
        </aside>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit the paper?</DialogTitle>
            <DialogDescription>
              {unanswered.length === 0
                ? 'Every question has an answer. '
                : `${unanswered.length} ${unanswered.length === 1 ? 'question is' : 'questions are'} unanswered. `}
              You cannot come back to the paper once it is submitted.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border text-center">
            <div className="bg-card px-2 py-3">
              <dt className="text-xs text-muted-foreground">Answered</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{answeredCount}</dd>
            </div>
            <div className="bg-card px-2 py-3">
              <dt className="text-xs text-muted-foreground">Unanswered</dt>
              <dd
                className={cn(
                  'mt-0.5 text-lg font-semibold tabular-nums',
                  unanswered.length > 0 && 'text-warning',
                )}
              >
                {unanswered.length}
              </dd>
            </div>
            <div className="bg-card px-2 py-3">
              <dt className="text-xs text-muted-foreground">Flagged</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{flaggedCount}</dd>
            </div>
          </dl>
          {unanswered.length > 0 && unanswered.length <= 12 ? (
            <p className="text-sm text-muted-foreground">
              Still to answer: {unanswered.map((n) => `question ${n}`).join(', ')}.
            </p>
          ) : null}
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
