import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StudentImport } from '@/modules/students/student-import';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Import students' };

export default function StudentImportPage() {
  return (
    <>
      <PageHeader
        title="Import students"
        description="Create many student accounts from a sheet. Check the file first; nothing is written until you import."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/students">Back to students</Link>
          </Button>
        }
      />
      <StudentImport />
    </>
  );
}
