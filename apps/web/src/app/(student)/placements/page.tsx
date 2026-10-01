import type { Metadata } from 'next';
import { DrivesBoard } from '@/modules/placement/drives-board';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Placements' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  return (
    <>
      <PageHeader
        title="Placements"
        description="Recruitment drives run through the institute. Apply to the ones open to you and follow each application here."
      />
      <DrivesBoard companyId={companyId} />
    </>
  );
}
