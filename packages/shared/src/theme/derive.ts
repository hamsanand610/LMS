import type { ComputedTokens, TokenSet } from '../schemas/branding.js';
import { bestForeground, contrastRatio, ensureContrast, hexToHsl, hslToHex } from './color.js';

/** Seed inputs needed for token derivation (subset of the branding seeds). */
export interface TokenSeeds {
  primaryColor: string;
  accentColor?: string | null;
  radius?: 'none' | 'sm' | 'md' | 'lg';
  density?: 'comfortable' | 'compact';
  fontUi?: string;
}

export interface BrandingIssue {
  token: string;
  message: string;
  ratio: number;
  required: number;
}

const RADIUS_PX: Record<NonNullable<TokenSeeds['radius']>, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
};

const FONT_STACKS: Record<string, string> = {
  system:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  'ibm-plex-sans': '"IBM Plex Sans", ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
  inter: 'Inter, ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
  manrope: 'Manrope, ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
  'source-sans-3': '"Source Sans 3", ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
  'noto-sans': '"Noto Sans", ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
};

/** Semantic colours are fixed and never overridden by brand colours. */
const SEMANTIC = {
  light: {
    success: '#15803d',
    warning: '#a16207',
    danger: '#b91c1c',
    info: '#1d4ed8',
    successSoft: '#dcfce7',
    warningSoft: '#fef3c7',
    dangerSoft: '#fee2e2',
    infoSoft: '#dbeafe',
  },
  dark: {
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#f87171',
    info: '#60a5fa',
    successSoft: '#14532d',
    warningSoft: '#78350f',
    dangerSoft: '#7f1d1d',
    infoSoft: '#1e3a8a',
  },
} as const;

function tinted(hue: number, saturation: number, lightness: number): string {
  return hslToHex({ h: hue, s: saturation, l: lightness });
}

function chartSeries(primary: string, scheme: 'light' | 'dark'): string[] {
  const base = hexToHsl(primary);
  const offsets = [0, 60, 150, 210, 270, 320];
  const l = scheme === 'light' ? 42 : 62;
  const s = Math.max(45, Math.min(70, base.s || 55));
  return offsets.map((o) => hslToHex({ h: base.h + o, s, l }));
}

/**
 * Derives the complete token set for both colour schemes from the brand seeds.
 * Neutrals are tinted toward the primary hue; contrast is enforced for text and controls.
 */
