import type { ComputedTokens, TokenSet } from '../schemas/branding.js';
import {
  bestForeground,
  contrastRatio,
  ensureContrastOklch,
  hexToOklch,
  oklchToHex,
  type Oklch,
} from './color.js';

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
  'instrument-sans':
    '"Instrument Sans", ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  inter: 'Inter, ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
  manrope: 'Manrope, ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
  'source-sans-3': '"Source Sans 3", ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
  'noto-sans': '"Noto Sans", ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
};

type Triple = readonly [l: number, c: number, h: number];
const ok = ([l, c, h]: Triple): Oklch => ({ l, c, h });
const hex = (t: Triple): string => oklchToHex(ok(t));

interface NeutralRamp {
  bg: Triple;
  surface: Triple;
  surface2: Triple;
  surface3: Triple;
  border: Triple;
  borderStrong: Triple;
  text: Triple;
  text2: Triple;
  muted: Triple;
}
interface NavRamp {
  bg: Triple;
  hover: Triple;
  active: Triple;
  border: Triple;
  text: Triple;
  muted: Triple;
}

/**
 * Neutral ramps, in OKLCH (lightness, chroma, hue). Neutrals follow the brand's temperature, not
 * its hue (ADR-0013): tinting greys with a red brand's hue turns them pink, and none of the red
 * brands researched do it. `warm` is ivory paper with cream cards and warm-beige insets, and in the
 * dark a charcoal with a faint warm-red undertone, layered so canvas, card, inset and active state
 * read as separate planes (ADR-0015); `cool` is slate.
 * Each step was checked against WCAG AA in both schemes (see derive.spec.ts).
 */
const NEUTRALS: Record<
  'warm' | 'cool',
  { light: NeutralRamp; dark: NeutralRamp; nav: { light: NavRamp; dark: NavRamp } }
> = {
  warm: {
    light: {
      bg: [0.958, 0.012, 80],
      surface: [0.983, 0.008, 82],
      surface2: [0.938, 0.013, 78],
      surface3: [0.906, 0.014, 76],
      border: [0.884, 0.014, 76],
      borderStrong: [0.818, 0.016, 72],
      text: [0.235, 0.02, 40],
      text2: [0.405, 0.017, 45],
      muted: [0.505, 0.015, 52],
    },
    dark: {
      bg: [0.158, 0.009, 28],
      surface: [0.2, 0.011, 30],
      surface2: [0.236, 0.012, 32],
      surface3: [0.272, 0.013, 34],
      border: [0.285, 0.012, 34],
      borderStrong: [0.37, 0.013, 38],
      text: [0.938, 0.012, 80],
      text2: [0.82, 0.011, 70],
      muted: [0.69, 0.012, 60],
    },
    nav: {
      light: {
        bg: [0.19, 0.012, 26],
        hover: [0.235, 0.014, 28],
        active: [0.27, 0.014, 28],
        border: [0.255, 0.012, 30],
        text: [0.93, 0.01, 78],
        muted: [0.72, 0.012, 60],
      },
      dark: {
        bg: [0.135, 0.01, 26],
        hover: [0.18, 0.012, 28],
        active: [0.235, 0.014, 28],
        border: [0.2, 0.01, 28],
        text: [0.93, 0.01, 78],
        muted: [0.7, 0.012, 60],
      },
    },
  },
  cool: {
    light: {
      bg: [0.968, 0.006, 255],
      surface: [0.992, 0.003, 255],
      surface2: [0.947, 0.007, 255],
      surface3: [0.92, 0.009, 255],
      border: [0.893, 0.009, 255],
      borderStrong: [0.835, 0.011, 255],
      text: [0.245, 0.02, 262],
      text2: [0.415, 0.016, 258],
      muted: [0.515, 0.014, 255],
    },
    dark: {
      bg: [0.176, 0.008, 262],
      surface: [0.211, 0.009, 262],
      surface2: [0.251, 0.01, 262],
      surface3: [0.289, 0.011, 262],
      border: [0.305, 0.011, 262],
      borderStrong: [0.386, 0.012, 262],
      text: [0.936, 0.008, 255],
      text2: [0.82, 0.01, 255],
      muted: [0.7, 0.012, 255],
    },
    nav: {
      light: {
        bg: [0.204, 0.014, 262],
        hover: [0.255, 0.014, 262],
        active: [0.289, 0.015, 262],
        border: [0.276, 0.014, 262],
        text: [0.929, 0.008, 255],
        muted: [0.715, 0.012, 255],
      },
      dark: {
        bg: [0.151, 0.01, 262],
        hover: [0.199, 0.011, 262],
        active: [0.234, 0.012, 262],
        border: [0.225, 0.011, 262],
        text: [0.929, 0.008, 255],
        muted: [0.7, 0.012, 255],
      },
    },
  },
};

