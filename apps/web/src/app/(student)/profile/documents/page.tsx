import type { Metadata } from 'next';
import { DocumentsPage } from '@/modules/profile/documents-page';

export const metadata: Metadata = { title: 'Documents' };

export default function Page() {
  return <DocumentsPage />;
}