export function deriveTokens(seeds: TokenSeeds): ComputedTokens {
  const primary = seeds.primaryColor.toLowerCase();
  const accent = (seeds.accentColor ?? primary).toLowerCase();
  const hue = hexToHsl(primary).h;

  const lightBg = tinted(hue, 20, 97);
  const lightSurface = '#ffffff';
  const lightSurface2 = tinted(hue, 16, 94);
  const lightBorder = tinted(hue, 14, 86);
  const lightText = ensureContrast(tinted(hue, 30, 12), lightBg, 7);
  const lightMuted = ensureContrast(tinted(hue, 12, 42), lightBg, 4.5);
  const lightPrimary = ensureContrast(primary, lightSurface, 3);
  const lightAccent = ensureContrast(accent, lightSurface, 3);

  const darkBg = tinted(hue, 18, 8);
  const darkSurface = tinted(hue, 16, 12);
  const darkSurface2 = tinted(hue, 14, 16);
  const darkBorder = tinted(hue, 12, 24);
  const darkText = ensureContrast(tinted(hue, 15, 92), darkBg, 7);
  const darkMuted = ensureContrast(tinted(hue, 10, 66), darkBg, 4.5);
  const darkPrimary = ensureContrast(primary, darkSurface, 3);
  const darkAccent = ensureContrast(accent, darkSurface, 3);

  const shared: TokenSet = {
    '--radius': RADIUS_PX[seeds.radius ?? 'md'],
    '--density-row': seeds.density === 'compact' ? '36px' : '44px',
    '--font-ui': FONT_STACKS[seeds.fontUi ?? 'ibm-plex-sans'] ?? FONT_STACKS.system!,
    '--font-code': '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  };

  const light: TokenSet = {
    ...shared,
    '--bg': lightBg,
    '--surface': lightSurface,
    '--surface-2': lightSurface2,
    '--border': lightBorder,
    '--text': lightText,
    '--text-muted': lightMuted,
    '--brand-primary': lightPrimary,
    '--brand-primary-foreground': bestForeground(lightPrimary),
    '--brand-primary-soft': tinted(hexToHsl(lightPrimary).h, 40, 93),
    '--brand-accent': lightAccent,
    '--brand-accent-foreground': bestForeground(lightAccent),
    '--success': SEMANTIC.light.success,
    '--success-soft': SEMANTIC.light.successSoft,
    '--warning': SEMANTIC.light.warning,
    '--warning-soft': SEMANTIC.light.warningSoft,
    '--danger': SEMANTIC.light.danger,
    '--danger-soft': SEMANTIC.light.dangerSoft,
    '--info': SEMANTIC.light.info,
    '--info-soft': SEMANTIC.light.infoSoft,
    '--ring': lightPrimary,
  };
  chartSeries(lightPrimary, 'light').forEach((c, i) => {
    light[`--chart-${i + 1}`] = c;
  });

  const dark: TokenSet = {
    ...shared,
    '--bg': darkBg,
    '--surface': darkSurface,
    '--surface-2': darkSurface2,
    '--border': darkBorder,
    '--text': darkText,
    '--text-muted': darkMuted,
    '--brand-primary': darkPrimary,
    '--brand-primary-foreground': bestForeground(darkPrimary),
    '--brand-primary-soft': tinted(hexToHsl(darkPrimary).h, 30, 20),
    '--brand-accent': darkAccent,
    '--brand-accent-foreground': bestForeground(darkAccent),
    '--success': SEMANTIC.dark.success,
    '--success-soft': SEMANTIC.dark.successSoft,
    '--warning': SEMANTIC.dark.warning,
    '--warning-soft': SEMANTIC.dark.warningSoft,
    '--danger': SEMANTIC.dark.danger,
    '--danger-soft': SEMANTIC.dark.dangerSoft,
    '--info': SEMANTIC.dark.info,
    '--info-soft': SEMANTIC.dark.infoSoft,
    '--ring': darkPrimary,
  };
  chartSeries(darkPrimary, 'dark').forEach((c, i) => {
    dark[`--chart-${i + 1}`] = c;
  });

  return { light, dark };
}

/**
 * Validates that the derived tokens meet WCAG AA: 4.5:1 for text on surfaces and on primary
 * buttons, 3:1 for the primary colour as a UI component against surfaces.
 */
export function validateTokens(tokens: ComputedTokens): BrandingIssue[] {
  const issues: BrandingIssue[] = [];
  const check = (
    scheme: 'light' | 'dark',
    a: string,
    b: string,
    required: number,
    token: string,
  ) => {
    const set = tokens[scheme];
    const ratio = contrastRatio(set[a]!, set[b]!);
    if (ratio < required) {
      issues.push({
        token: `${scheme}:${token}`,
        message: `${token} contrast ${ratio.toFixed(2)}:1 is below ${required}:1 in the ${scheme} theme`,
        ratio,
        required,
      });
    }
  };
  for (const scheme of ['light', 'dark'] as const) {
    check(scheme, '--text', '--bg', 4.5, 'text-on-background');
    check(scheme, '--text', '--surface', 4.5, 'text-on-surface');
    check(scheme, '--text-muted', '--surface', 4.5, 'muted-text-on-surface');
    check(scheme, '--brand-primary-foreground', '--brand-primary', 4.5, 'primary-button-text');
    check(scheme, '--brand-primary', '--surface', 3, 'primary-on-surface');
  }
  return issues;
}

/** Serialises a token set into a CSS declaration block body. */
export function tokensToCss(tokens: TokenSet): string {
  return Object.entries(tokens)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
}
