import type { Metadata } from 'next';
import { PageHeader } from '@/shell/page-header';
import { NavigationEditor } from '@/modules/settings/navigation-editor';

export const metadata: Metadata = { title: 'Navigation' };

export default function NavigationSettingsPage() {
  return (
    <>
      <PageHeader
        title="Navigation"
        description="Rename, reorder or hide menu items per portal. Items still respect permissions and feature flags."
      />
      <NavigationEditor />
    </>
  );
}
