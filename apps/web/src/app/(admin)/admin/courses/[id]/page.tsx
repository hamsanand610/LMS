import type { Metadata } from 'next';
import { CourseWorkspace } from '@/modules/courses/course-workspace';

export const metadata: Metadata = { title: 'Course' };

export default async function AdminCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseWorkspace courseId={id} />;
}
