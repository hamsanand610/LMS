import type { Metadata } from 'next';
import { PageHeader } from '@/shell/page-header';
import { RolesMatrix } from '@/modules/rbac/roles-matrix';

export const metadata: Metadata = { title: 'Roles and permissions' };

export default function RolesPage() {
  return (
    <>
      <PageHeader
        title="Roles and permissions"
        description="Each role is a bundle of permissions with a scope: all records, the user's batches, or the user's own records. The Super Admin bundle always holds every permission."
      />
      <RolesMatrix />
    </>
  );
}
