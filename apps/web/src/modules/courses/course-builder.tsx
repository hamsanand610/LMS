'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  COMPLETION_RULES,
  type CompletionRule,
  type CourseDetail,
  DEFAULT_COMPLETION_RULE,
  LESSON_TYPES,
  type LessonDetail,
  type LessonType,
  type OutlineInput,
} from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';

interface LessonDraft {
  id?: string;
  title: string;
  type: LessonType;
  completionRule: CompletionRule;
  isMandatory: boolean;
  /** null until the body has been loaded; saving then leaves the stored body untouched. */
  html: string | null;
  durationSeconds: number;
}

interface ModuleDraft {
  id?: string;
  title: string;
  gated: boolean;
  minPercent: number;
  lessons: LessonDraft[];
}

/** The outline editor. Remounts on fresh data so the draft always starts from what was saved. */
export function CourseBuilder({ courseId }: { courseId: string }) {
  const query = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api<CourseDetail>(`/courses/${courseId}`),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <OutlineEditor key={query.dataUpdatedAt} courseId={courseId} course={query.data} />;
}

function toDraft(course: CourseDetail): ModuleDraft[] {
  return course.modules.map((module) => ({
    id: module.id,
    title: module.title,
    gated: module.unlockRule.type === 'after_previous',
    minPercent: module.unlockRule.type === 'after_previous' ? module.unlockRule.minPercent : 100,
    lessons: module.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      completionRule: lesson.completionRule,
      isMandatory: lesson.isMandatory,
      html: null,
      durationSeconds: lesson.durationSeconds,
    })),
  }));
}

