import type { Metadata } from 'next';
import { LabsHub } from '@/modules/labs/labs-hub';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Labs' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Labs"
        description="Practise by doing: coding, SQL, debugging and web labs, and a playground for trying ideas. Run tries your work on the visible checks; Submit checks it against every one, hidden ones too. Everything runs in the sandbox."
      />
      <LabsHub />
    </>
  );
}
