import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PublicContentPage } from '@lms/shared';
import { Button } from '@/components/ui/button';
import { serverApi } from '@/lib/api/server';
import { getBranding } from '@/lib/api/server';
import { ContentBody } from '@/modules/content/content-body';
import { BrandLogo } from '@/shell/brand-logo';
import { formatDate } from '@/lib/format';

async function load(slug: string): Promise<PublicContentPage | null> {
  try {
    return await serverApi<PublicContentPage>(`/pages/${slug}`);
  } catch {
    // A page that is not published, or does not exist, reads the same to a visitor.
    return null;
  }
}

/** The two pages every visitor may need, linked from each other's foot. */
const LEGAL = [
  { slug: 'privacy', label: 'Privacy Policy' },
  { slug: 'terms', label: 'Terms of Service' },
];

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
    <main className="flex-1 bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <BrandLogo branding={branding} />
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft aria-hidden="true" />
              Back
            </Link>
          </Button>
        </div>
      </header>
      <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <p className="eyebrow">{branding.brandName}</p>
        <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-balance text-foreground">
          {page.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {formatDate(page.updatedAt)}.
        </p>
        <ContentBody body={page.body} className="mt-10" />
      </article>
      <footer className="border-t border-border">
        <nav
          aria-label="Policies"
          className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-sm text-muted-foreground sm:px-6"
        >
          <span>
            © {new Date().getFullYear()} {branding.brandName}
          </span>
          {LEGAL.map((item) =>
            item.slug === page.slug ? (
              <span key={item.slug} aria-current="page" className="font-medium text-foreground">
                {item.label}
              </span>
            ) : (
              <Link
                key={item.slug}
                href={`/pages/${item.slug}`}
                className="rounded-sm underline-offset-4 hover:text-foreground hover:underline"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </footer>
    </main>
  );
}
