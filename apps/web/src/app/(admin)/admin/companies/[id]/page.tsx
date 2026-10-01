import type { Metadata } from 'next';
import { AdminCompany } from '@/modules/placement/admin-company';

export const metadata: Metadata = { title: 'Company' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminCompany id={id} />;
}
