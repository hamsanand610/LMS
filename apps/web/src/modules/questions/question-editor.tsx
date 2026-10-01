'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX, FlaskConical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  DIFFICULTY_LABELS,
  EXECUTED_TYPES,
  LANGUAGE_LABELS,
  OBJECTIVE_TYPES,
  QUESTION_DIFFICULTIES,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  REVIEWED_TYPES,
  questionCreateSchema,
  type ExecutionLanguage,
  type QuestionDetail,
  type QuestionDifficulty,
  type QuestionSpec,
  type QuestionSummary,
  type QuestionType,
  type QuestionValidation,
  type TaxonomyTerm,
} from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { useCan } from '@/shell/me-context';
import { PageHeader } from '@/shell/page-header';
import { EditorSection, HandInEditor, HintsEditor, OptionsEditor } from './editor/answer-parts';
import { CodeProblemEditor } from './editor/code-problem-editor';
import {
  EMPTY_SPEC,
  codingFrom,
  defaultCoding,
  optionsFor,
  toPayload,
  type CodingDraft,
  type OptionDraft,
} from './editor/drafts';

/** Where a problem sits, in the words the form uses. */
const FIELD_NAMES: Record<string, string> = {
  title: 'Title',
  body: 'The question',
  options: 'Options',
  coding: 'The code problem',
  spec: 'What to hand in',
  hints: 'Hints',
  marks: 'Marks',
  tags: 'Tags',
  rubric: 'Mark scheme',
  explanation: 'Explanation',
};

