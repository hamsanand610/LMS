import type { Metadata } from 'next';
import { QuestionEditor } from '@/modules/questions/question-editor';

export const metadata: Metadata = { title: 'Question' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestionEditor questionId={id} basePath="/trainer/question-bank" />;
}
