'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Clock,
  Layers,
  ListChecks,
  Lock,
  MessageCircleQuestion,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import type { CourseDetail, LessonSummary } from '@lms/shared';
import { ErrorState } from '@/components/page-states';
import { ProgressRing } from '@/components/progress-ring';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/http';
import { cn } from '@/lib/utils';
import { CourseCover } from './course-card';
import { LESSON_TYPE, LessonStatusIcon, minutesOf, moduleCounts } from './curriculum';
import { formatMinutes, humanise } from '@/lib/format';
import { AskAiAbout, useAiSubject } from '@/modules/ai/assistant';
import { useModuleOn } from '@/shell/me-context';

/** Consecutive lessons that share a topic, so a long module reads as a few named parts. */
function topicGroups(lessons: LessonSummary[]): { topic: string; lessons: LessonSummary[] }[] {
  const groups: { topic: string; lessons: LessonSummary[] }[] = [];
  for (const lesson of lessons) {
    const topic = lesson.topic ?? '';
    const last = groups.at(-1);
    if (last && last.topic === topic) last.lessons.push(lesson);
    else groups.push({ topic, lessons: [lesson] });
  }
  return groups;
}

/** Where the next lesson is: the module to open by default and the lesson to mark "up next". */
function locateNext(course: CourseDetail): { moduleId: string | null; lessonId: string | null } {
  const lessonId = course.nextLessonId ?? null;
  const owner = course.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
  return { moduleId: owner?.id ?? null, lessonId };
}

function OutlineSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

