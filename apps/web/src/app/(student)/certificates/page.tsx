import type { Metadata } from 'next';
import { CertificatesList } from '@/modules/certificates/certificates-list';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Certificates' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Certificates"
        description="A certificate for every course you complete, to download and to share."
      />
      <CertificatesList />
    </>
  );
}