/** The first thing wrong, said so the author can find it. */
function messageOf(error: unknown, fallback: string): string {
  if (isApiError(error)) {
    const [path, message] = Object.entries(error.fieldErrors)[0] ?? [];
    if (path && message) return `${FIELD_NAMES[path.split('.')[0]!] ?? 'The question'}: ${message}`;
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

/** Writing or editing one question of any type. */
export function QuestionEditor({
  questionId,
  basePath = '/admin/question-bank',
}: {
  questionId?: string;
  basePath?: string;
}) {
  const queryClient = useQueryClient();
  // Bumped after a save, so the form starts again from what the server kept.
  const [version, setVersion] = useState(0);
  const query = useQuery({
    queryKey: ['question', questionId],
    queryFn: () => api<QuestionDetail>(`/questions/${questionId}`),
    enabled: Boolean(questionId),
  });

  if (questionId && query.isPending) return <LoadingRows rows={6} />;
  if (questionId && query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return (
    <EditorForm
      key={`${questionId ?? 'new'}:${version}`}
      questionId={questionId}
      basePath={basePath}
      existing={query.data}
      reload={async () => {
        await queryClient.invalidateQueries({ queryKey: ['question', questionId] });
        setVersion((n) => n + 1);
      }}
    />
  );
}

function EditorForm({
  questionId,
  basePath,
  existing,
  reload,
}: {
  questionId?: string;
  basePath: string;
  existing?: QuestionDetail;
  reload: () => Promise<void>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManagePractice = useCan('practice:manage');

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [type, setType] = useState<QuestionType>(existing?.type ?? 'mcq_single');
  const [subject, setSubject] = useState(existing?.subject ?? '');
  const [topic, setTopic] = useState(existing?.topic ?? '');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(existing?.difficulty ?? 'easy');
  const [marks, setMarks] = useState(existing?.marks ?? 1);
  const [negativeMarks, setNegativeMarks] = useState(existing?.negativeMarks ?? 0);
  const [explanation, setExplanation] = useState(existing?.explanation ?? '');
  const [rubric, setRubric] = useState(existing?.rubric ?? '');
  const [tags, setTags] = useState((existing?.tags ?? []).join(', '));
  const [hints, setHints] = useState<string[]>(existing?.hints ?? []);
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    existing
      ? existing.options.map((o) => ({
          key: o.id,
          id: o.id,
          body: o.body,
          isCorrect: o.isCorrect ?? false,
          explanation: o.explanation ?? '',
        }))
      : optionsFor('mcq_single', []),
  );
  const [spec, setSpec] = useState<QuestionSpec>(existing?.spec ?? EMPTY_SPEC);
  const [coding, setCoding] = useState<CodingDraft>(() =>
    existing ? codingFrom(existing) : defaultCoding('coding'),
  );

  const subjects = useQuery({
    queryKey: ['taxonomy', 'subject'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/subject/terms'),
  });
  const topics = useQuery({
    queryKey: ['taxonomy', 'topic'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/topic/terms'),
  });

  const executed = EXECUTED_TYPES.includes(type);
  const objective = OBJECTIVE_TYPES.includes(type);
  const reviewed = REVIEWED_TYPES.includes(type);
  const handIn = ['file_upload', 'practical', 'project'].includes(type);

  const payload = () =>
    toPayload({
      title,
      body,
      type,
      subject,
      topic,
      difficulty,
      marks,
      negativeMarks,
      explanation,
      rubric,
      tags,
      hints,
      options,
      spec,
      coding,
    });

  // What the server holds, to tell an unsaved edit from a saved one. The form is remounted after
  // every save, so this is taken once.
  const [saved] = useState(() => (existing ? JSON.stringify(payload()) : null));
  const dirty = saved === null || JSON.stringify(payload()) !== saved;

  useEffect(() => {
    if (!dirty || !questionId) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, questionId]);

  const changeType = (next: QuestionType) => {
    setType(next);
    setOptions((current) => optionsFor(next, current));
    if (
      ['file_upload', 'practical', 'project'].includes(next) &&
      spec.maxFiles === 0 &&
      !spec.linkRequired
    ) {
      setSpec(
        next === 'project'
          ? { ...EMPTY_SPEC, linkRequired: true, linkLabel: 'Repository address' }
          : { ...EMPTY_SPEC, fileKinds: ['pdf', 'zip'], maxFiles: 1 },
      );
    }
    if (next === 'coding' || next === 'sql') {
      setCoding((current) =>
        (next === 'sql') === current.languages.includes('sql') ? current : defaultCoding(next),
      );
    }
  };

  /** The draft, checked with the same schema the server uses before anything is sent. */
  const checked = () => {
    const result = questionCreateSchema.safeParse(payload());
    if (result.success) return result.data;
    const issue = result.error.issues[0]!;
    throw new Error(`${FIELD_NAMES[String(issue.path[0])] ?? 'The question'}: ${issue.message}`);
  };

  const save = useMutation({
    mutationFn: () =>
      questionId
        ? api<QuestionSummary>(`/questions/${questionId}`, { method: 'PUT', body: checked() })
        : api<QuestionSummary>('/questions', { method: 'POST', body: checked() }),
    onSuccess: async (question) => {
      await queryClient.invalidateQueries({ queryKey: ['questions'] });
      toast.success(questionId ? 'Question saved' : 'Question created');
      if (!questionId) router.push(`${basePath}/${question.id}`);
      else await reload();
    },
    onError: (error) => toast.error(messageOf(error, 'The question could not be saved')),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) =>
      api<QuestionSummary>(`/questions/${questionId}/status`, { method: 'POST', body: { status } }),
    onSuccess: async (question) => {
      await queryClient.invalidateQueries({ queryKey: ['questions'] });
      toast.success(
        question.status === 'published' ? 'Published' : `The question is now ${question.status}`,
      );
      await reload();
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'That status could not be set'),
  });

  const validate = useMutation({
    mutationFn: async () => {
      // The check runs what is saved, so an edit is saved first.
      if (dirty)
        await api<QuestionSummary>(`/questions/${questionId}`, { method: 'PUT', body: checked() });
      return api<QuestionValidation>(`/questions/${questionId}/validate`, { method: 'POST' });
    },
    onSuccess: async (result) => {
      toast[result.ok ? 'success' : 'error'](
        result.ok
          ? 'The reference solution passes every case'
          : 'The reference solution does not pass every case; publishing stays blocked',
      );
      await reload();
    },
    onError: (error) => toast.error(messageOf(error, 'The check could not run')),
  });

  const activeTerms = (terms: TaxonomyTerm[] | undefined, current: string) =>
    (terms ?? []).filter((term) => !term.archived || term.key === current);

  const status = existing?.status;
  const statusActions = existing ? (
    <div className="flex items-center gap-2">
      <StatusBadge status={existing.status} />
      {status === 'published' ? (
        <Button
          variant="outline"
          disabled={setStatus.isPending}
          onClick={() => setStatus.mutate('retired')}
        >
          Retire
        </Button>
      ) : (
        <Button
          disabled={setStatus.isPending || dirty}
          onClick={() => setStatus.mutate('published')}
          title={dirty ? 'Save your changes first' : undefined}
        >
          Publish
        </Button>
      )}
    </div>
  ) : null;

  return (
    <>
      <PageHeader
        back={{ href: basePath, label: 'Question bank' }}
        title={questionId ? 'Edit question' : 'New question'}
        description={
          questionId
            ? 'Saving keeps a version, so a paper that used the old wording can still be explained.'
            : 'Write the question, then publish it to make it usable in an assignment or a test.'
        }
        actions={statusActions}
      />

      <form
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="min-w-0 space-y-6">
          <EditorSection title="Wording">
            <div className="space-y-1.5">
              <Label htmlFor="question-title">Title</Label>
              <Input
                id="question-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="question-body">The question</Label>
              <Textarea
                id="question-body"
                rows={executed ? 8 : 5}
                maxLength={20000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                aria-describedby="question-body-hint"
              />
              <p id="question-body-hint" className="text-xs text-muted-foreground">
                Plain text. Put code between lines of three backticks (```), and short code between
                single backticks.
              </p>
            </div>
          </EditorSection>

          {objective ? <OptionsEditor type={type} options={options} onChange={setOptions} /> : null}
          {handIn ? <HandInEditor spec={spec} onChange={setSpec} /> : null}
          {executed ? (
            <CodeProblemEditor sql={type === 'sql'} coding={coding} onChange={setCoding} />
          ) : null}

          {reviewed ? (
            <EditorSection
              title="Mark scheme"
              description="What the reviewer marks against. Learners never see it."
            >
              <Label htmlFor="question-rubric" className="sr-only">
                Mark scheme
              </Label>
              <Textarea
                id="question-rubric"
                rows={4}
                maxLength={20000}
                value={rubric}
                onChange={(e) => setRubric(e.target.value)}
                placeholder="What earns full marks, and what earns part of them."
              />
            </EditorSection>
          ) : null}

          <HintsEditor hints={hints} onChange={setHints} />

          <EditorSection
            title="Explanation"
            description="The worked answer, shown when the assignment’s rules allow it."
          >
            <Label htmlFor="question-explanation" className="sr-only">
              Explanation shown after answering
            </Label>
            <Textarea
              id="question-explanation"
              rows={4}
              maxLength={20000}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </EditorSection>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <EditorSection title="Classification">
            <div className="space-y-1.5">
              <Label htmlFor="question-type">Type</Label>
              <NativeSelect
                id="question-type"
                className="w-full"
                value={type}
                disabled={Boolean(questionId)}
                onChange={(e) => changeType(e.target.value as QuestionType)}
              >
                {QUESTION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {QUESTION_TYPE_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
              {questionId ? (
                <p className="text-xs text-muted-foreground">
                  The type is fixed once a question is saved.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="question-subject">Technology</Label>
              <NativeSelect
                id="question-subject"
                className="w-full"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="">Not set</option>
                {activeTerms(subjects.data, subject).map((term) => (
                  <option key={term.key} value={term.key}>
                    {term.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="question-topic">Topic</Label>
              <NativeSelect
                id="question-topic"
                className="w-full"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              >
                <option value="">Not set</option>
                {activeTerms(topics.data, topic).map((term) => (
                  <option key={term.key} value={term.key}>
                    {term.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="question-difficulty">Level</Label>
              <NativeSelect
                id="question-difficulty"
                className="w-full"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
              >
                {QUESTION_DIFFICULTIES.map((value) => (
                  <option key={value} value={value}>
                    {DIFFICULTY_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="question-marks">Marks</Label>
                <Input
                  id="question-marks"
                  type="number"
                  min={1}
                  max={100}
                  value={marks}
                  onChange={(e) =>
                    setMarks(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                  }
                />
              </div>
              {objective ? (
                <div className="space-y-1.5">
                  <Label htmlFor="question-negative">Minus for wrong</Label>
                  <Input
                    id="question-negative"
                    type="number"
                    min={0}
                    max={100}
                    step="0.25"
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="question-tags">Tags</Label>
              <Input
                id="question-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="two-pointers, interview"
                aria-describedby="question-tags-hint"
              />
              <p id="question-tags-hint" className="text-xs text-muted-foreground">
                Separate with commas.
              </p>
            </div>
          </EditorSection>

          {executed && questionId ? (
            <ValidationPanel
              validation={existing?.validation ?? null}
              languages={coding.languages}
              dirty={dirty}
              running={validate.isPending}
              onRun={() => validate.mutate()}
            />
          ) : null}

          {executed && questionId && canManagePractice && existing?.practice ? (
            <PracticePanel
              questionId={questionId}
              published={status === 'published'}
              practice={existing.practice}
              onChanged={reload}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={save.isPending || (Boolean(questionId) && !dirty)}>
              {save.isPending ? 'Saving…' : questionId ? 'Save changes' : 'Create question'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push(basePath)}>
              Back to the bank
            </Button>
          </div>
          {questionId && dirty ? (
            <p className="text-xs text-warning">You have changes that are not saved.</p>
          ) : null}
        </aside>
      </form>
    </>
  );
}

function ValidationPanel({
  validation,
  languages,
  dirty,
  running,
  onRun,
}: {
  validation: QuestionValidation | null;
  languages: ExecutionLanguage[];
  dirty: boolean;
  running: boolean;
  onRun: () => void;
}) {
  const stale = useMemo(
    () =>
      validation !== null &&
      languages.some((l) => !validation.languages.some((entry) => entry.language === l)),
    [validation, languages],
  );
  return (
    <EditorSection
      title="Check the reference solution"
      description="Runs the reference solution against every case in the sandbox. A coding or SQL question can be published only once it passes."
    >
      {validation && !dirty && !stale ? (
        <div className="space-y-2" aria-live="polite">
          <p
            className={
              validation.ok
                ? 'flex items-center gap-1.5 text-sm font-medium text-success'
                : 'flex items-center gap-1.5 text-sm font-medium text-danger'
            }
          >
            {validation.ok ? (
              <CircleCheck className="size-4" aria-hidden="true" />
            ) : (
              <CircleX className="size-4" aria-hidden="true" />
            )}
            {validation.ok ? 'Passes every case' : 'Does not pass yet'}
          </p>
          <ul className="space-y-1 text-xs">
            {validation.languages.map((entry) => (
              <li key={entry.language} className="flex justify-between gap-2">
                <span>{LANGUAGE_LABELS[entry.language]}</span>
                <span className="text-right text-muted-foreground tabular-nums">
                  {entry.passed} / {entry.total} · {entry.message}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Checked {formatDateTime(validation.validatedAt)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {dirty
            ? 'Your changes are saved before the check runs.'
            : 'Not checked since the last change.'}
        </p>
      )}
      <Button type="button" variant="outline" className="w-full" disabled={running} onClick={onRun}>
        <FlaskConical aria-hidden="true" />
        {running ? 'Running in the sandbox…' : dirty ? 'Save and check' : 'Run the check'}
      </Button>
    </EditorSection>
  );
}

function PracticePanel({
  questionId,
  published,
  practice,
  onChanged,
}: {
  questionId: string;
  published: boolean;
  practice: { inCatalogue: boolean; points: number };
  onChanged: () => Promise<void>;
}) {
  const [inCatalogue, setInCatalogue] = useState(practice.inCatalogue);
  const [points, setPoints] = useState(practice.points);
  const change = useMutation({
    mutationFn: () =>
      api<QuestionSummary>(`/questions/${questionId}/practice`, {
        method: 'POST',
        body: { inCatalogue, points },
      }),
    onSuccess: async () => {
      toast.success(
        inCatalogue ? 'In the practice catalogue' : 'Taken out of the practice catalogue',
      );
      await onChanged();
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'That could not be changed'),
  });
  const changed = inCatalogue !== practice.inCatalogue || points !== practice.points;
  return (
    <EditorSection
      title="Practice catalogue"
      description="Learners can solve it on the Practice page for points, outside any assignment."
    >
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={inCatalogue}
          disabled={!published && !practice.inCatalogue}
          onCheckedChange={(checked) => setInCatalogue(checked === true)}
        />
        Offer it for practice
      </label>
      {!published && !practice.inCatalogue ? (
        <p className="text-xs text-muted-foreground">Publish the question first.</p>
      ) : null}
      <div className="flex items-center gap-2">
        <Label htmlFor="practice-points" className="font-normal">
          Points
        </Label>
        <Input
          id="practice-points"
          type="number"
          min={0}
          max={1000}
          value={points}
          onChange={(e) => setPoints(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
          className="w-24"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!changed || change.isPending}
        onClick={() => change.mutate()}
      >
        {change.isPending ? 'Saving…' : 'Save practice settings'}
      </Button>
    </EditorSection>
  );
}
