'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ALLOWED_COMPLETION_RULES,
  type CompletionRule,
  type CourseDetail,
  DEFAULT_COMPLETION_RULE,
  DIFFICULTY_LABELS,
  LESSON_TYPES,
  type LabSummary,
  type LessonContent,
  type LessonDetail,
  type LessonType,
  type OutlineInput,
  type Paginated,
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
import { NativeSelect } from '@/components/ui/native-select';
import { LAB_TYPE_META } from '@/modules/labs/lab-types';
import { VideoUpload } from './video-upload';

interface LessonDraft {
  id?: string;
  title: string;
  type: LessonType;
  completionRule: CompletionRule;
  isMandatory: boolean;
  /** Groups lessons inside a module on the learner's outline, e.g. "Collections". */
  topic: string;
  /** null until the body has been loaded; saving then leaves the stored body untouched. */
  html: string | null;
  /** Loaded with the body and sent back with it, so an edit keeps the lesson's video. */
  video: LessonContent['video'];
  /** A practice lesson's question, or the lab a lab lesson opens; loaded with the body. */
  questionId: string | null;
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
      topic: lesson.topic,
      html: null,
      video: null,
      questionId: null,
      durationSeconds: lesson.durationSeconds,
    })),
  }));
}

const RULE_LABELS: Record<CompletionRule, string> = {
  watch: 'once watched',
  view: 'once opened',
  manual: 'when the learner says so',
  pass: 'when it is passed',
};

function OutlineEditor({ courseId, course }: { courseId: string; course: CourseDetail }) {
  const [modules, setModules] = useState<ModuleDraft[]>(() => toDraft(course));
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // The labs a lesson can open: published, and passing their own check (ADR-0018).
  const labs = useQuery({
    queryKey: ['labs', 'staff', 'placeable'],
    queryFn: () => api<Paginated<LabSummary>>('/practice/labs?status=published&pageSize=100'),
    select: (page) => page.data.filter((lab) => lab.validated),
  });

  // Opening a lesson fetches its body first, so an editor never saves over text it never showed.
  const load = useMutation({
    mutationFn: (target: { lessonId: string }) => api<LessonDetail>(`/lessons/${target.lessonId}`),
    onSuccess: (lesson, target) => {
      setModules((current) =>
        current.map((module) => ({
          ...module,
          lessons: module.lessons.map((item) =>
            item.id === target.lessonId
              ? {
                  ...item,
                  html: lesson.content.html,
                  video: lesson.content.video,
                  questionId: lesson.content.questionId,
                }
              : item,
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
                      : {
                          content: {
                            html: lesson.html,
                            video: lesson.video,
                            questionId: lesson.questionId,
                          },
                        }),
                    // No resources: the outline keeps each lesson's attachments as they are.
                    completionRule: lesson.completionRule,
                    isMandatory: lesson.isMandatory,
                    topic: lesson.topic,
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
                    <NativeSelect
                      className="capitalize"
                      value={lesson.type}
                      aria-label="Lesson type"
                      onChange={(e) => {
                        const type = e.target.value as LessonType;
                        updateLesson(moduleIndex, lessonIndex, {
                          type,
                          completionRule: DEFAULT_COMPLETION_RULE[type],
                        });
                        // A lab lesson needs its lab chosen, which lives with the body.
                        if (type === 'lab' && lesson.id && lesson.html === null) {
                          load.mutate({ lessonId: lesson.id });
                        } else if (type === 'lab') {
                          setOpenLesson(key);
                        }
                      }}
                    >
                      {LESSON_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </NativeSelect>
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
                      {lesson.type === 'lab' ? (
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-lab`}>The lab this lesson opens</Label>
                          <NativeSelect
                            id={`${key}-lab`}
                            className="w-full"
                            value={lesson.questionId ?? ''}
                            onChange={(e) =>
                              updateLesson(moduleIndex, lessonIndex, {
                                questionId: e.target.value || null,
                              })
                            }
                          >
                            <option value="">Choose a lab</option>
                            {lesson.questionId &&
                            !(labs.data ?? []).some(
                              (lab) => lab.questionId === lesson.questionId,
                            ) ? (
                              <option value={lesson.questionId}>
                                The lab chosen before (no longer published or checked)
                              </option>
                            ) : null}
                            {(labs.data ?? []).map((lab) => (
                              <option key={lab.questionId} value={lab.questionId}>
                                {lab.title} — {LAB_TYPE_META[lab.type].label},{' '}
                                {DIFFICULTY_LABELS[lab.difficulty] ?? lab.difficulty}
                              </option>
                            ))}
                          </NativeSelect>
                          <p className="text-xs text-muted-foreground">
                            {labs.isError
                              ? 'The labs could not be listed. Try again.'
                              : 'Only published labs that pass their own check can be placed. Learners complete the lesson by passing the lab, here or in the Labs.'}
                          </p>
                        </div>
                      ) : null}
                      {lesson.type === 'video' ? (
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-video`}>Video</Label>
                          <p className="text-sm text-muted-foreground">
                            {lesson.video
                              ? `A video is attached${lesson.video.durationSeconds > 0 ? ` (${Math.max(1, Math.round(lesson.video.durationSeconds / 60))} min)` : ''}. Learners play it from the lesson; save the outline after changing it.`
                              : 'No video yet. Learners see an empty player until one is attached.'}
                          </p>
                          <div className="flex flex-wrap items-start gap-2">
                            <VideoUpload
                              id={`${key}-video`}
                              context="lesson-video"
                              label={lesson.video ? 'Replace the video' : 'Upload a video'}
                              onUploaded={(video) =>
                                updateLesson(moduleIndex, lessonIndex, {
                                  video: {
                                    driver: 'storage-file',
                                    key: video.fileId,
                                    durationSeconds: video.durationSeconds,
                                  },
                                  // Watching completes against the length, so take the real one.
                                  ...(video.durationSeconds > 0
                                    ? { durationSeconds: video.durationSeconds }
                                    : {}),
                                })
                              }
                            />
                            {lesson.video ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  updateLesson(moduleIndex, lessonIndex, { video: null })
                                }
                              >
                                Remove the video
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-topic`}>Topic</Label>
                          <Input
                            id={`${key}-topic`}
                            maxLength={80}
                            value={lesson.topic}
                            placeholder="Optional, e.g. Collections"
                            onChange={(e) =>
                              updateLesson(moduleIndex, lessonIndex, { topic: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-minutes`}>Length (minutes)</Label>
                          <Input
                            id={`${key}-minutes`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={600}
                            value={Math.round(lesson.durationSeconds / 60)}
                            onChange={(e) =>
                              updateLesson(moduleIndex, lessonIndex, {
                                durationSeconds:
                                  Math.max(0, Math.min(600, Number(e.target.value) || 0)) * 60,
                              })
                            }
                          />
                        </div>
                      </div>
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
                          <NativeSelect
                            value={lesson.completionRule}
                            aria-label="Completion rule"
                            disabled={ALLOWED_COMPLETION_RULES[lesson.type].length === 1}
                            onChange={(e) =>
                              updateLesson(moduleIndex, lessonIndex, {
                                completionRule: e.target.value as CompletionRule,
                              })
                            }
                          >
                            {/* Only the rules this type of lesson can meet (Phase 2, D3). */}
                            {ALLOWED_COMPLETION_RULES[lesson.type].map((rule) => (
                              <option key={rule} value={rule}>
                                {RULE_LABELS[rule]}
                              </option>
                            ))}
                          </NativeSelect>
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
                      topic: '',
                      html: '',
                      video: null,
                      questionId: null,
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
