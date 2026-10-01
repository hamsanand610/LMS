import type { Metadata } from 'next';
import { AskDoubt } from '@/modules/doubts/ask-doubt';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Ask a doubt' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string; lessonId?: string }>;
}) {
  const { courseId, lessonId } = await searchParams;
  return (
    <>
      <PageHeader
        back={{ href: '/doubts', label: 'Doubts' }}
        title="Ask a doubt"
        description="The trainers of your batch answer here, usually within a working day."
      />
      <AskDoubt courseId={courseId} lessonId={lessonId} />
    </>
  );
}
