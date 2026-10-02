import type { Metadata } from 'next';
import { LessonLab } from '@/modules/labs/lab-pages';

export const metadata: Metadata = { title: 'Lab' };

export default async function LessonLabPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  return <LessonLab key={lessonId} courseId={id} lessonId={lessonId} />;
}
