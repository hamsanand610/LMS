import type { Metadata } from 'next';
import { ScheduleView } from '@/modules/schedule/schedule-view';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Schedule' };

export default function StudentSchedulePage() {
  return (
    <>
      <PageHeader
        title="Schedule"
        description="Your classes, week by week. The join link appears shortly before each one starts."
      />
      <ScheduleView />
    </>
  );
}
