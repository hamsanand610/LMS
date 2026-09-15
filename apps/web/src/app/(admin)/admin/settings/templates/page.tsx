import type { Metadata } from 'next';
import { TemplatesEditor } from '@/modules/settings/templates-editor';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Templates and pages' };

export default function TemplatesPage() {
  return (
    <>
      <PageHeader
        title="Templates and pages"
        description="What the platform's emails say, and the institute's own pages."
      />
      <TemplatesEditor />
    </>
  );
}
