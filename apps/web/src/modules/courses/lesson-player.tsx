'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Download,
  ExternalLink,
  FileIcon,
  ListTree,
  Loader2,
  Lock,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  DIFFICULTY_LABELS,
  type CourseDetail,
  type LessonDetail,
  type LessonProgressResult,
} from '@lms/shared';
import { ErrorState } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { refreshLearnerState } from '@/lib/learner-state';
import { AskAiAbout, useAiSubject } from '@/modules/ai/assistant';
import { LAB_TYPE_META } from '@/modules/labs/lab-types';
import { useModuleOn } from '@/shell/me-context';
import { CurriculumRail, LESSON_TYPE, minutesOf } from './curriculum';

/** How often a playing video reports where the learner has got to. */
const SAVE_EVERY_SECONDS = 15;

function PlayerSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="space-y-4">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="hidden h-[28rem] rounded-xl lg:block" />
    </div>
  );
}

export function LessonPlayer({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const query = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => api<LessonDetail>(`/lessons/${lessonId}`),
  });

  if (query.isPending) return <PlayerSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  // Keyed by the lesson, never by when its data last arrived: a refresh must not remount the video.
  return <Player key={query.data.id} courseId={courseId} lesson={query.data} />;
}

/** The module a lesson sits in is open to the learner (the course page knows the unlock rules). */
function isOpen(course: CourseDetail | undefined, lessonId: string | null): boolean {
  if (!course || !lessonId) return false;
  const holder = course.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
  return holder?.unlocked !== false;
}

