'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  EXECUTION_LANGUAGES,
  LANGUAGE_LABELS,
  QUESTION_DIFFICULTIES,
  QUESTION_TYPES,
  type ExecutionLanguage,
  type QuestionCreateInput,
  type QuestionDetail,
  type QuestionDifficulty,
  type QuestionSummary,
  type QuestionType,
  type QuestionValidation,
  type TaxonomyTerm,
} from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { runCases } from '@/lib/execution/runner';
import { PageHeader } from '@/shell/page-header';
import { TYPE_LABELS } from './questions-table';

interface OptionDraft {
  body: string;
  isCorrect: boolean;
  explanation: string;
}

interface CaseDraft {
  input: string;
  expectedOutput: string;
  isSample: boolean;
  weight: number;
}

const EMPTY: QuestionCreateInput = {
  title: '',
  body: '',
  type: 'mcq_single',
  subject: '',
  topic: '',
  difficulty: 'easy',
  marks: 1,
  negativeMarks: 0,
  explanation: '',
  tags: [],
  options: [],
  rubric: '',
  coding: null,
};

/** Writing or editing one question of any type. */
export function QuestionEditor({
  questionId,
  basePath = '/admin/question-bank',
}: {
  questionId?: string;
  basePath?: string;
}) {
  const query = useQuery({
    queryKey: ['question', questionId],
    queryFn: () => api<QuestionDetail>(`/questions/${questionId}`),
    enabled: Boolean(questionId),
  });

  if (questionId && query.isPending) return <LoadingRows rows={6} />;
  if (questionId && query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }
  return (
    <EditorForm
      key={query.dataUpdatedAt}
      questionId={questionId}
      basePath={basePath}
      existing={query.data}
    />
  );
}

