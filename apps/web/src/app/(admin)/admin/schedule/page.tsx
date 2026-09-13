import type { Metadata } from 'next';
import { SessionsTable } from '@/modules/schedule/sessions-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Schedule' };

export default function AdminSchedulePage() {
  return (
    <>
      <PageHeader
        title="Schedule"
        description="Every class across the institute. Timetables are set on each batch, under its Timetable tab."
      />
      <SessionsTable />
    </>
  );
}