/**
 * Semantic colours are fixed and never overridden by brand colours (plan §16.4). Red and ink are the
 * brand; these hues carry information only (ADR-0015): emerald for the streak and for what is done,
 * champagne gold for achievement, amber for what needs attention soon, blue for information, and a
 * signal red for errors that is deliberately not the brand's wine. Every ink passes 4.5:1 on its soft
 * surface, the card, the inset and the page in its scheme.
 */
const SEMANTIC = {
  light: {
    success: '#17744a',
    successSoft: '#e0f2e7',
    warning: '#8a5a0f',
    warningSoft: '#fbedd0',
    danger: '#b3261e',
    dangerSoft: '#fce8e4',
    info: '#2e6293',
    infoSoft: '#e4eef9',
    streak: '#0d7350',
    streakSoft: '#dbf2e5',
    achievement: '#7a5b20',
    achievementSoft: '#f4e9d2',
  },
  dark: {
    success: '#5ccf95',
    successSoft: '#12291d',
    warning: '#ebb95e',
    warningSoft: '#33260f',
    danger: '#f58b77',
    dangerSoft: '#3f1c19',
    info: '#86b5e6',
    infoSoft: '#172a3c',
    streak: '#4fd69a',
    streakSoft: '#10281d',
    achievement: '#dcc08a',
    achievementSoft: '#2a2317',
  },
} as const;

/**
 * Syntax colours for code (ADR-0016). Code always sits on the ink plane (`--nav-bg`), which is dark
 * in both schemes, so one set serves both; every colour passes 4.5:1 on the plane for any brand.
 * Keywords take the brand's own light accent (`--nav-accent`), so the editor feels like the rest of
 * the product; the other hues only tell kinds of token apart.
 */
const CODE = {
  comment: '#9d958f',
  string: '#9fd8a8',
  number: '#e7c27d',
  type: '#8fc3ee',
  function: '#c8b6f5',
  operator: '#c9c1bb',
  invalid: '#f58b77',
} as const;

function codeTokens(): TokenSet {
  return {
    '--code-comment': CODE.comment,
    '--code-string': CODE.string,
    '--code-number': CODE.number,
    '--code-type': CODE.type,
    '--code-function': CODE.function,
    '--code-operator': CODE.operator,
    '--code-invalid': CODE.invalid,
  };
}

/**
 * Chart series after the first, validated as a set with a warm brand in slot 1: lightness band,
 * chroma floor, colour-vision separation and contrast all pass in both schemes. Slot 1 is the
 * brand's own hue; the hue of this list closest to the brand is dropped so two series never share
 * one. Every chart in the product today is single-series, so only slot 1 is on screen.
 */
const CHART_SERIES = {
  light: ['#a53746', '#3a75af', '#bc7d19', '#209993', '#814a8d', '#779243'],
  dark: ['#d3646b', '#5290cf', '#bf851e', '#169d97', '#9156a2', '#809b4c'],
} as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Achromatic brands take the warm paper, which is this template's default look. */
function temperatureOf(brand: Oklch): 'warm' | 'cool' {
  if (brand.c < 0.03) return 'warm';
  return brand.h < 115 || brand.h >= 325 ? 'warm' : 'cool';
}

function chartSeries(brand: Oklch, scheme: 'light' | 'dark'): string[] {
  const series: string[] = [...CHART_SERIES[scheme]];
  if (brand.c < 0.04) return series;
  const first = oklchToHex({
    l: scheme === 'light' ? 0.5 : 0.64,
    c: clamp(brand.c, 0.12, scheme === 'light' ? 0.15 : 0.14),
    h: brand.h,
  });
  let closest = 0;
  for (let i = 1; i < series.length; i += 1) {
    if (
      hueDistance(hexToOklch(series[i]!).h, brand.h) <
      hueDistance(hexToOklch(series[closest]!).h, brand.h)
    )
      closest = i;
  }
  series.splice(closest, 1);
  return [first, ...series].slice(0, 6);
}

interface BrandShades {
  base: string;
  foreground: string;
  hover: string;
  text: string;
  soft: string;
  muted: string;
}

