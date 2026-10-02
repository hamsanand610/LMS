import type { Metadata } from 'next';
import { StaffLabs } from '@/modules/labs/staff-labs';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Labs' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Labs"
        description="Every coding, SQL, debugging and web lab: where each stands, where it is used, and how learners are doing with it."
      />
      <StaffLabs basePath="/admin/labs" questionBase="/admin/question-bank" />
    </>
  );
}
