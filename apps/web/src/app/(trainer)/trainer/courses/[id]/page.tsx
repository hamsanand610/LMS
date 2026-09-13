import type { Metadata } from 'next';
import { CourseOutline } from '@/modules/courses/course-outline';

export const metadata: Metadata = { title: 'Course' };

export default async function TrainerCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseOutline courseId={id} />;
}
