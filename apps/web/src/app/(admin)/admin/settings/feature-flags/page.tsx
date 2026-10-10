import type { Metadata } from 'next';
import { PageHeader } from '@/shell/page-header';
import { FeatureFlagsTable } from '@/modules/settings/feature-flags-table';

export const metadata: Metadata = { title: 'Feature flags' };

export default function FeatureFlagsPage() {
  return (
    <>
      <PageHeader
        title="Feature flags"
        description="Enable or disable modules and options for this institute. A module that is off disappears from every menu, and its pages and actions stop working."
      />
      <FeatureFlagsTable />
    </>
  );
}
