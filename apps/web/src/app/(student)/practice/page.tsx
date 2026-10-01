import type { Metadata } from 'next';
import { PracticeList } from '@/modules/practice/practice-list';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Practice' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Coding practice"
        description="Solve problems at your own pace. Run tries your code on the examples; Submit checks it against every case, hidden ones too, and records the result."
      />
      <PracticeList />
    </>
  );
}
