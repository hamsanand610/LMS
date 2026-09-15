import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PublicContentPage } from '@lms/shared';
import { Button } from '@/components/ui/button';
import { serverApi } from '@/lib/api/server';
import { getBranding } from '@/lib/api/server';
import { BrandLogo } from '@/shell/brand-logo';

async function load(slug: string): Promise<PublicContentPage | null> {
  try {
    return await serverApi<PublicContentPage>(`/pages/${slug}`);
  } catch {
    // A page that is not published, or does not exist, reads the same to a visitor.
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  return { title: page?.title ?? 'Page' };
}

/** One of the institute's own pages (plan DP-P09). Readable without signing in. */
export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [page, branding] = await Promise.all([load(slug), getBranding()]);
  if (!page) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <BrandLogo branding={branding} />
        <Button variant="outline" asChild>
          <Link href="/">Back</Link>
        </Button>
      </div>
      <article>
        <h1 className="mb-4 text-3xl font-semibold">{page.title}</h1>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{page.body}</div>
      </article>
      <p className="mt-10 text-xs text-muted-foreground">
        Last updated {new Date(page.updatedAt).toLocaleDateString()}.
      </p>
    </main>
  );
}
