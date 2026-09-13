import type { BrandingPublic } from '@lms/shared';

const FONT_VARIABLE: Record<BrandingPublic['fontUi'], string> = {
  system:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  'ibm-plex-sans': 'var(--font-plex), ui-sans-serif, system-ui, sans-serif',
  inter: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
  manrope: 'var(--font-manrope), ui-sans-serif, system-ui, sans-serif',
  'source-sans-3': 'var(--font-plex), ui-sans-serif, system-ui, sans-serif',
  'noto-sans': 'var(--font-plex), ui-sans-serif, system-ui, sans-serif',
};

function declarations(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
}

/**
 * Injects the client's theme as CSS variables: light values on :root, dark values when the
 * theme script has stamped data-theme="dark". Rendered on the server so there is no flash.
 */
export function BrandingStyle({ branding }: { branding: BrandingPublic }) {
  const font = {
    '--font-ui': FONT_VARIABLE[branding.fontUi],
    '--font-code': 'var(--font-jetbrains), ui-monospace, Menlo, Consolas, monospace',
  };
  const light = { ...branding.tokens.light, ...font };
  const dark = { ...branding.tokens.dark, ...font };
  const css = `:root{${declarations(light)}}\n:root[data-theme="dark"]{${declarations(dark)}}`;
  return <style id="branding-tokens" dangerouslySetInnerHTML={{ __html: css }} />;
}
