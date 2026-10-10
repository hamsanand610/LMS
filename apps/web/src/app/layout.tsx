import type { Metadata } from 'next';
import { preload } from 'react-dom';
import { getBranding } from '@/lib/api/server';
import { BrandingStyle } from '@/shell/theme/branding-style';
import { ThemeScript } from '@/shell/theme/theme-script';
import instrumentSansLatin from './fonts/instrument-sans/latin.woff2';
import { Providers } from './providers';
import './fonts/fonts.css';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: { default: branding.brandName, template: `%s · ${branding.brandName}` },
    description: branding.tagline || undefined,
    icons: branding.faviconUrl ? { icon: branding.faviconUrl } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding();
  /*
   * The interface faces an institute can choose (branding `fontUi`) and the code face are served
   * from ./fonts (fonts.css). Instrument Sans's Latin file is the only one preloaded (ADR-0015): the
   * demo institute uses it, and preloading every alternate would cost each page four font requests
   * it does not need.
   */
  preload(instrumentSansLatin, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <BrandingStyle branding={branding} />
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
