import type { Metadata } from 'next';
import { CoursesTable } from '@/modules/courses/courses-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Courses' };

export default function AdminCoursesPage() {
  return (
    <>
      <PageHeader
        title="Courses"
        description="Build a course, then publish it to a batch or a programme. Publishing is what puts it in front of learners."
      />
      <CoursesTable />
    </>
  );
}
