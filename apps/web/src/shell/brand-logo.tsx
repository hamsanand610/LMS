import type { BrandingPublic } from '@lms/shared';
import { cn } from '@/lib/utils';

/** Logo (light/dark variants when uploaded) with the brand name as text fallback. */
export function BrandLogo({
  branding,
  size = 'md',
  className,
}: {
  branding: BrandingPublic;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const height = size === 'lg' ? 'h-14' : size === 'sm' ? 'h-7' : 'h-9';
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
    <span className={cn('font-semibold tracking-tight text-primary', text, className)}>
      {branding.brandName}
    </span>
  );
}