/** The course as a learner sees it: where you are, what is done, what is next, what is locked. */
export function CourseOutline({ courseId }: { courseId: string }) {
  const query = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api<CourseDetail>(`/courses/${courseId}`),
  });
  const doubtsOn = useModuleOn('doubts');
  // SI Academy AI's assistant, opened here, is about this course: by id, checked by the API.
  useAiSubject(query.data ? { courseId, label: query.data.title } : null);

  if (query.isPending) return <OutlineSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const course = query.data;
  const pct = course.progressPct ?? 0;
  const next = locateNext(course);
  const nextLesson = course.modules.flatMap((m) => m.lessons).find((l) => l.id === next.lessonId);
  // Counted on the percentage's own basis: required lessons, when some are optional.
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const requiredLessons = allLessons.filter((l) => l.isMandatory);
  const countedLessons = requiredLessons.length > 0 ? requiredLessons : allLessons;
  const doneLessons = countedLessons.filter((l) => l.status === 'completed').length;
  const meta = [course.subject, course.level].filter(Boolean).map(humanise).join(' · ');
  const hasOptional = course.modules.some((m) => m.lessons.some((l) => !l.isMandatory));
  // The lessons' own lengths, the same figure the course card shows; the author's estimate otherwise.
  const lessonMinutes = Math.round(allLessons.reduce((n, l) => n + l.durationSeconds, 0) / 60);
  const materialMinutes = lessonMinutes > 0 ? lessonMinutes : course.estimatedMinutes;
  const instructors = course.instructors ?? [];

  return (
    <>
      <Link
        href="/courses"
        className="group/back mb-4 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight
          className="size-3.5 rotate-180 transition-transform group-hover/back:-translate-x-0.5"
          aria-hidden="true"
        />
        All courses
      </Link>

      <header className="mb-8 overflow-hidden rounded-2xl border border-border bg-card">
        <CourseCover
          title={course.title}
          subject={course.subject}
          thumbnailUrl={course.thumbnailUrl}
          className="h-28 sm:h-36"
        />
        <div className="px-6 pt-5 pb-6 sm:px-8">
          {meta ? <p className="eyebrow">{meta}</p> : null}
          <h1 className="font-display mt-2 text-[2.1rem] leading-[1.04] text-balance sm:text-[2.6rem]">
            {course.title}
          </h1>
          {course.description ? (
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-pretty text-muted-foreground">
              {course.description}
            </p>
          ) : null}
          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-foreground-secondary">
            <div className="flex items-center gap-1.5">
              <Layers className="size-4 text-muted-foreground" aria-hidden="true" />
              <dt className="sr-only">Modules</dt>
              <dd>
                {course.modules.length} {course.modules.length === 1 ? 'module' : 'modules'}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <ListChecks className="size-4 text-muted-foreground" aria-hidden="true" />
              <dt className="sr-only">Lessons</dt>
              <dd>{course.lessonCount} lessons</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
              <dt className="sr-only">Material</dt>
              <dd>{formatMinutes(materialMinutes)} of material</dd>
            </div>
            {instructors.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
                <dt className="sr-only">Instructors</dt>
                <dd>Taught by {instructors.join(', ')}</dd>
              </div>
            ) : null}
          </dl>
          {course.tags.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Topics">
              {course.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-foreground-secondary"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="curriculum-heading" className="order-2 min-w-0 lg:order-1">
          <h2 id="curriculum-heading" className="mb-4 text-base font-semibold">
            Curriculum
          </h2>
          <ol className="flex flex-col gap-3">
            {course.modules.map((module, index) => {
              const locked = module.unlocked === false;
              const { done, total } = moduleCounts(module.lessons);
              const finished = total > 0 && done === total;
              const open = !locked && !finished ? true : module.id === next.moduleId;
              const modulePct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <li key={module.id}>
                  <details
                    open={open}
                    className={cn(
                      'group/module overflow-hidden rounded-xl border bg-card',
                      locked ? 'border-dashed border-border-strong/80' : 'border-border',
                    )}
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/50 [&::-webkit-details-marker]:hidden">
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums',
                          finished
                            ? 'bg-success-soft text-success'
                            : locked
                              ? 'bg-surface-2 text-muted-foreground'
                              : 'bg-primary-soft text-brand',
                        )}
                      >
                        {locked ? <Lock className="size-4" aria-label="Locked" /> : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-foreground">{module.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {locked
                            ? (module.lockReason ?? 'Locked')
                            : `${done} of ${total} lessons done`}
                        </span>
                      </span>
                      {!locked && total > 0 ? (
                        <span className="hidden sm:block" aria-hidden="true">
                          <ProgressRing
                            value={modulePct}
                            size={32}
                            stroke={3.5}
                            tone={modulePct >= 100 ? 'success' : 'default'}
                            label=""
                          >
                            <span />
                          </ProgressRing>
                        </span>
                      ) : null}
                      <ChevronDown
                        className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/module:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="border-t border-border">
                      {locked && module.lockReason ? (
                        <p className="flex items-center gap-2 bg-surface-2/60 px-5 py-2.5 text-xs text-foreground-secondary">
                          <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          {module.lockReason}
                        </p>
                      ) : null}
                      {module.lessons.length === 0 ? (
                        <p className="px-5 py-4 text-sm text-muted-foreground">
                          No lessons in this module yet.
                        </p>
                      ) : (
                        topicGroups(module.lessons).map((group, groupIndex) => (
                          <div key={`${group.topic}-${groupIndex}`}>
                            {group.topic ? (
                              <p className="border-b border-border/70 bg-surface-2/40 px-5 py-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                                {group.topic}
                              </p>
                            ) : null}
                            <ul className="divide-y divide-border/70">
                              {group.lessons.map((lesson) => (
                                <LessonRow
                                  key={lesson.id}
                                  lesson={lesson}
                                  courseId={courseId}
                                  locked={locked}
                                  upNext={lesson.id === next.lessonId}
                                />
                              ))}
                            </ul>
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        </section>

        <aside
          className="order-1 lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:order-2"
          aria-label="Your progress in this course"
        >
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <ProgressRing
                value={pct}
                size={84}
                stroke={7}
                tone={pct >= 100 ? 'success' : 'default'}
                label={`${pct}% of this course complete`}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{pct}% complete</p>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {doneLessons} of {countedLessons.length}{' '}
                  {countedLessons.length < allLessons.length ? 'required lessons' : 'lessons'}
                </p>
              </div>
            </div>
            {nextLesson ? (
              <div className="mt-5 rounded-lg bg-surface-2/70 px-3.5 py-3">
                <p className="text-xs text-muted-foreground">
                  {pct === 0 ? 'First lesson' : 'Up next'}
                </p>
                <p className="mt-0.5 text-sm leading-snug font-medium text-foreground">
                  {nextLesson.title}
                </p>
              </div>
            ) : null}
            {course.nextLessonId ? (
              <Button asChild className="mt-4 w-full">
                <Link href={`/courses/${courseId}/lessons/${course.nextLessonId}`}>
                  {pct === 0 ? 'Start the course' : 'Continue'}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : pct >= 100 ? (
              <p className="mt-4 text-sm text-success">
                Every lesson done. Revisit any of them below.
              </p>
            ) : null}
            {hasOptional ? (
              <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                Lessons marked optional are extra reading: they do not count towards completing the
                course.
              </p>
            ) : null}
          </div>
          <Link
            href={`/assignments?courseId=${courseId}`}
            className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-surface-2/60"
          >
            <ClipboardList className="size-4 shrink-0 text-brand" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">Assignments</span>
              <span className="block text-xs text-muted-foreground">
                The work set for this course, and how you are doing with it.
              </span>
            </span>
          </Link>
          {doubtsOn ? (
            <Link
              href={`/doubts/new?courseId=${courseId}`}
              className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-surface-2/60"
            >
              <MessageCircleQuestion className="size-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">Stuck on something?</span>
                <span className="block text-xs text-muted-foreground">
                  Ask your trainers a doubt about this course.
                </span>
              </span>
            </Link>
          ) : null}
          <AskAiAbout what="course" variant="card" />
        </aside>
      </div>
    </>
  );
}

function LessonRow({
  lesson,
  courseId,
  locked,
  upNext,
}: {
  lesson: LessonSummary;
  courseId: string;
  locked: boolean;
  upNext: boolean;
}) {
  const type = LESSON_TYPE[lesson.type];
  const TypeIcon = type.icon;
  const minutes = minutesOf(lesson);
  const body = (
    <>
      <LessonStatusIcon status={lesson.status} locked={locked} current={upNext} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block leading-snug',
            lesson.status === 'completed' ? 'text-foreground-secondary' : 'text-foreground',
          )}
        >
          {lesson.title}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <TypeIcon className="size-3.5" aria-hidden="true" />
          {type.label}
          {minutes > 0 ? <span className="tabular-nums">· {minutes} min</span> : null}
          {lesson.isMandatory ? null : <span>· optional</span>}
        </span>
      </span>
      {upNext && !locked ? (
        <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
          Up next
        </span>
      ) : null}
    </>
  );

  if (locked) {
    return (
      <li className="flex items-center gap-3.5 px-5 py-3 text-sm text-muted-foreground">{body}</li>
    );
  }
  return (
    <li>
      <Link
        href={`/courses/${courseId}/lessons/${lesson.id}`}
        className={cn(
          'flex items-center gap-3.5 px-5 py-3 text-sm transition-colors hover:bg-surface-2/60',
          upNext && 'bg-primary-soft/35',
        )}
      >
        {body}
      </Link>
    </li>
  );
}
