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
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <BrandLogo branding={branding} size="lg" />
      {branding.tagline ? (
        <p className="max-w-md text-muted-foreground">{branding.tagline}</p>
      ) : null}
      <Button asChild size="lg">
        <Link href="/login">Sign in</Link>
      </Button>
    </main>
  );
}
