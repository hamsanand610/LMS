import type { Metadata } from 'next';
import { QuestionsTable } from '@/modules/questions/questions-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Question bank' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Question bank"
        description="The questions you have written. Use them in your own assignments and tests."
      />
      <QuestionsTable basePath="/trainer/question-bank" />
    </>
  );
}
