import type { Metadata } from 'next';
import { QUESTION_TYPES, type QuestionType } from '@lms/shared';
import { QuestionEditor } from '@/modules/questions/question-editor';

export const metadata: Metadata = { title: 'New question' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { type } = await searchParams;
  // "New lab" opens the editor on a lab's type; anything else starts as usual.
  const initialType = (QUESTION_TYPES as readonly string[]).includes(String(type))
    ? (type as QuestionType)
    : undefined;
  return <QuestionEditor basePath="/admin/question-bank" initialType={initialType} />;
}
