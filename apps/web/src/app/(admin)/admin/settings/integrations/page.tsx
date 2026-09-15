import type { Metadata } from 'next';
import { IntegrationsEditor } from '@/modules/settings/integrations-editor';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Integrations' };

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrations"
        description="Where email, files, video and code execution actually go."
      />
      <IntegrationsEditor />
    </>
  );
}
