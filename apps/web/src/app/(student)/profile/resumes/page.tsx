import type { Metadata } from 'next';
import { ResumesPage } from '@/modules/profile/resumes-page';

export const metadata: Metadata = { title: 'Resumes' };

export default function Page() {
  return <ResumesPage />;
}
