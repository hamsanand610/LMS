import type { Metadata } from 'next';
import { PageHeader } from '@/shell/page-header';
import { BrandingForm } from '@/modules/settings/branding-form';

export const metadata: Metadata = { title: 'Branding' };

export default function BrandingPage() {
  return (
    <>
      <PageHeader
        title="Branding"
        description="Name, logo, colours and fonts for every page and email. Colours are checked for readable contrast before they can be saved."
      />
      <BrandingForm />
    </>
  );
}
