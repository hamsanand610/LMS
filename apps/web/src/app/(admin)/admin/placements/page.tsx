import type { Metadata } from 'next';
import { AdminDrives } from '@/modules/placement/admin-drives';

export const metadata: Metadata = { title: 'Drives' };

export default function Page() {
  return <AdminDrives />;
}
