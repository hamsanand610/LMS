import type { Metadata } from 'next';
import { QuestionEditor } from '@/modules/questions/question-editor';

export const metadata: Metadata = { title: 'New question' };

export default function Page() {
  return <QuestionEditor />;
}
