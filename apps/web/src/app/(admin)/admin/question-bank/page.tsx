import type { Metadata } from 'next';
import { QuestionsTable } from '@/modules/questions/questions-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Question bank' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Question bank"
        description="Every question the institute has written. Assignments and tests draw from here, so a question is written once and used many times."
      />
      <QuestionsTable />
    </>
  );
}
