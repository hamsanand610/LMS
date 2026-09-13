import type { Metadata } from 'next';
import { PageHeader } from '@/shell/page-header';
import { AccountPanels } from '@/modules/account/account-panels';

export const metadata: Metadata = { title: 'My account' };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="My account" description="Your name, password and signed-in devices." />
      <AccountPanels />
    </>
  );
}
