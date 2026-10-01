import type { Metadata } from 'next';
import { SettingsHub } from '@/modules/account/settings-hub';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Your account, your notifications and how the portal looks."
      />
      <SettingsHub />
    </>
  );
}
