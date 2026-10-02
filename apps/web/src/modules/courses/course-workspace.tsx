'use client';

import { useQuery } from '@tanstack/react-query';
import type { CourseDetail } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatStrip } from '@/components/stat-strip';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { useParentPath } from '@/lib/use-parent-path';
import { PageHeader } from '@/shell/page-header';
import { useCan } from '@/shell/me-context';
import { CourseBuilder } from './course-builder';
import { CourseLearners } from './course-learners';
import { CourseSettings } from './course-settings';
import { CourseStaffPanel } from './course-staff-panel';
import { PublishPanel } from './publish-panel';

/**
 * Everything an author does to one course: its outline, who has it, its learners and its details.
 * Administrators also choose its staff here; a trainer on its staff sees the same workspace.
 */
export function CourseWorkspace({
  courseId,
  studentsBase = '/admin/students',
}: {
  courseId: string;
  studentsBase?: string;
}) {
  const listHref = useParentPath();
  const canManage = useCan('courses:manage');
  const query = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api<CourseDetail>(`/courses/${courseId}`),
  });

  if (query.isPending) return <LoadingRows rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const course = query.data;

  return (
    <>
      <PageHeader
        back={{ href: listHref, label: 'All courses' }}
        eyebrow="Course"
        title={course.title}
        description={course.description || 'No description yet.'}
        meta={<StatusBadge status={course.status} />}
      />
      <StatStrip
        className="mb-6"
        items={[
          { label: 'Modules', value: String(course.moduleCount) },
          { label: 'Lessons', value: String(course.lessonCount) },
          { label: 'Audiences', value: String(course.publicationCount) },
        ]}
      />

      <Tabs defaultValue="outline">
        <TabsList>
          <TabsTrigger value="outline">Outline</TabsTrigger>
          <TabsTrigger value="publish">Publishing</TabsTrigger>
          <TabsTrigger value="learners">Learners</TabsTrigger>
          <TabsTrigger value="settings">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="outline" className="pt-4">
          <CourseBuilder courseId={courseId} />
        </TabsContent>
        <TabsContent value="publish" className="pt-4">
          <PublishPanel courseId={courseId} />
        </TabsContent>
        <TabsContent value="learners" className="pt-4">
          <CourseLearners courseId={courseId} studentsBase={studentsBase} />
        </TabsContent>
        <TabsContent value="settings" className="space-y-6 pt-4">
          {canManage ? <CourseStaffPanel course={course} /> : null}
          <CourseSettings courseId={courseId} />
        </TabsContent>
      </Tabs>
    </>
  );
}