function Player({ courseId, lesson }: { courseId: string; lesson: LessonDetail }) {
  const queryClient = useQueryClient();
  const doubtsOn = useModuleOn('doubts');
  const router = useRouter();
  const lastSaved = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [contentsOpen, setContentsOpen] = useState(false);
  // SI Academy AI's assistant, opened here, is about this lesson: by id, checked by the API.
  useAiSubject({ courseId, lessonId: lesson.id, label: lesson.title });

  // The same query the course page uses, so the rail is usually already in the cache.
  const outline = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api<CourseDetail>(`/courses/${courseId}`),
  });
  const lessons = outline.data?.modules.flatMap((m) => m.lessons) ?? [];
  const previous = lessons.find((l) => l.id === lesson.previousLessonId);
  const following = lessons.find((l) => l.id === lesson.nextLessonId);
  const nextLocked =
    Boolean(lesson.nextLessonId) &&
    Boolean(outline.data) &&
    !isOpen(outline.data, lesson.nextLessonId);

  const refresh = () => refreshLearnerState(queryClient, { courseId, lessonId: lesson.id });

  /** After completing: on to the next lesson if completing this one has opened it. */
  const advance = () => {
    const course = queryClient.getQueryData<CourseDetail>(['course', courseId]);
    if (lesson.nextLessonId && isOpen(course, lesson.nextLessonId)) {
      router.push(`/courses/${courseId}/lessons/${lesson.nextLessonId}`);
    }
  };

  const complete = useMutation({
    mutationFn: () =>
      api<{ status: string; coursePct: number }>(`/lessons/${lesson.id}/complete`, {
        method: 'POST',
      }),
    onSuccess: async (result) => {
      await refresh();
      toast.success(`Marked complete. You are ${result.coursePct}% through this course.`);
      advance();
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'That could not be saved just now'),
  });

  const record = useMutation({
    mutationFn: (input: { positionSeconds: number }) =>
      api<LessonProgressResult>(`/lessons/${lesson.id}/progress`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: async (result) => {
      // Only the report that completed the lesson refreshes anything; later ones change nothing.
      if (result.newlyCompleted) {
        await refresh();
        toast.success(`Lesson complete. You are ${result.coursePct}% through this course.`);
      }
    },
    onError: () => {
      // Playback carries on; the next report (or the next pause) tries again.
      lastSaved.current = 0;
    },
  });

  /** Reports where playback is; the server works out how much of it counts as watched. */
  const report = (video: HTMLVideoElement) => {
    if (!video.duration || video.currentTime === lastSaved.current) return;
    lastSaved.current = video.currentTime;
    record.mutate({ positionSeconds: Math.floor(video.currentTime) });
  };

  // Hiding the page (switching tab, locking the phone) saves where the learner got to.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && videoRef.current) report(videoRef.current);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  });
  // A video whose length is known completes by measured watching; otherwise the learner marks it.
  const watchMeasured = lesson.completionRule === 'watch' && lesson.durationSeconds > 0;

  const playback = useQuery({
    queryKey: ['lesson', lesson.id, 'playback'],
    queryFn: () => api<{ url: string }>(`/lessons/${lesson.id}/playback`),
    enabled: lesson.type === 'video' && lesson.content.video !== null,
    staleTime: 3 * 60 * 60 * 1000,
  });

  const type = LESSON_TYPE[lesson.type];
  const TypeIcon = type.icon;
  const minutes = minutesOf(lesson);

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground"
        >
          <Link
            href={`/courses/${courseId}`}
            className="font-medium hover:text-foreground hover:underline"
          >
            {lesson.courseTitle}
          </Link>
          <span aria-hidden="true">/</span>
          <span>{lesson.moduleTitle}</span>
        </nav>

        <div className="mt-3 flex items-start justify-between gap-4">
          <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[1.875rem]">
            {lesson.title}
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 lg:hidden"
            onClick={() => setContentsOpen(true)}
            aria-haspopup="dialog"
          >
            <ListTree aria-hidden="true" />
            Contents
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <TypeIcon className="size-4" aria-hidden="true" />
            {type.label}
          </span>
          {minutes > 0 ? <span className="tabular-nums">· {minutes} min</span> : null}
          {lesson.isMandatory ? null : <span>· Optional</span>}
          {lesson.status === 'completed' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
              <CircleCheck className="size-3.5" aria-hidden="true" />
              Completed
            </span>
          ) : lesson.status === 'in_progress' ? (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-brand">
              In progress
            </span>
          ) : null}
        </div>

        <div className="mt-6 space-y-6">
          {lesson.type === 'video' ? (
            lesson.content.video && playback.data ? (
              <div className="overflow-hidden rounded-xl bg-black shadow-md ring-1 ring-border">
                <video
                  ref={videoRef}
                  className="aspect-video w-full"
                  controls
                  preload="metadata"
                  src={playback.data.url}
                  onLoadedMetadata={(e) => {
                    if (lesson.positionSeconds > 0) {
                      e.currentTarget.currentTime = lesson.positionSeconds;
                      // Resuming is not watching: the next report is measured from here.
                      lastSaved.current = lesson.positionSeconds;
                    }
                  }}
                  onTimeUpdate={(e) => {
                    const video = e.currentTarget;
                    if (Math.abs(video.currentTime - lastSaved.current) < SAVE_EVERY_SECONDS)
                      return;
                    report(video);
                  }}
                  onPause={(e) => report(e.currentTarget)}
                  onEnded={(e) => report(e.currentTarget)}
                >
                  <track kind="captions" />
                </video>
              </div>
            ) : playback.isError ? (
              <ErrorState error={playback.error} onRetry={() => playback.refetch()} />
            ) : lesson.content.video ? (
              <Skeleton className="aspect-video w-full rounded-xl" />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2/40 text-center">
                <Play className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  The video for this lesson has not been uploaded yet.
                </p>
              </div>
            )
          ) : null}

          {lesson.content.html ? (
            <article
              className="lesson-prose"
              // The body is written by staff in the course builder and stored as HTML.
              dangerouslySetInnerHTML={{ __html: lesson.content.html }}
            />
          ) : null}

          {lesson.type === 'practice' ? (
            <div className="flex flex-col gap-4 rounded-xl border border-primary-muted bg-primary-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground-secondary">
                This lesson is a question. Answering it correctly finishes the lesson.
              </p>
              <Button asChild className="shrink-0">
                <Link href={`/courses/${courseId}/lessons/${lesson.id}/practice`}>
                  Open the question
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          ) : null}

          {lesson.type === 'lab' ? <LabPanel courseId={courseId} lesson={lesson} /> : null}

          {lesson.resources.length > 0 ? (
            <section
              aria-labelledby="downloads-heading"
              className="rounded-xl border border-border bg-card"
            >
              <h2
                id="downloads-heading"
                className="border-b border-border px-5 py-3.5 text-sm font-semibold"
              >
                Downloads
              </h2>
              <ul className="divide-y divide-border/70">
                {lesson.resources.map((resource) => (
                  <ResourceRow key={resource.id} lessonId={lesson.id} resource={resource} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="mt-10 grid gap-3 border-t border-border pt-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div>
            {lesson.previousLessonId ? (
              <Link
                href={`/courses/${courseId}/lessons/${lesson.previousLessonId}`}
                className="group/prev flex max-w-xs flex-col rounded-lg px-1 py-1"
              >
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowLeft
                    className="size-3.5 transition-transform group-hover/prev:-translate-x-0.5"
                    aria-hidden="true"
                  />
                  Previous
                </span>
                {previous ? (
                  <span className="truncate text-sm font-medium text-foreground-secondary group-hover/prev:text-foreground">
                    {previous.title}
                  </span>
                ) : null}
              </Link>
            ) : null}
          </div>

          <div className="flex justify-center">
            {lesson.status === 'completed' ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <CircleCheck className="size-4" aria-hidden="true" />
                Done
              </span>
            ) : watchMeasured ? (
              <span className="max-w-xs text-center text-[13px] text-muted-foreground">
                This lesson completes itself once you have watched it ({lesson.watchedPct}% so far).
              </span>
            ) : lesson.completionRule === 'pass' ? (
              <span className="max-w-xs text-center text-[13px] text-muted-foreground">
                {lesson.type === 'practice'
                  ? 'This lesson completes itself once you answer its question correctly.'
                  : 'This lesson completes itself once you pass its lab.'}
              </span>
            ) : (
              <Button disabled={complete.isPending} onClick={() => complete.mutate()} size="lg">
                {complete.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <CircleCheck aria-hidden="true" />
                )}
                {complete.isPending ? 'Saving…' : 'Mark complete'}
              </Button>
            )}
          </div>

          <div className="flex sm:justify-end">
            {lesson.nextLessonId && nextLocked ? (
              <div className="flex max-w-xs flex-col items-end px-1 py-1 text-right">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden="true" />
                  Next lesson locked
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {following?.title ? `${following.title} — ` : ''}
                  finish this module to open it.
                </span>
              </div>
            ) : lesson.nextLessonId ? (
              <Link
                href={`/courses/${courseId}/lessons/${lesson.nextLessonId}`}
                className="group/next flex max-w-xs flex-col items-end rounded-lg px-1 py-1 text-right"
              >
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  Next
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover/next:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
                {following ? (
                  <span className="truncate text-sm font-medium text-foreground-secondary group-hover/next:text-foreground">
                    {following.title}
                  </span>
                ) : null}
              </Link>
            ) : (
              <Button variant="outline" asChild>
                <Link href={`/courses/${courseId}`}>Back to the course</Link>
              </Button>
            )}
          </div>
        </div>
        <AskAiAbout what="lesson" variant="line" />
        {doubtsOn ? (
          <p className="mt-6 text-center text-[13px] text-muted-foreground">
            Something not clear?{' '}
            <Link
              href={`/doubts/new?courseId=${courseId}&lessonId=${lesson.id}`}
              className="font-medium text-brand hover:underline"
            >
              Ask a doubt about this lesson
            </Link>
          </p>
        ) : null}
      </div>

      <aside
        aria-label="Course contents"
        className="sticky top-[calc(var(--header-height)+2rem)] hidden max-h-[calc(100dvh-var(--header-height)-4rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-card lg:block"
      >
        {outline.data ? (
          <CurriculumRail course={outline.data} courseId={courseId} currentLessonId={lesson.id} />
        ) : (
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}
      </aside>

      <Sheet open={contentsOpen} onOpenChange={setContentsOpen}>
        <SheetContent
          side="right"
          className="w-[min(22rem,90vw)] gap-0 overflow-y-auto p-0 lg:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Course contents</SheetTitle>
            <SheetDescription>
              Every lesson in this course, with what is done and what is next.
            </SheetDescription>
          </SheetHeader>
          {outline.data ? (
            <CurriculumRail
              course={outline.data}
              courseId={courseId}
              currentLessonId={lesson.id}
              onNavigate={() => setContentsOpen(false)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** A lab lesson: the lab it opens, and that passing it is what completes the lesson. */
function LabPanel({ courseId, lesson }: { courseId: string; lesson: LessonDetail }) {
  const lab = lesson.lab;
  if (!lab) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong bg-surface-2/40 p-5 text-sm text-muted-foreground">
        The lab for this lesson is not available right now. Try again later, or ask your trainer.
      </div>
    );
  }
  const meta = LAB_TYPE_META[lab.type];
  const Icon = meta.icon;
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-primary-muted bg-primary-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="size-4 text-brand" aria-hidden="true" />
          {lab.title}
        </p>
        <p className="text-[13px] text-foreground-secondary">
          {meta.label} lab ·{' '}
          {DIFFICULTY_LABELS[lab.difficulty as keyof typeof DIFFICULTY_LABELS] ?? lab.difficulty}
          {lab.solved ? ' · You have passed it' : ''}
        </p>
        <p className="text-[13px] text-muted-foreground">
          {lab.solved
            ? 'Passing it completed this lesson.'
            : 'Passing the lab, here or in the Labs, completes this lesson.'}
        </p>
      </div>
      <Button asChild className="shrink-0">
        <Link href={`/courses/${courseId}/lessons/${lesson.id}/lab`}>
          {lab.solved ? 'Open the lab again' : 'Open the lab'}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}

function fileLabel(mime: string): string {
  const sub = mime.split('/')[1] ?? mime;
  if (sub.includes('pdf')) return 'PDF';
  if (sub.includes('zip')) return 'ZIP';
  if (sub.includes('sheet') || sub.includes('excel')) return 'Spreadsheet';
  if (sub.includes('presentation') || sub.includes('powerpoint')) return 'Slides';
  if (sub.includes('word')) return 'Document';
  return sub.toUpperCase().slice(0, 8);
}

function ResourceRow({
  lessonId,
  resource,
}: {
  lessonId: string;
  resource: LessonDetail['resources'][number];
}) {
  // A file is fetched through a short-lived signed link, opened in this tab: the server sends it as
  // an attachment, so the page stays where it is, and no pop-up blocker stands in the way.
  const download = useMutation({
    mutationFn: () => api<{ url: string }>(`/lessons/${lessonId}/resources/${resource.id}/url`),
    onSuccess: (result) => window.location.assign(result.url),
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'That file could not be downloaded'),
  });

  const row =
    'flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition-colors hover:bg-surface-2/60';
  const badge = (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-secondary">
      {resource.fileId ? (
        <FileIcon className="size-4" aria-hidden="true" />
      ) : (
        <ExternalLink className="size-4" aria-hidden="true" />
      )}
    </span>
  );

  if (!resource.fileId) {
    return (
      <li>
        <a href={resource.url} target="_blank" rel="noopener noreferrer" className={row}>
          {badge}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-foreground">{resource.title}</span>
            <span className="block text-xs text-muted-foreground">Link · opens in a new tab</span>
          </span>
        </a>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        disabled={download.isPending}
        onClick={() => download.mutate()}
        className={`${row} disabled:opacity-60`}
      >
        {badge}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground">{resource.title}</span>
          <span className="block text-xs text-muted-foreground tabular-nums">
            {fileLabel(resource.mime)}
            {resource.size > 0 ? ` · ${Math.max(1, Math.round(resource.size / 1024))} KB` : ''}
          </span>
        </span>
        {download.isPending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : (
          <Download className="size-4 text-muted-foreground" aria-label="Download" />
        )}
      </button>
    </li>
  );
}