function OutlineEditor({ courseId, course }: { courseId: string; course: CourseDetail }) {
  const [modules, setModules] = useState<ModuleDraft[]>(() => toDraft(course));
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Opening a lesson fetches its body first, so an editor never saves over text it never showed.
  const load = useMutation({
    mutationFn: (target: { lessonId: string }) => api<LessonDetail>(`/lessons/${target.lessonId}`),
    onSuccess: (lesson, target) => {
      setModules((current) =>
        current.map((module) => ({
          ...module,
          lessons: module.lessons.map((item) =>
            item.id === target.lessonId ? { ...item, html: lesson.content.html } : item,
          ),
        })),
      );
      setOpenLesson(target.lessonId);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The lesson could not be opened'),
  });

  const save = useMutation({
    mutationFn: (outline: OutlineInput) =>
      api<CourseDetail>(`/courses/${courseId}/outline`, { method: 'PUT', body: outline }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      await queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Outline saved');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The outline could not be saved'),
  });

  const update = (index: number, change: Partial<ModuleDraft>) =>
    setModules((current) => current.map((m, i) => (i === index ? { ...m, ...change } : m)));

  const updateLesson = (moduleIndex: number, lessonIndex: number, change: Partial<LessonDraft>) =>
    setModules((current) =>
      current.map((module, i) =>
        i === moduleIndex
          ? {
              ...module,
              lessons: module.lessons.map((lesson, j) =>
                j === lessonIndex ? { ...lesson, ...change } : lesson,
              ),
            }
          : module,
      ),
    );

  const move = <T,>(list: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item as T);
    return next;
  };

  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {modules.length} module{modules.length === 1 ? '' : 's'}, {totalLessons} lesson
          {totalLessons === 1 ? '' : 's'}. Lessons keep their identity when you reorder them, so
          nobody loses the progress they have already made.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setModules((current) => [
                ...current,
                {
                  title: `Module ${current.length + 1}`,
                  gated: current.length > 0,
                  minPercent: 100,
                  lessons: [],
                },
              ])
            }
          >
            Add module
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate({
                modules: modules.map((module) => ({
                  ...(module.id ? { id: module.id } : {}),
                  title: module.title,
                  unlockRule: module.gated
                    ? { type: 'after_previous' as const, minPercent: module.minPercent }
                    : { type: 'always' as const },
                  lessons: module.lessons.map((lesson) => ({
                    ...(lesson.id ? { id: lesson.id } : {}),
                    title: lesson.title,
                    type: lesson.type,
                    durationSeconds: lesson.durationSeconds,
                    ...(lesson.html === null
                      ? {}
                      : { content: { html: lesson.html, video: null, questionId: null } }),
                    resources: [],
                    completionRule: lesson.completionRule,
                    isMandatory: lesson.isMandatory,
                  })),
                })),
              })
            }
          >
            {save.isPending ? 'Saving…' : 'Save outline'}
          </Button>
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          A course needs at least one module before it can be published.
        </div>
      ) : null}

      {modules.map((module, moduleIndex) => (
        <Card key={module.id ?? `new-${moduleIndex}`}>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={module.title}
                onChange={(e) => update(moduleIndex, { title: e.target.value })}
                className="max-w-sm font-medium"
                aria-label={`Module ${moduleIndex + 1} title`}
              />
              <div className="ml-auto flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={moduleIndex === 0}
                  onClick={() => setModules((c) => move(c, moduleIndex, moduleIndex - 1))}
                >
                  Move up
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={moduleIndex === modules.length - 1}
                  onClick={() => setModules((c) => move(c, moduleIndex, moduleIndex + 1))}
                >
                  Move down
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModules((c) => c.filter((_, i) => i !== moduleIndex))}
                >
                  Remove
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={module.gated}
                  onCheckedChange={(checked) => update(moduleIndex, { gated: checked === true })}
                  aria-label="Open only after the previous module"
                />
                Open only after the previous module reaches
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={module.minPercent}
                disabled={!module.gated}
                onChange={(e) => update(moduleIndex, { minPercent: Number(e.target.value) || 100 })}
                className="w-20"
                aria-label="Percentage of the previous module"
              />
              <span className="text-muted-foreground">per cent</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {module.lessons.map((lesson, lessonIndex) => {
              const key = lesson.id ?? `new-${moduleIndex}-${lessonIndex}`;
              const isOpen = openLesson === key;
              return (
                <div key={key} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={lesson.title}
                      onChange={(e) =>
                        updateLesson(moduleIndex, lessonIndex, { title: e.target.value })
                      }
                      className="max-w-sm"
                      aria-label={`Lesson ${lessonIndex + 1} title`}
                    />
                    <select
                      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm capitalize"
                      value={lesson.type}
                      aria-label="Lesson type"
                      onChange={(e) => {
                        const type = e.target.value as LessonType;
                        updateLesson(moduleIndex, lessonIndex, {
                          type,
                          completionRule: DEFAULT_COMPLETION_RULE[type],
                        });
                      }}
                    >
                      {LESSON_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <div className="ml-auto flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={load.isPending}
                        onClick={() => {
                          if (isOpen) {
                            setOpenLesson(null);
                          } else if (lesson.id && lesson.html === null) {
                            load.mutate({ lessonId: lesson.id });
                          } else {
                            setOpenLesson(key);
                          }
                        }}
                      >
                        {isOpen ? 'Close' : load.isPending ? 'Opening…' : 'Edit'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={lessonIndex === 0}
                        onClick={() =>
                          update(moduleIndex, {
                            lessons: move(module.lessons, lessonIndex, lessonIndex - 1),
                          })
                        }
                      >
                        Up
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={lessonIndex === module.lessons.length - 1}
                        onClick={() =>
                          update(moduleIndex, {
                            lessons: move(module.lessons, lessonIndex, lessonIndex + 1),
                          })
                        }
                      >
                        Down
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          update(moduleIndex, {
                            lessons: module.lessons.filter((_, j) => j !== lessonIndex),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      <div className="space-y-2">
                        <Label htmlFor={`${key}-html`}>Lesson content</Label>
                        <Textarea
                          id={`${key}-html`}
                          rows={6}
                          value={lesson.html ?? ''}
                          placeholder="Write the lesson here. Basic HTML is kept."
                          onChange={(e) =>
                            updateLesson(moduleIndex, lessonIndex, { html: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={lesson.isMandatory}
                            onCheckedChange={(checked) =>
                              updateLesson(moduleIndex, lessonIndex, {
                                isMandatory: checked === true,
                              })
                            }
                            aria-label="Counts towards completion"
                          />
                          Counts towards completion
                        </label>
                        <label className="flex items-center gap-2">
                          Completed
                          <select
                            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                            value={lesson.completionRule}
                            aria-label="Completion rule"
                            onChange={(e) =>
                              updateLesson(moduleIndex, lessonIndex, {
                                completionRule: e.target.value as CompletionRule,
                              })
                            }
                          >
                            {COMPLETION_RULES.map((rule) => (
                              <option key={rule} value={rule}>
                                {rule === 'watch'
                                  ? 'once watched'
                                  : rule === 'view'
                                    ? 'once opened'
                                    : 'when the learner says so'}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                update(moduleIndex, {
                  lessons: [
                    ...module.lessons,
                    {
                      title: `Lesson ${module.lessons.length + 1}`,
                      type: 'article',
                      completionRule: DEFAULT_COMPLETION_RULE.article,
                      isMandatory: true,
                      html: '',
                      durationSeconds: 0,
                    },
                  ],
                })
              }
            >
              Add lesson
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
