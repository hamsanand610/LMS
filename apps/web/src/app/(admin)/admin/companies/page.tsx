import type { Metadata } from 'next';
import { AdminCompanies } from '@/modules/placement/admin-companies';

export const metadata: Metadata = { title: 'Companies' };

export default function Page() {
  return <AdminCompanies />;
}