/** Light scheme: the client's exact colour when it reads, darkened in OKLCH only when it must. */
function lightShades(seed: Oklch, n: NeutralRamp): BrandShades {
  const surface = hex(n.surface);
  const surface2 = hex(n.surface2);
  const base = ensureContrastOklch(seed, surface, 3);
  const baseHex = oklchToHex(base);
  const foreground = bestForeground(baseHex, '#ffffff', hex(n.text));
  const hoverDown = oklchToHex({ ...base, l: Math.max(0.12, base.l - 0.045) });
  const hover =
    contrastRatio(foreground, hoverDown) >= 4.5
      ? hoverDown
      : oklchToHex({ ...base, l: Math.min(0.95, base.l + 0.045) });
  const soft = oklchToHex({ l: 0.95, c: Math.min(base.c * 0.18, 0.024), h: base.h });
  const text = oklchToHex(ensureContrastOklch(ensureContrastOklch(base, surface2, 4.5), soft, 4.5));
  return {
    base: baseHex,
    foreground,
    hover,
    text,
    soft,
    muted: oklchToHex({ l: 0.86, c: Math.min(base.c * 0.4, 0.05), h: base.h }),
  };
}

/**
 * Dark scheme: lifted into a range that reads on graphite and capped in chroma, so a brand red is a
 * refined accent rather than a warning light. Never an inversion of the light scheme.
 */
function darkShades(seed: Oklch, n: NeutralRamp): BrandShades {
  const surface = hex(n.surface);
  const surface2 = hex(n.surface2);
  const base = ensureContrastOklch(
    { l: clamp(seed.l, 0.545, 0.64), c: Math.min(seed.c, 0.15), h: seed.h },
    surface,
    3,
  );
  const baseHex = oklchToHex(base);
  const foreground = bestForeground(baseHex, '#ffffff', hex(n.bg));
  const hoverUp = oklchToHex({ ...base, l: Math.min(0.9, base.l + 0.03) });
  const hover =
    contrastRatio(foreground, hoverUp) >= 4.5
      ? hoverUp
      : oklchToHex({ ...base, l: Math.max(0.2, base.l - 0.04) });
  const soft = oklchToHex({ l: 0.285, c: Math.min(seed.c * 0.36, 0.046), h: seed.h });
  const text = oklchToHex(
    ensureContrastOklch(
      ensureContrastOklch(
        { l: Math.max(seed.l, 0.765), c: Math.min(seed.c, 0.11), h: seed.h },
        surface2,
        4.5,
      ),
      soft,
      4.5,
    ),
  );
  return {
    base: baseHex,
    foreground,
    hover,
    text,
    soft,
    muted: oklchToHex({ l: 0.42, c: Math.min(seed.c * 0.64, 0.08), h: seed.h }),
  };
}

/**
 * Keyboard focus takes the brand (ADR-0015, reversing ADR-0013's blue): the brand's own shade on the
 * light theme, a pale tint of its hue on dark planes. It is told apart from an error by shape — a
 * crisp offset outline, where an invalid field has a border and a soft ring — and by the danger red,
 * which is never the brand's.
 */
function focusColour(
  scheme: 'light' | 'dark',
  primary: BrandShades,
  seed: Oklch,
  n: NeutralRamp,
): string {
  const paleTint = (against: string) =>
    oklchToHex(ensureContrastOklch({ l: 0.84, c: Math.min(seed.c, 0.07), h: seed.h }, against, 3));
  if (scheme === 'dark') return paleTint(hex(n.surface3));
  // The darkest light surface is the inset: 3:1 there holds on the page and on cards as well.
  return oklchToHex(ensureContrastOklch(hexToOklch(primary.base), hex(n.surface2), 3));
}

function navTokens(nav: NavRamp, accentSource: Oklch): TokenSet {
  const bg = hex(nav.bg);
  // "You are here" is the one neutral that takes the brand's hue: a deep tint, never a red block.
  // An achromatic brand keeps the ramp's neutral step.
  const active =
    accentSource.c < 0.03
      ? hex(nav.active)
      : oklchToHex({
          l: nav.active[0],
          c: Math.min(accentSource.c * 0.32, 0.045),
          h: accentSource.h,
        });
  const focus = oklchToHex(
    ensureContrastOklch(
      { l: 0.84, c: Math.min(accentSource.c, 0.07), h: accentSource.h },
      active,
      3,
    ),
  );
  const accent = ensureContrastOklch(
    ensureContrastOklch(
      { l: Math.max(accentSource.l, 0.765), c: Math.min(accentSource.c, 0.11), h: accentSource.h },
      bg,
      4.5,
    ),
    active,
    4.5,
  );
  return {
    '--nav-bg': bg,
    '--nav-hover': hex(nav.hover),
    '--nav-active': active,
    '--nav-border': hex(nav.border),
    '--nav-text': hex(nav.text),
    '--nav-muted': hex(nav.muted),
    '--nav-accent': oklchToHex(accent),
    '--nav-focus': focus,
  };
}

function neutralTokens(n: NeutralRamp): TokenSet {
  return {
    '--bg': hex(n.bg),
    '--surface': hex(n.surface),
    '--surface-2': hex(n.surface2),
    '--surface-3': hex(n.surface3),
    '--border': hex(n.border),
    '--border-strong': hex(n.borderStrong),
    '--text': hex(n.text),
    '--text-secondary': hex(n.text2),
    '--text-muted': hex(n.muted),
  };
}

