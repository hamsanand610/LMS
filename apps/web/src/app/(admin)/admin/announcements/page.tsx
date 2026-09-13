import type { Metadata } from 'next';
import { AnnouncementsTable } from '@/modules/announcements/announcements-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Announcements' };

export default function AnnouncementsPage() {
  return (
    <>
      <PageHeader
        title="Announcements"
        description="Messages sent to a whole audience, in the app and optionally by email."
      />
      <AnnouncementsTable />
    </>
  );
}
