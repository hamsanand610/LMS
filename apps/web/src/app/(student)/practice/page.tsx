import type { Metadata } from 'next';
import { PracticeList } from '@/modules/practice/practice-list';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Practice' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Coding practice"
        description="Solve problems at your own pace. Your code runs in this browser, so nothing you write leaves your machine until you submit."
      />
      <PracticeList />
    </>
  );
}
