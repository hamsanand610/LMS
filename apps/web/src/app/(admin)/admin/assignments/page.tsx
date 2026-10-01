import { ChartColumn } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AssignmentsTable } from '@/modules/assignments/assignments-table';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Assignments' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Assignments"
        description="Coding, SQL, written and project work built from the question bank, given to batches or named learners with their own dates."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/assignments/analytics">
              <ChartColumn aria-hidden="true" />
              Analytics
            </Link>
          </Button>
        }
      />
      <AssignmentsTable />
    </>
  );
}
