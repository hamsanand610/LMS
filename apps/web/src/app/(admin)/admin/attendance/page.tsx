import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingRows } from '@/components/page-states';
import { AttendanceSessions } from '@/modules/attendance/attendance-sessions';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Attendance' };

export default function AdminAttendancePage() {
  return (
    <>
      <PageHeader
        title="Attendance"
        description="Every class across the institute, and which ones are still waiting for a roll call."
      />
      <Suspense fallback={<LoadingRows rows={8} />}>
        <AttendanceSessions portal="admin" />
      </Suspense>
    </>
  );
}
