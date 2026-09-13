import type { Metadata } from 'next';
import { NotificationCentre } from '@/modules/notifications/notification-centre';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Notifications' };

export default function NotificationsPage() {
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Everything the platform has told you, and how you want to be told."
      />
      <NotificationCentre />
    </>
  );
}
