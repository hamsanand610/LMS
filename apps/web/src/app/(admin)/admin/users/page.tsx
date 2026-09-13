import type { Metadata } from 'next';
import { PageHeader } from '@/shell/page-header';
import { UsersTable } from '@/modules/users/users-table';

export const metadata: Metadata = { title: 'Users' };

export default function UsersPage() {
  return (
    <>
      <PageHeader
        title="Users"
        description="Staff and student accounts. Invited users receive an email with a link to set their password."
      />
      <UsersTable />
    </>
  );
}
