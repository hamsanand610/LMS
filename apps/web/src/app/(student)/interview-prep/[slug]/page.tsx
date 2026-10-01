import type { Metadata } from 'next';
import { CompanyKit } from '@/modules/placement/company-kit';

export const metadata: Metadata = { title: 'Interview prep' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CompanyKit slug={slug} />;
}