function EditorForm({
  questionId,
  basePath,
  existing,
}: {
  questionId?: string;
  basePath: string;
  existing?: QuestionDetail;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(existing?.title ?? EMPTY.title);
  const [body, setBody] = useState(existing?.body ?? EMPTY.body);
  const [type, setType] = useState<QuestionType>(existing?.type ?? 'mcq_single');
  const [subject, setSubject] = useState(existing?.subject ?? '');
  const [topic, setTopic] = useState(existing?.topic ?? '');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(existing?.difficulty ?? 'easy');
  const [marks, setMarks] = useState(existing?.marks ?? 1);
  const [negativeMarks, setNegativeMarks] = useState(existing?.negativeMarks ?? 0);
  const [explanation, setExplanation] = useState(existing?.explanation ?? '');
  const [rubric, setRubric] = useState(existing?.rubric ?? '');
  const [options, setOptions] = useState<OptionDraft[]>(
    existing?.options.map((o) => ({
      body: o.body,
      isCorrect: o.isCorrect ?? false,
      explanation: o.explanation ?? '',
    })) ??
      (existing?.type === 'true_false'
        ? []
        : [
            { body: '', isCorrect: false, explanation: '' },
            { body: '', isCorrect: false, explanation: '' },
          ]),
  );
  const [languages, setLanguages] = useState<ExecutionLanguage[]>(
    existing?.coding?.languages ?? ['javascript'],
  );
  const [starter, setStarter] = useState<Record<string, string>>(
    existing?.coding?.starterCode ?? {},
  );
  const [solution, setSolution] = useState<Record<string, string>>(
    existing?.coding?.referenceSolution ?? {},
  );
  const [cases, setCases] = useState<CaseDraft[]>(
    existing?.coding?.testCases.map((c) => ({
      input: c.input ?? '',
      expectedOutput: c.expectedOutput ?? '',
      isSample: c.isSample,
      weight: c.weight,
    })) ?? [{ input: '', expectedOutput: '', isSample: true, weight: 1 }],
  );
  const [validation, setValidation] = useState<QuestionValidation | null>(
    existing?.validation ?? null,
  );
  const [validating, setValidating] = useState(false);

  const subjects = useQuery({
    queryKey: ['taxonomy', 'subject'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/subject/terms'),
  });
  const topics = useQuery({
    queryKey: ['taxonomy', 'topic'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/topic/terms'),
  });

  const payload = (): QuestionCreateInput => ({
    title,
    body,
    type,
    subject,
    topic,
    difficulty,
    marks,
    negativeMarks,
    explanation,
    tags: [],
    rubric,
    options:
      type === 'true_false'
        ? [
            { body: 'True', isCorrect: options[0]?.isCorrect ?? false, explanation: '' },
            { body: 'False', isCorrect: !(options[0]?.isCorrect ?? false), explanation: '' },
          ]
        : type === 'mcq_single' || type === 'mcq_multi'
          ? options
          : [],
    coding:
      type === 'coding'
        ? {
            languages,
            starterCode: starter,
            referenceSolution: solution,
            timeLimitMs: 5000,
            memoryLimitMb: 128,
            testCases: cases,
          }
        : null,
  });

  const save = useMutation({
    mutationFn: () =>
      questionId
        ? api<QuestionSummary>(`/questions/${questionId}`, { method: 'PUT', body: payload() })
        : api<QuestionSummary>('/questions', { method: 'POST', body: payload() }),
    onSuccess: async (question) => {
      await queryClient.invalidateQueries({ queryKey: ['questions'] });
      await queryClient.invalidateQueries({ queryKey: ['question', questionId] });
      toast.success(questionId ? 'Question saved' : 'Question created');
      if (!questionId) router.push(`${basePath}/${question.id}`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The question could not be saved'),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) =>
      api<QuestionSummary>(`/questions/${questionId}/status`, {
        method: 'POST',
        body: { status },
      }),
    onSuccess: async (question) => {
      await queryClient.invalidateQueries({ queryKey: ['question', questionId] });
      await queryClient.invalidateQueries({ queryKey: ['questions'] });
      toast.success(`The question is now ${question.status}`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'That status could not be set'),
  });

  const reportValidation = useMutation({
    mutationFn: (report: { ok: boolean; languages: QuestionValidation['languages'] }) =>
      api<QuestionValidation>(`/questions/${questionId}/validation`, {
        method: 'POST',
        body: report,
      }),
    onSuccess: async (stored) => {
      setValidation(stored);
      await queryClient.invalidateQueries({ queryKey: ['question', questionId] });
      toast[stored.ok ? 'success' : 'error'](
        stored.ok
          ? 'The reference solution passes every case'
          : 'The reference solution did not pass; publishing stays blocked',
      );
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The result could not be recorded'),
  });

  /**
   * Validation runs here rather than on the server: with the browser driver the server has nothing
   * to run the reference solution with (ADR-0007). What this reports is then stored against the
   * question, and a coding question cannot be published until it passes.
   */
  const validate = async () => {
    if (!questionId) {
      toast.error('Save the question first');
      return;
    }
    setValidating(true);
    try {
      const runnable = cases.map((c, index) => ({
        id: `case-${index}`,
        input: c.input,
        expectedOutput: c.expectedOutput,
      }));
      const results: QuestionValidation['languages'] = [];
      for (const language of languages) {
        const source = solution[language] ?? '';
        if (!source.trim()) {
          results.push({
            language,
            ok: false,
            passed: 0,
            total: runnable.length,
            message: 'No reference solution for this language',
          });
          continue;
        }
        const outcome = await runCases(language, source, runnable, 5000);
        const passed = outcome.results.filter((r) => r.passed).length;
        results.push({
          language,
          ok: passed === runnable.length && runnable.length > 0,
          passed,
          total: runnable.length,
          message:
            passed === runnable.length
              ? 'Every case passed'
              : `${runnable.length - passed} case(s) failed`,
        });
      }
      reportValidation.mutate({ ok: results.every((r) => r.ok), languages: results });
    } finally {
      setValidating(false);
    }
  };

  return (
    <>
      <PageHeader
        title={questionId ? 'Edit question' : 'New question'}
        description={
          questionId
            ? 'Saving keeps a version, so a paper that used the old wording can still be explained.'
            : 'Write the question, then publish it to make it usable in an assignment or a test.'
        }
        actions={
          existing ? (
            <div className="flex items-center gap-2">
              <StatusBadge status={existing.status} />
              {existing.status === 'published' ? (
                <Button variant="outline" onClick={() => setStatus.mutate('retired')}>
                  Retire
                </Button>
              ) : (
                <Button onClick={() => setStatus.mutate('published')}>Publish</Button>
              )}
            </div>
          ) : null
        }
      />

      <div className="max-w-3xl space-y-4">
        <div className="space-y-2">
          <Label htmlFor="question-title">Title</Label>
          <Input id="question-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="question-body">The question</Label>
          <Textarea
            id="question-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="question-type">Type</Label>
            <select
              id="question-type"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={type}
              disabled={Boolean(questionId)}
              onChange={(e) => setType(e.target.value as QuestionType)}
            >
              {QUESTION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {TYPE_LABELS[value]}
                </option>
              ))}
            </select>
            {questionId ? (
              <p className="text-xs text-muted-foreground">
                The type is fixed once a question is saved.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="question-subject">Subject</Label>
            <select
              id="question-subject"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">Not set</option>
              {(subjects.data ?? []).map((term) => (
                <option key={term.key} value={term.key}>
                  {term.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="question-topic">Topic</Label>
            <select
              id="question-topic"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              <option value="">Not set</option>
              {(topics.data ?? []).map((term) => (
                <option key={term.key} value={term.key}>
                  {term.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="question-difficulty">Level</Label>
            <select
              id="question-difficulty"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
            >
              {QUESTION_DIFFICULTIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="question-marks">Marks</Label>
            <Input
              id="question-marks"
              type="number"
              min={1}
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="question-negative">Negative marks for a wrong answer</Label>
            <Input
              id="question-negative"
              type="number"
              min={0}
              step="0.25"
              value={negativeMarks}
              onChange={(e) => setNegativeMarks(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        {type === 'mcq_single' || type === 'mcq_multi' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Checkbox
                    checked={option.isCorrect}
                    aria-label={`Option ${index + 1} is correct`}
                    onCheckedChange={(checked) =>
                      setOptions((current) =>
                        current.map((o, i) =>
                          i === index
                            ? { ...o, isCorrect: checked === true }
                            : type === 'mcq_single' && checked === true
                              ? { ...o, isCorrect: false }
                              : o,
                        ),
                      )
                    }
                  />
                  <Input
                    className="flex-1"
                    aria-label={`Option ${index + 1}`}
                    value={option.body}
                    onChange={(e) =>
                      setOptions((current) =>
                        current.map((o, i) => (i === index ? { ...o, body: e.target.value } : o)),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions((current) => [
                    ...current,
                    { body: '', isCorrect: false, explanation: '' },
                  ])
                }
              >
                Add option
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {type === 'true_false' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">The answer</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={options[0]?.isCorrect ?? false}
                  aria-label="The statement is true"
                  onCheckedChange={(checked) =>
                    setOptions([
                      { body: 'True', isCorrect: checked === true, explanation: '' },
                      { body: 'False', isCorrect: checked !== true, explanation: '' },
                    ])
                  }
                />
                The statement is true
              </label>
            </CardContent>
          </Card>
        ) : null}

        {type === 'descriptive' ? (
          <div className="space-y-2">
            <Label htmlFor="question-rubric">Mark scheme</Label>
            <Textarea
              id="question-rubric"
              rows={4}
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              placeholder="What earns full marks, and what earns part of them."
            />
          </div>
        ) : null}

        {type === 'coding' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">The coding problem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Languages</legend>
                <div className="flex flex-wrap gap-3">
                  {EXECUTION_LANGUAGES.map((language) => (
                    <label key={language} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={languages.includes(language)}
                        aria-label={LANGUAGE_LABELS[language]}
                        onCheckedChange={(checked) =>
                          setLanguages((current) =>
                            checked === true
                              ? [...current, language]
                              : current.filter((l) => l !== language),
                          )
                        }
                      />
                      {LANGUAGE_LABELS[language]}
                    </label>
                  ))}
                </div>
              </fieldset>

              {languages.map((language) => (
                <div key={language} className="space-y-2">
                  <Label htmlFor={`starter-${language}`}>
                    {LANGUAGE_LABELS[language]}: starting code
                  </Label>
                  <Textarea
                    id={`starter-${language}`}
                    rows={3}
                    className="font-mono text-xs"
                    value={starter[language] ?? ''}
                    onChange={(e) =>
                      setStarter((current) => ({ ...current, [language]: e.target.value }))
                    }
                  />
                  <Label htmlFor={`solution-${language}`}>
                    {LANGUAGE_LABELS[language]}: reference solution
                  </Label>
                  <Textarea
                    id={`solution-${language}`}
                    rows={4}
                    className="font-mono text-xs"
                    value={solution[language] ?? ''}
                    onChange={(e) =>
                      setSolution((current) => ({ ...current, [language]: e.target.value }))
                    }
                  />
                </div>
              ))}

              <div className="space-y-2">
                <p className="text-sm font-medium">Test cases</p>
                {cases.map((testCase, index) => (
                  <div key={index} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={testCase.isSample}
                          aria-label={`Case ${index + 1} is shown to learners`}
                          onCheckedChange={(checked) =>
                            setCases((current) =>
                              current.map((c, i) =>
                                i === index ? { ...c, isSample: checked === true } : c,
                              ),
                            )
                          }
                        />
                        Show this one as an example
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => setCases((current) => current.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                    <Textarea
                      aria-label={`Case ${index + 1} input`}
                      rows={2}
                      className="font-mono text-xs"
                      placeholder="Input"
                      value={testCase.input}
                      onChange={(e) =>
                        setCases((current) =>
                          current.map((c, i) =>
                            i === index ? { ...c, input: e.target.value } : c,
                          ),
                        )
                      }
                    />
                    <Textarea
                      aria-label={`Case ${index + 1} expected output`}
                      rows={2}
                      className="font-mono text-xs"
                      placeholder="Expected output"
                      value={testCase.expectedOutput}
                      onChange={(e) =>
                        setCases((current) =>
                          current.map((c, i) =>
                            i === index ? { ...c, expectedOutput: e.target.value } : c,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCases((current) => [
                      ...current,
                      { input: '', expectedOutput: '', isSample: false, weight: 1 },
                    ])
                  }
                >
                  Add a case
                </Button>
              </div>

              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">Validation</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    disabled={validating || !questionId}
                    onClick={validate}
                  >
                    {validating ? 'Running…' : 'Run the reference solution'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The solution runs in this browser and the result is stored against the question. A
                  coding question cannot be published until it passes every case.
                </p>
                {validation ? (
                  <div className="space-y-1 text-sm">
                    <p className={validation.ok ? 'text-success' : 'text-danger'}>
                      {validation.ok ? 'Passes' : 'Does not pass'}
                    </p>
                    {validation.languages.map((entry) => (
                      <p key={entry.language} className="text-xs text-muted-foreground">
                        {LANGUAGE_LABELS[entry.language as ExecutionLanguage] ?? entry.language}:{' '}
                        {entry.passed} of {entry.total} — {entry.message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {type !== 'descriptive' ? (
          <div className="space-y-2">
            <Label htmlFor="question-explanation">Explanation shown after answering</Label>
            <Textarea
              id="question-explanation"
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : questionId ? 'Save changes' : 'Create question'}
          </Button>
          <Button variant="outline" onClick={() => router.push(basePath)}>
            Back to the bank
          </Button>
        </div>
      </div>
    </>
  );
}
