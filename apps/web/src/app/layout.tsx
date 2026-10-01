import type { Metadata } from 'next';
import { IBM_Plex_Sans, Instrument_Sans, Inter, JetBrains_Mono, Manrope } from 'next/font/google';
import { getBranding } from '@/lib/api/server';
import { BrandingStyle } from '@/shell/theme/branding-style';
import { ThemeScript } from '@/shell/theme/theme-script';
import { Providers } from './providers';
import './globals.css';

/*
 * The interface faces an institute can choose (branding `fontUi`). Instrument Sans is loaded with its
 * width axis for the display voice (ADR-0015) and is the only one preloaded: the demo institute uses
 * it, and preloading every alternate would cost each page four font requests it does not need.
 */
const instrument = Instrument_Sans({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-instrument',
  display: 'swap',
});
const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
  display: 'swap',
  preload: false,
});
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
});
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  preload: false,
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
  preload: false,
});

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
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrument.variable} ${plex.variable} ${inter.variable} ${manrope.variable} ${mono.variable} h-full antialiased`}
    >
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
