import type { Metadata } from 'next';
import { CustomFieldsEditor } from '@/modules/settings/custom-fields-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Custom fields' };

export default function CustomFieldsPage() {
  return (
    <>
      <PageHeader
        title="Custom fields"
        description="Extra fields this institute needs. They appear on the matching forms and are validated when a record is saved."
      />
      <CustomFieldsEditor />
    </>
  );
}
