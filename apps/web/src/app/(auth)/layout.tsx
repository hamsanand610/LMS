import Link from 'next/link';
import { getBranding } from '@/lib/api/server';
import { BrandLogo } from '@/shell/brand-logo';
import { LoginVisual } from './login-visual';

/**
 * Branded authentication layout. The "split" variant sets the form beside the institute's picture
 * (Task 3, direction A): a dark panel in both themes, a column beside the form from 640 px and a
 * band above it on phones. "centered" keeps a single column. Words and imagery come from the
 * client's branding settings.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding();
  const split = branding.login.layout === 'split';
  const year = new Date().getFullYear();

  return (
    <main
      className={
        split
          ? 'grid min-h-dvh grid-rows-[auto_1fr] bg-background sm:grid-cols-[minmax(19rem,1fr)_minmax(0,1fr)] sm:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]'
          : 'flex min-h-dvh flex-col bg-background'
      }
    >
      <section className="flex flex-1 flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-14 xl:px-20">
        {/* On phones the panel above already carries the institute's name. */}
        <div className={split ? 'hidden items-center sm:flex' : 'flex items-center'}>
          <BrandLogo branding={branding} />
        </div>
        <div className="flex flex-1 flex-col pt-1 pb-8 sm:items-center sm:justify-center sm:py-6 lg:py-10">
          <div className="w-full sm:max-w-[23rem]">{children}</div>
        </div>
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            © {year} {branding.brandName}
          </span>
          <Link
            href="/pages/privacy"
            className="rounded-sm underline-offset-4 hover:text-foreground hover:underline"
          >
            Privacy notice
          </Link>
          <Link
            href="/pages/terms"
            className="rounded-sm underline-offset-4 hover:text-foreground hover:underline"
          >
            Terms of use
          </Link>
        </footer>
      </section>

      {split ? <LoginVisual branding={branding} /> : null}
    </main>
  );
}
