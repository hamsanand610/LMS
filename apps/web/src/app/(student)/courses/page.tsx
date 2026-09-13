import type { Metadata } from 'next';
import { CourseCatalogue } from '@/modules/courses/course-catalogue';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Courses' };

export default function StudentCoursesPage() {
  return (
    <>
      <PageHeader title="Courses" description="Everything published to your batch." />
      <CourseCatalogue />
    </>
  );
}
