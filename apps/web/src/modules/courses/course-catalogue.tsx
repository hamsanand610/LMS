'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { CourseProgress } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api/http';

/** The learner's own courses, ordered by what they touched last. */
export function CourseCatalogue() {
  const query = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => api<CourseProgress[]>('/me/courses'),
  });

  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        title="No courses yet"
        description="Courses appear the moment your institute publishes one to your batch. Nothing is hidden from you here."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {query.data.map((course) => (
        <CourseCard key={course.courseId} course={course} />
      ))}
    </div>
  );
}

export function CourseCard({ course }: { course: CourseProgress }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">
          <Link href={`/courses/${course.courseId}`} className="hover:underline">
            {course.title}
          </Link>
        </CardTitle>
        <CardDescription className="capitalize">
          {[course.subject, course.level].filter(Boolean).join(' · ') || 'Course'}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <div className="space-y-1">
          <Progress value={course.progressPct} aria-label={`${course.progressPct}% complete`} />
          <p className="text-xs text-muted-foreground tabular-nums">
            {course.completedLessons} of {course.lessonCount} lessons · {course.progressPct}%
          </p>
        </div>
        {course.nextLessonId ? (
          <Button asChild size="sm" className="w-full">
            <Link href={`/courses/${course.courseId}/lessons/${course.nextLessonId}`}>
              {course.progressPct === 0 ? 'Start' : 'Continue'}: {course.nextLessonTitle}
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link href={`/courses/${course.courseId}`}>Review the course</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
