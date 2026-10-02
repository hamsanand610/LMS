import type { Metadata } from 'next';
import { TrainerCourse } from '@/modules/courses/trainer-course';

export const metadata: Metadata = { title: 'Course' };

export default async function TrainerCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrainerCourse courseId={id} />;
}
