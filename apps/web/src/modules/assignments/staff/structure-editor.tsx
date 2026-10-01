'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Lock, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type AssignmentDetail,
  type CourseDetail,
  type Paginated,
  type QuestionSummary,
  type QuestionType,
  type TaxonomyTerm,
  type UnlockRule,
} from '@lms/shared';
import { EmptyState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { plural } from '@/lib/format';

interface QuestionDraft {
  questionId: string;
  title: string;
  type: QuestionType;
  marks: number;
  /** Answers already given; such a question cannot be taken out. */
  answers: number;
}

interface ModuleDraft {
  id?: string;
  title: string;
  description: string;
  topic: string;
  /** The course module this one practises, when the assignment belongs to a course. */
  courseModuleId: string;
  dueAfterDays: string;
  gated: boolean;
  minPercent: number;
  questions: QuestionDraft[];
}

function toDrafts(detail: AssignmentDetail): ModuleDraft[] {
  return detail.modules.map((module) => ({
    id: module.id,
    title: module.title,
    description: module.description,
    topic: module.topic,
    courseModuleId: module.courseModuleId ?? '',
    dueAfterDays: module.dueAfterDays === null ? '' : String(module.dueAfterDays),
    gated: module.unlockRule.type === 'after_previous',
    minPercent: module.unlockRule.type === 'after_previous' ? module.unlockRule.minPercent : 100,
    questions: module.questions.map((q) => ({
      questionId: q.questionId,
      title: q.title,
      type: q.type,
      marks: q.marks,
      answers: q.submissionCount,
    })),
  }));
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/**
 * The assignment's structure: modules in order, each with a topic, an optional due offset and an
 * unlock rule, holding questions from the bank. Saved as a whole; a question that already has
 * answers stays (the server refuses to drop it too).
 */
export function StructureEditor({
  assignmentId,
  detail,
  onSaved,
}: {
  assignmentId: string;
  detail: AssignmentDetail;
  onSaved: () => void;
}) {
  const [modules, setModules] = useState<ModuleDraft[]>(() => toDrafts(detail));
  const [picking, setPicking] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const topics = useQuery({
    queryKey: ['taxonomy', 'topic'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/topic/terms'),
  });
  const course = useQuery({
    queryKey: ['course', detail.courseId],
    queryFn: () => api<CourseDetail>(`/courses/${detail.courseId}`),
    enabled: detail.courseId !== null,
  });
  const courseModules = course.data?.modules ?? [];

  const save = useMutation({
    mutationFn: () =>
      api<AssignmentDetail>(`/assignments/${assignmentId}/structure`, {
        method: 'PUT',
        body: {
          modules: modules.map((module) => ({
            ...(module.id ? { id: module.id } : {}),
            title: module.title,
            description: module.description,
            topic: module.topic,
            courseModuleId: module.courseModuleId || null,
            dueAfterDays: module.dueAfterDays === '' ? null : Number(module.dueAfterDays),
            unlockRule: (module.gated
              ? { type: 'after_previous', minPercent: module.minPercent }
              : { type: 'always' }) as UnlockRule,
            questions: module.questions.map((q) => ({ questionId: q.questionId, marks: q.marks })),
          })),
        },
      }),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['assignment', assignmentId], saved);
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Structure saved');
      onSaved();
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The structure could not be saved'),
  });

  const update = (index: number, change: Partial<ModuleDraft>) =>
    setModules((current) => current.map((m, i) => (i === index ? { ...m, ...change } : m)));

  const answeredIn = (module: ModuleDraft) => module.questions.some((q) => q.answers > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Questions come from the bank. A question keeps the answers given to it when it moves; one
          that already has answers cannot be taken out.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setModules((current) => [
                ...current,
                {
                  title: `Module ${current.length + 1}`,
                  description: '',
                  topic: '',
                  courseModuleId: '',
                  dueAfterDays: '',
                  gated: current.length > 0,
                  minPercent: 60,
                  questions: [],
                },
              ])
            }
          >
            Add module
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save structure'}
          </Button>
        </div>
      </div>

      {modules.length === 0 ? (
        <EmptyState
          title="No modules yet"
          description="Add a module, then pick questions from the bank to go in it."
        />
      ) : null}

      {modules.map((module, index) => (
        <Card key={module.id ?? `new-${index}`}>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-sm font-semibold text-brand tabular-nums">
                {index + 1}
              </span>
              <Input
                value={module.title}
                onChange={(e) => update(index, { title: e.target.value })}
                className="max-w-sm font-medium"
                aria-label={`Module ${index + 1} title`}
              />
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move module ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => setModules((c) => move(c, index, index - 1))}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move module ${index + 1} down`}
                  disabled={index === modules.length - 1}
                  onClick={() => setModules((c) => move(c, index, index + 1))}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={answeredIn(module)}
                        onClick={() =>
                          setModules((current) => current.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 aria-hidden="true" />
                        Remove module
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {answeredIn(module) ? (
                    <TooltipContent>Learners have answered questions in it</TooltipContent>
                  ) : null}
                </Tooltip>
              </div>
            </div>
            <div
              className={
                courseModules.length > 0
                  ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_12rem_12rem_9rem]'
                  : 'grid gap-3 md:grid-cols-[1fr_12rem_9rem]'
              }
            >
              <div className="space-y-1.5 md:col-span-2 xl:col-span-1">
                <Label htmlFor={`module-${index}-description`} className="text-xs">
                  What it covers
                </Label>
                <Textarea
                  id={`module-${index}-description`}
                  rows={2}
                  value={module.description}
                  onChange={(e) => update(index, { description: e.target.value })}
                />
              </div>
              {courseModules.length > 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`module-${index}-course-module`} className="text-xs">
                    Course module
                  </Label>
                  <NativeSelect
                    id={`module-${index}-course-module`}
                    className="w-full"
                    value={module.courseModuleId}
                    onChange={(e) => update(index, { courseModuleId: e.target.value })}
                  >
                    <option value="">Not linked</option>
                    {courseModules.map((courseModule, courseIndex) => (
                      <option key={courseModule.id} value={courseModule.id}>
                        {courseIndex + 1}. {courseModule.title}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor={`module-${index}-topic`} className="text-xs">
                  Topic
                </Label>
                <NativeSelect
                  id={`module-${index}-topic`}
                  className="w-full"
                  value={module.topic}
                  onChange={(e) => update(index, { topic: e.target.value })}
                >
                  <option value="">No topic</option>
                  {(topics.data ?? [])
                    .filter((t) => !t.archived)
                    .map((term) => (
                      <option key={term.key} value={term.key}>
                        {term.label}
                      </option>
                    ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`module-${index}-due`} className="text-xs">
                  Due after (days)
                </Label>
                <Input
                  id={`module-${index}-due`}
                  type="number"
                  min={0}
                  max={365}
                  placeholder="No date"
                  value={module.dueAfterDays}
                  onChange={(e) => update(index, { dueAfterDays: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={module.gated}
                  disabled={index === 0}
                  onCheckedChange={(checked) => update(index, { gated: checked === true })}
                  aria-label="Open only after the previous module"
                />
                Open only after the previous module reaches
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={module.minPercent}
                disabled={!module.gated || index === 0}
                onChange={(e) => update(index, { minPercent: Number(e.target.value) || 60 })}
                className="w-20"
                aria-label="Percentage of the previous module"
              />
              <span className="text-muted-foreground">per cent solved</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {module.questions.map((question, questionIndex) => (
              <div
                key={question.questionId}
                className="flex flex-col gap-2 rounded-md border border-border p-2 text-sm sm:flex-row sm:items-center"
              >
                {/* On a phone the title gets its own line; from sm up the row is one line. */}
                <div className="flex min-w-0 flex-1 items-baseline gap-2 sm:items-center">
                  <span className="w-6 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
                    {questionIndex + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                    <span className="min-w-0 break-words sm:flex-1 sm:truncate">
                      {question.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {QUESTION_TYPE_LABELS[question.type]}
                      {question.answers > 0 ? (
                        <span
                          className="inline-flex items-center gap-1"
                          title="Answered questions stay in the assignment"
                        >
                          <Lock className="size-3" aria-hidden="true" />
                          {plural(question.answers, 'answer')}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 pl-8 sm:pl-0">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    className="w-20"
                    aria-label={`Marks for ${question.title}`}
                    value={question.marks}
                    onChange={(e) =>
                      update(index, {
                        questions: module.questions.map((q, i) =>
                          i === questionIndex ? { ...q, marks: Number(e.target.value) || 1 } : q,
                        ),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${question.title} up`}
                    disabled={questionIndex === 0}
                    onClick={() =>
                      update(index, {
                        questions: move(module.questions, questionIndex, questionIndex - 1),
                      })
                    }
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${question.title} down`}
                    disabled={questionIndex === module.questions.length - 1}
                    onClick={() =>
                      update(index, {
                        questions: move(module.questions, questionIndex, questionIndex + 1),
                      })
                    }
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={question.answers > 0}
                    onClick={() =>
                      update(index, {
                        questions: module.questions.filter((_, i) => i !== questionIndex),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setPicking(index)}>
              Pick questions
            </Button>
          </CardContent>
        </Card>
      ))}

      {picking !== null ? (
        <QuestionPicker
          chosen={new Set(modules.flatMap((m) => m.questions.map((q) => q.questionId)))}
          onClose={() => setPicking(null)}
          onPick={(question) => {
            const target = modules[picking];
            if (!target || target.questions.some((q) => q.questionId === question.id)) return;
            update(picking, {
              questions: [
                ...target.questions,
                {
                  questionId: question.id,
                  title: question.title,
                  type: question.type,
                  marks: question.marks,
                  answers: 0,
                },
              ],
            });
          }}
        />
      ) : null}
    </div>
  );
}

function QuestionPicker({
  chosen,
  onPick,
  onClose,
}: {
  chosen: Set<string>;
  onPick: (question: QuestionSummary) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const params = new URLSearchParams({ status: 'published', pageSize: '50' });
  if (q) params.set('q', q);
  if (type) params.set('type', type);
  const query = useQuery({
    queryKey: ['questions', 'picker', params.toString()],
    queryFn: () => api<Paginated<QuestionSummary>>(`/questions?${params.toString()}`),
    placeholderData: keepPreviousData,
  });

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pick questions</DialogTitle>
          <DialogDescription>
            Only published questions can be used; each can appear once in an assignment.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Search the bank"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search the bank"
          />
          <NativeSelect
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Question type"
            className="sm:w-48"
          >
            <option value="">Any type</option>
            {QUESTION_TYPES.map((value) => (
              <option key={value} value={value}>
                {QUESTION_TYPE_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          {query.isPending ? <LoadingRows rows={4} /> : null}
          {(query.data?.data ?? []).map((question) => (
            <div
              key={question.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{question.title}</span>
              <span className="text-xs text-muted-foreground">
                {QUESTION_TYPE_LABELS[question.type]} · {plural(question.marks, 'mark')}
              </span>
              <Button
                size="sm"
                variant={chosen.has(question.id) ? 'ghost' : 'outline'}
                disabled={chosen.has(question.id)}
                onClick={() => onPick(question)}
              >
                {chosen.has(question.id) ? 'Added' : 'Add'}
              </Button>
            </div>
          ))}
          {query.data && query.data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matches.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
