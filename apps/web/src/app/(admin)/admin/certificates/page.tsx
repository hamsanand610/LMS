import type { Metadata } from 'next';
import { StaffCertificates } from '@/modules/certificates/staff-certificates';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Certificates' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Certificates"
        description="Every certificate issued. Revoke or reinstate one with a reason; its words stay as issued."
      />
      <StaffCertificates />
    </>
  );
}
