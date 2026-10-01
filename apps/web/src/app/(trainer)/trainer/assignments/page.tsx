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
        description="What you have given your batches, how they are doing, and the answers waiting for you."
        actions={
          <Button asChild variant="outline">
            <Link href="/trainer/assignments/analytics">
              <ChartColumn aria-hidden="true" />
              Analytics
            </Link>
          </Button>
        }
      />
      <AssignmentsTable basePath="/trainer/assignments" />
    </>
  );
}
