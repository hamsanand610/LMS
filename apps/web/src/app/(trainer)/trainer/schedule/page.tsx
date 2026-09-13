import type { Metadata } from 'next';
import { ScheduleView } from '@/modules/schedule/schedule-view';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Schedule' };

export default function TrainerSchedulePage() {
  return (
    <>
      <PageHeader
        title="Schedule"
        description="Your classes. Mark one taught when it is over, and publish the recording so anyone who missed it can catch up."
      />
      <ScheduleView />
    </>
  );
}
