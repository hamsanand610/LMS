import type { Metadata } from 'next';
import { Playground } from '@/modules/labs/playground';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Playground' };

export default function Page() {
  return (
    <>
      <PageHeader
        back={{ href: '/labs', label: 'Labs' }}
        title="Playground"
        description="Write and run code of your own in the sandbox. Nothing here is marked; your code is kept as a draft for each language."
      />
      <Playground />
    </>
  );
}