function schemeTokens(
  scheme: 'light' | 'dark',
  n: NeutralRamp,
  nav: NavRamp,
  primary: BrandShades,
  accent: BrandShades,
  primarySeed: Oklch,
): TokenSet {
  const s = SEMANTIC[scheme];
  const focus = focusColour(scheme, primary, primarySeed, n);
  const tokens: TokenSet = {
    ...neutralTokens(n),
    '--brand-primary': primary.base,
    '--brand-primary-foreground': primary.foreground,
    '--brand-primary-hover': primary.hover,
    '--brand-primary-text': primary.text,
    '--brand-primary-soft': primary.soft,
    '--brand-primary-muted': primary.muted,
    '--brand-accent': accent.base,
    '--brand-accent-foreground': accent.foreground,
    '--success': s.success,
    '--success-soft': s.successSoft,
    '--warning': s.warning,
    '--warning-soft': s.warningSoft,
    '--danger': s.danger,
    '--danger-soft': s.dangerSoft,
    '--info': s.info,
    '--info-soft': s.infoSoft,
    '--streak': s.streak,
    '--streak-soft': s.streakSoft,
    '--achievement': s.achievement,
    '--achievement-soft': s.achievementSoft,
    '--focus': focus,
    '--ring': focus,
    ...navTokens(nav, primarySeed),
    ...codeTokens(),
  };
  chartSeries(primarySeed, scheme).forEach((colour, i) => {
    tokens[`--chart-${i + 1}`] = colour;
  });
  return tokens;
}

/**
 * Derives the complete token set for both colour schemes from the brand seeds (ADR-0013).
 * Neutrals follow the brand's temperature; brand shades are computed in OKLCH so a colour keeps its
 * hue when it is lightened or darkened; every text and control pairing is brought to WCAG AA.
 */
export function deriveTokens(seeds: TokenSeeds): ComputedTokens {
  const primarySeed = hexToOklch(seeds.primaryColor.toLowerCase());
  const accentSeed = hexToOklch((seeds.accentColor ?? seeds.primaryColor).toLowerCase());
  const ramps = NEUTRALS[temperatureOf(primarySeed)];

  const shared: TokenSet = {
    '--radius': RADIUS_PX[seeds.radius ?? 'md'],
    '--density-row': seeds.density === 'compact' ? '36px' : '44px',
    '--font-ui': FONT_STACKS[seeds.fontUi ?? 'ibm-plex-sans'] ?? FONT_STACKS.system!,
    '--font-code': '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  };

  const light: TokenSet = {
    ...shared,
    ...schemeTokens(
      'light',
      ramps.light,
      ramps.nav.light,
      lightShades(primarySeed, ramps.light),
      lightShades(accentSeed, ramps.light),
      primarySeed,
    ),
  };
  const dark: TokenSet = {
    ...shared,
    ...schemeTokens(
      'dark',
      ramps.dark,
      ramps.nav.dark,
      darkShades(primarySeed, ramps.dark),
      darkShades(accentSeed, ramps.dark),
      primarySeed,
    ),
  };
  return { light, dark };
}

/**
 * Validates that the derived tokens meet WCAG AA: 4.5:1 for text on surfaces and on primary
 * buttons, 3:1 for the primary colour as a UI component against surfaces. Pairs a token set does
 * not carry (an older stored set) are skipped rather than reported.
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
    if (!set[a] || !set[b]) return;
    const ratio = contrastRatio(set[a], set[b]);
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
    check(scheme, '--brand-primary-text', '--surface', 4.5, 'primary-text-on-surface');
    check(scheme, '--nav-text', '--nav-bg', 4.5, 'navigation-text');
    check(scheme, '--nav-accent', '--nav-bg', 4.5, 'navigation-active');
    check(scheme, '--nav-accent', '--nav-active', 4.5, 'navigation-active-item');
    check(scheme, '--nav-focus', '--nav-bg', 3, 'navigation-focus');
    for (const surface of ['--bg', '--surface', '--surface-2'])
      check(scheme, '--focus', surface, 3, `focus-on-${surface.slice(2)}`);
    for (const family of ['success', 'warning', 'danger', 'info', 'streak', 'achievement']) {
      check(scheme, `--${family}`, '--surface', 4.5, `${family}-on-surface`);
      check(scheme, `--${family}`, `--${family}-soft`, 4.5, `${family}-on-soft`);
    }
  }
  return issues;
}

/** Serialises a token set into a CSS declaration block body. */
export function tokensToCss(tokens: TokenSet): string {
  return Object.entries(tokens)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
}
