import type { Metadata } from 'next';
import { FieldsEditor } from '@/modules/settings/fields-editor';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Fields and vocabularies' };

export default function FieldsPage() {
  return (
    <>
      <PageHeader
        title="Fields and vocabularies"
        description="The lists records choose from, and the extra fields this institute needs on its own forms."
      />
      <FieldsEditor />
    </>
  );
}
