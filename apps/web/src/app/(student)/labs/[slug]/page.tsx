import type { Metadata } from 'next';
import { CatalogueLab } from '@/modules/labs/lab-pages';

export const metadata: Metadata = { title: 'Lab' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CatalogueLab key={slug} slug={slug} />;
}
