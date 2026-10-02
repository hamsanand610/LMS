'use client';

import { useQuery } from '@tanstack/react-query';
import type { CourseDetail } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { SectionHeader } from '@/components/section-header';
import { api } from '@/lib/api/http';
import { CourseLearners } from './course-learners';
import { CourseOutline } from './course-outline';
import { CourseWorkspace } from './course-workspace';

/**
 * A course in the trainer portal. Its staff get the author's workspace (ADR-0023); any other
 * trainer reads the outline their learners follow and sees how those learners are getting on.
 */
export function TrainerCourse({ courseId }: { courseId: string }) {
  const query = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api<CourseDetail>(`/courses/${courseId}`),
  });

  if (query.isPending) return <LoadingRows rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data.canEdit) {
    return <CourseWorkspace courseId={courseId} studentsBase="/trainer/students" />;
  }
  return (
    <div className="space-y-10">
      <CourseOutline courseId={courseId} />
      <section aria-labelledby="course-learners">
        <SectionHeader
          id="course-learners"
          title="Your learners"
          description="Progress of the learners in the batches you teach."
        />
        <CourseLearners courseId={courseId} studentsBase="/trainer/students" />
      </section>
    </div>
  );
}
