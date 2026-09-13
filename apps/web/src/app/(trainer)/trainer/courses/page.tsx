import type { Metadata } from 'next';
import { CoursesTable } from '@/modules/courses/courses-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Courses' };

export default function TrainerCoursesPage() {
  return (
    <>
      <PageHeader
        title="Courses"
        description="What has been published to the batches you teach. Open one to see the outline your learners follow."
      />
      <CoursesTable basePath="/trainer/courses" />
    </>
  );
}
