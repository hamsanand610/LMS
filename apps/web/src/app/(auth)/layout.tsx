import { getBranding } from '@/lib/api/server';
import { BrandLogo } from '@/shell/brand-logo';

/**
 * Branded authentication layout. The "split" variant shows a welcome panel on wide screens;
 * "centered" keeps a single column. Both come from the client's branding settings.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding();
  const split = branding.login.layout === 'split';
  return (
    <main className={split ? 'grid min-h-screen lg:grid-cols-2' : 'flex min-h-screen flex-col'}>
      <section className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <BrandLogo branding={branding} />
          </div>
          {children}
        </div>
      </section>
      {split ? (
        <aside
          className="relative hidden flex-col justify-end bg-primary p-12 text-primary-foreground lg:flex"
          style={
            branding.login.backgroundUrl
              ? {
                  backgroundImage: `url(${branding.login.backgroundUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          <div className="relative z-10 max-w-md">
            <p className="text-xs font-medium uppercase tracking-wider opacity-80">
              {branding.brandName}
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight">
              {branding.login.welcomeTitle}
            </h2>
            {branding.login.welcomeText ? (
              <p className="mt-3 text-base opacity-90">{branding.login.welcomeText}</p>
            ) : null}
          </div>
          {branding.login.backgroundUrl ? (
            <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
          ) : null}
        </aside>
      ) : null}
    </main>
  );
}
