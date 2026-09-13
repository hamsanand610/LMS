import type { Metadata } from 'next';
import { IBM_Plex_Sans, Inter, JetBrains_Mono, Manrope } from 'next/font/google';
import { getBranding } from '@/lib/api/server';
import { BrandingStyle } from '@/shell/theme/branding-style';
import { ThemeScript } from '@/shell/theme/theme-script';
import { Providers } from './providers';
import './globals.css';

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
  display: 'swap',
});
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
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
      className={`${plex.variable} ${inter.variable} ${manrope.variable} ${mono.variable} h-full antialiased`}
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
