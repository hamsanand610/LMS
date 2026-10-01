import type { Metadata } from 'next';
import { DoubtsList } from '@/modules/doubts/doubts-list';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Doubts' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Doubts"
        description="Every learner’s questions across the institute, and whether somebody has answered."
      />
      <DoubtsList role="staff" basePath="/admin/doubts" />
    </>
  );
}
