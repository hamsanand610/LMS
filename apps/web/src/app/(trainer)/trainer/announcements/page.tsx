import type { Metadata } from 'next';
import { AnnouncementsTable } from '@/modules/announcements/announcements-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Announcements' };

export default function TrainerAnnouncementsPage() {
  return (
    <>
      <PageHeader
        title="Announcements"
        description="Messages to the batches you teach, with the ones you have already sent."
      />
      <AnnouncementsTable />
    </>
  );
}
