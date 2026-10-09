import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getBranding, getMe } from '@/lib/api/server';
import { BrandLogo } from '@/shell/brand-logo';
import { portalHome } from '@/lib/auth/portals';

/** Signed-in users go straight to their portal; everyone else gets a branded entry point. */
export default async function LandingPage() {
  const me = await getMe();
  if (me) redirect(portalHome(me.homePortal));
  const branding = await getBranding();
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <h1 className="sr-only">{branding.brandName}</h1>
      <BrandLogo branding={branding} size="lg" />
      {branding.tagline ? (
        <p className="max-w-md text-[15px] leading-relaxed text-pretty text-muted-foreground">
          {branding.tagline}
        </p>
      ) : null}
      <Button asChild size="lg" className="min-w-40">
        <Link href="/login">Sign in</Link>
      </Button>
      <nav aria-label="Policies" className="flex gap-4 text-xs text-muted-foreground">
        <Link
          href="/pages/privacy"
          className="rounded-sm underline-offset-4 hover:text-foreground hover:underline"
        >
          Privacy Policy
        </Link>
        <Link
          href="/pages/terms"
          className="rounded-sm underline-offset-4 hover:text-foreground hover:underline"
        >
          Terms of Service
        </Link>
      </nav>
    </main>
  );
}
