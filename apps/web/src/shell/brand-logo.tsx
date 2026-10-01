import type { BrandingPublic } from '@lms/shared';
import { cn } from '@/lib/utils';

/** Up to two initials from the brand name, for the monogram. */
function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]![0], words[1]![0]] : [name[0]];
  return letters.join('').toUpperCase();
}

/**
 * The brand's monogram: its initials on the brand colour. Stands in for the logo where there is
 * room only for a mark (the collapsed rail, a phone header) and needs no uploaded asset.
 */
export function BrandMark({
  branding,
  size = 'md',
  className,
}: {
  branding: BrandingPublic;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg bg-primary font-semibold tracking-tight text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] ring-1 ring-black/10',
        size === 'sm' ? 'size-7 text-[11px]' : 'size-8 text-xs',
        className,
      )}
    >
      {initials(branding.brandName)}
    </span>
  );
}

/**
 * Logo (light/dark variants when uploaded) with the brand name as text fallback.
 *
 * `onDark` is for the navigation plane, which is dark in both themes: it uses the dark-background
 * logo when there is one and otherwise the wordmark in the navigation ink — the brand colour as
 * text on charcoal would not be legible.
 */
export function BrandLogo({
  branding,
  size = 'md',
  tone = 'default',
  className,
}: {
  branding: BrandingPublic;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'onDark';
  className?: string;
}) {
  const height = size === 'lg' ? 'h-14' : size === 'sm' ? 'h-7' : 'h-9';
  if (tone === 'onDark') {
    if (branding.logoDarkUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element -- client-uploaded asset with unknown dimensions
        <img
          src={branding.logoDarkUrl}
          alt={branding.brandName}
          className={cn(height, 'w-auto', className)}
        />
      );
    }
    return (
      <span className={cn('font-semibold tracking-tight text-nav-foreground', className)}>
        {branding.brandName}
      </span>
    );
  }
  if (branding.logoLightUrl) {
    return (
      <span className={cn('inline-flex items-center', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded asset with unknown dimensions */}
        <img
          src={branding.logoLightUrl}
          alt={branding.brandName}
          className={cn(height, 'w-auto', branding.logoDarkUrl && 'dark:hidden')}
        />
        {branding.logoDarkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoDarkUrl}
            alt=""
            aria-hidden="true"
            className={cn(height, 'hidden w-auto dark:inline')}
          />
        ) : null}
      </span>
    );
  }
  const text = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl';
  return (
    <span className={cn('font-semibold tracking-tight text-brand', text, className)}>
      {branding.brandName}
    </span>
  );
}
