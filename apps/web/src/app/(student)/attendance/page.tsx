import type { Metadata } from 'next';
import { AttendanceDetail } from '@/modules/attendance/attendance-summary';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Attendance' };

/** The learner's attendance: the figure, by subject, and class by class (Phase 2, LRN-05). */
export default function Page() {
  return (
    <>
      <PageHeader
        title="Attendance"
        description="Every class of your batch since it began: what was marked, by subject and day by day."
      />
      <AttendanceDetail endpoint="/me/attendance" title="Your attendance" />
    </>
  );
}
