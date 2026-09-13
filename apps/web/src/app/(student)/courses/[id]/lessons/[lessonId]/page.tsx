import type { Metadata } from 'next';
import { LessonPlayer } from '@/modules/courses/lesson-player';

export const metadata: Metadata = { title: 'Lesson' };

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  return <LessonPlayer courseId={id} lessonId={lessonId} />;
}
