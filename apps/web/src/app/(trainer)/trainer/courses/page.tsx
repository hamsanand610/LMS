import type { Metadata } from 'next';
import { CoursesTable } from '@/modules/courses/courses-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Courses' };

export default function TrainerCoursesPage() {
  return (
    <>
      <PageHeader
        title="Courses"
        description="The courses of the batches you teach, and those you are in charge of. Open one to see its outline and how your learners are getting on."
      />
      <CoursesTable basePath="/trainer/courses" />
    </>
  );
}
