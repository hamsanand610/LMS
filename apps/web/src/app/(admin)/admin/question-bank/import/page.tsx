import type { Metadata } from 'next';
import { QuestionImport } from '@/modules/questions/question-import';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Import questions' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Import questions"
        description="Load a sheet of objective questions. Nothing is written until you have seen what every row would do."
      />
      <QuestionImport />
    </>
  );
}
