'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleDashed, Lock, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import type { CourseDetail, LessonSummary } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api/http';
import { PageHeader } from '@/shell/page-header';

/** The course as a learner sees it: what is done, what is next, what is still locked. */
export function CourseOutline({ courseId }: { courseId: string }) {
  const query = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api<CourseDetail>(`/courses/${courseId}`),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const course = query.data;

  return (
    <>
      <PageHeader
        title={course.title}
        description={course.description}
        actions={
          course.nextLessonId ? (
            <Button asChild>
              <Link href={`/courses/${courseId}/lessons/${course.nextLessonId}`}>
                {course.progressPct === 0 ? 'Start the course' : 'Continue'}
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-6 max-w-md space-y-1">
        <Progress
          value={course.progressPct ?? 0}
          aria-label={`${course.progressPct ?? 0}% complete`}
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {course.progressPct ?? 0}% complete · {course.lessonCount} lessons ·{' '}
          {Math.round(course.estimatedMinutes / 60)} hours of material
        </p>
      </div>

      <div className="space-y-4">
        {course.modules.map((module, index) => (
          <Card key={module.id} className={module.unlocked === false ? 'opacity-70' : undefined}>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <CardTitle className="text-base">
                {index + 1}. {module.title}
              </CardTitle>
              {module.unlocked === false ? (
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden />
                  {module.lockReason}
                </span>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-1">
              {module.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  courseId={courseId}
                  locked={module.unlocked === false}
                />
              ))}
              {module.lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lessons in this module yet.</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function LessonRow({
  lesson,
  courseId,
  locked,
}: {
  lesson: LessonSummary;
  courseId: string;
  locked: boolean;
}) {
  const Icon =
    lesson.status === 'completed'
      ? CheckCircle2
      : lesson.status === 'in_progress'
        ? PlayCircle
        : CircleDashed;
  const minutes = Math.round(lesson.durationSeconds / 60);
  const body = (
    <>
      <Icon
        className={
          lesson.status === 'completed' ? 'size-4 text-success' : 'size-4 text-muted-foreground'
        }
        aria-hidden
      />
      <span className="flex-1">{lesson.title}</span>
      <span className="text-xs text-muted-foreground capitalize">{lesson.type}</span>
      {minutes > 0 ? (
        <span className="text-xs text-muted-foreground tabular-nums">{minutes} min</span>
      ) : null}
      {lesson.isMandatory ? null : <span className="text-xs text-muted-foreground">optional</span>}
    </>
  );

  if (locked) {
    return (
      <div
        className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground"
        aria-disabled="true"
      >
        {body}
      </div>
    );
  }
  return (
    <Link
      href={`/courses/${courseId}/lessons/${lesson.id}`}
      className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
    >
      {body}
    </Link>
  );
}
