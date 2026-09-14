import type { Metadata } from 'next';
import { MyTests } from '@/modules/tests/my-tests';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Tests' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Tests"
        description="What is open now, what is coming, and how you did on the ones you have sat."
      />
      <MyTests />
    </>
  );
}
