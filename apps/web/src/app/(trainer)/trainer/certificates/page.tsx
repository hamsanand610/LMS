import type { Metadata } from 'next';
import { StaffCertificates } from '@/modules/certificates/staff-certificates';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Certificates' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Certificates"
        description="Certificates your batches' learners have earned."
      />
      <StaffCertificates />
    </>
  );
}
