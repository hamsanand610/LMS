import type { Metadata } from 'next';
import { LessonPractice } from '@/modules/courses/lesson-practice';

export const metadata: Metadata = { title: 'Practice' };

export default async function LessonPracticePage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  return <LessonPractice courseId={id} lessonId={lessonId} />;
}
