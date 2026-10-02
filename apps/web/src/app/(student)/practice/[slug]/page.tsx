import { permanentRedirect } from 'next/navigation';

/** A practice problem is a lab now (ADR-0018); its old address leads to it. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/labs/${encodeURIComponent(slug)}`);
}
