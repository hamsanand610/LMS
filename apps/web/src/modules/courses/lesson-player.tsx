'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { toast } from 'sonner';
import type { LessonDetail } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';

/** How often a playing video reports where the learner has got to. */
const SAVE_EVERY_SECONDS = 15;

export function LessonPlayer({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const query = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => api<LessonDetail>(`/lessons/${lessonId}`),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <Player key={query.dataUpdatedAt} courseId={courseId} lesson={query.data} />;
}

function Player({ courseId, lesson }: { courseId: string; lesson: LessonDetail }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const lastSaved = useRef(0);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['lesson', lesson.id] });
    await queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    await queryClient.invalidateQueries({ queryKey: ['my-courses'] });
  };

  const complete = useMutation({
    mutationFn: () =>
      api<{ status: string; coursePct: number }>(`/lessons/${lesson.id}/complete`, {
        method: 'POST',
      }),
    onSuccess: async (result) => {
      await refresh();
      toast.success(`Marked complete. You are ${result.coursePct}% through this course.`);
      if (lesson.nextLessonId) router.push(`/courses/${courseId}/lessons/${lesson.nextLessonId}`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'That could not be saved just now'),
  });

  const record = useMutation({
    mutationFn: (input: { positionSeconds: number; watchedPct: number }) =>
      api<{ completed: boolean; coursePct: number }>(`/lessons/${lesson.id}/progress`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: async (result) => {
      if (result.completed) {
        await refresh();
        toast.success(`Lesson complete. You are ${result.coursePct}% through this course.`);
      }
    },
  });

  const playback = useQuery({
    queryKey: ['lesson', lesson.id, 'playback'],
    queryFn: () => api<{ url: string }>(`/lessons/${lesson.id}/playback`),
    enabled: lesson.type === 'video' && lesson.content.video !== null,
    staleTime: 3 * 60 * 60 * 1000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/courses/${courseId}`} className="hover:underline">
          {lesson.courseTitle}
        </Link>
        <span aria-hidden>/</span>
        <span>{lesson.moduleTitle}</span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-balance">{lesson.title}</h1>

      {lesson.type === 'video' ? (
        lesson.content.video && playback.data ? (
          <video
            className="w-full rounded-lg border border-border bg-black"
            controls
            preload="metadata"
            src={playback.data.url}
            onLoadedMetadata={(e) => {
              if (lesson.positionSeconds > 0) e.currentTarget.currentTime = lesson.positionSeconds;
            }}
            onTimeUpdate={(e) => {
              const video = e.currentTarget;
              if (!video.duration) return;
              if (video.currentTime - lastSaved.current < SAVE_EVERY_SECONDS) return;
              lastSaved.current = video.currentTime;
              record.mutate({
                positionSeconds: Math.floor(video.currentTime),
                watchedPct: Math.min(100, Math.round((video.currentTime / video.duration) * 100)),
              });
            }}
            onEnded={(e) =>
              record.mutate({
                positionSeconds: Math.floor(e.currentTarget.currentTime),
                watchedPct: 100,
              })
            }
          >
            <track kind="captions" />
          </video>
        ) : playback.isError ? (
          <ErrorState error={playback.error} onRetry={() => playback.refetch()} />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            The video for this lesson has not been uploaded yet.
          </div>
        )
      ) : null}

      {lesson.content.html ? (
        <article
          className="prose max-w-none text-sm leading-6 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-2"
          // The body is written by staff in the course builder and stored as HTML.
          dangerouslySetInnerHTML={{ __html: lesson.content.html }}
        />
      ) : null}

      {lesson.type === 'practice' ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Practice questions are part of the question bank, which arrives in the next phase. This
          lesson has nothing to answer yet.
        </div>
      ) : null}

      {lesson.resources.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Downloads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lesson.resources.map((resource) => (
              <ResourceLink key={resource.id} lessonId={lesson.id} resource={resource} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button variant="outline" asChild disabled={!lesson.previousLessonId}>
          <Link
            href={
              lesson.previousLessonId
                ? `/courses/${courseId}/lessons/${lesson.previousLessonId}`
                : `/courses/${courseId}`
            }
          >
            <ChevronLeft className="size-4" aria-hidden /> Previous
          </Link>
        </Button>

        {lesson.status === 'completed' ? (
          <span className="text-sm text-success">Completed</span>
        ) : lesson.completionRule === 'watch' ? (
          <span className="text-sm text-muted-foreground">
            This lesson completes itself once you have watched it ({lesson.watchedPct}% so far).
          </span>
        ) : (
          <Button disabled={complete.isPending} onClick={() => complete.mutate()}>
            {complete.isPending ? 'Saving…' : 'Mark complete'}
          </Button>
        )}

        {lesson.nextLessonId ? (
          <Button variant="outline" asChild className="ml-auto">
            <Link href={`/courses/${courseId}/lessons/${lesson.nextLessonId}`}>
              Next <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" asChild className="ml-auto">
            <Link href={`/courses/${courseId}`}>Back to the course</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function ResourceLink({
  lessonId,
  resource,
}: {
  lessonId: string;
  resource: LessonDetail['resources'][number];
}) {
  const open = useMutation({
    mutationFn: () => api<{ url: string }>(`/lessons/${lessonId}/resources/${resource.id}/url`),
    onSuccess: (result) => window.open(result.url, '_blank', 'noopener,noreferrer'),
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'That file could not be opened'),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full justify-start"
      disabled={open.isPending}
      onClick={() => open.mutate()}
    >
      <Download className="size-4" aria-hidden />
      {resource.title}
      {resource.size > 0 ? (
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {Math.max(1, Math.round(resource.size / 1024))} KB
        </span>
      ) : null}
    </Button>
  );
}
