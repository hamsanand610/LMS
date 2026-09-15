import type { Metadata } from 'next';
import { Preferences } from '@/modules/notifications/notification-centre';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Notification preferences' };

export default function NotificationPreferencesPage() {
  return (
    <>
      <PageHeader
        title="Notification preferences"
        description="Which kinds of message reach you, and how. Anything urgent about your account is always sent."
      />
      <Preferences />
    </>
  );
}
