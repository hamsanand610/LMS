import type { Metadata } from 'next';
import { PageHeader } from '@/shell/page-header';
import { GeneralSettingsForm } from '@/modules/settings/general-settings-form';

export const metadata: Metadata = { title: 'General settings' };

export default function GeneralSettingsPage() {
  return (
    <>
      <PageHeader
        title="General settings"
        description="Institute details, academic defaults and consent wording. Changes apply immediately and are audited."
      />
      <GeneralSettingsForm />
    </>
  );
}
