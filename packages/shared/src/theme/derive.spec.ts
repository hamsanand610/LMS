import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToOklch } from './color.js';
import { deriveTokens, tokensToCss, validateTokens } from './derive.js';

const REQUIRED_TOKENS = [
  '--bg',
  '--surface',
  '--surface-2',
  '--surface-3',
  '--border',
  '--border-strong',
  '--text',
  '--text-secondary',
  '--text-muted',
  '--brand-primary',
  '--brand-primary-foreground',
  '--brand-primary-hover',
  '--brand-primary-text',
  '--brand-primary-soft',
  '--brand-primary-muted',
  '--brand-accent',
  '--success',
  '--warning',
  '--danger',
  '--info',
  '--streak',
  '--streak-soft',
  '--achievement',
  '--achievement-soft',
  '--focus',
  '--ring',
  '--nav-bg',
  '--nav-text',
  '--nav-accent',
  '--nav-active',
  '--nav-focus',
  '--radius',
  '--font-ui',
  '--chart-1',
  '--chart-6',
];

/** The demo institute's wine-burgundy (ADR-0013). */
const DEMO_PRIMARY = '#7F2331';

/** Brand colours a client is likely to pick, including hard ones (very light, very dark, saturated). */
const SAMPLE_PRIMARIES = [
  '#0B6E4F',
  '#1D4ED8',
  '#DC2626',
  '#F59E0B',
  '#FDE047',
  '#111111',
  '#FAFAFA',
  '#7C3AED',
  '#0EA5E9',
  '#22C55E',
];

describe('deriveTokens', () => {
  it('produces a complete token set for both colour schemes', () => {
    const tokens = deriveTokens({ primaryColor: '#0B6E4F' });
    for (const scheme of ['light', 'dark'] as const) {
      for (const key of REQUIRED_TOKENS)
        expect(tokens[scheme][key], `${scheme} ${key}`).toBeTruthy();
    }
  });

  it.each(SAMPLE_PRIMARIES)('meets the contrast requirements for primary %s', (primary) => {
    const tokens = deriveTokens({ primaryColor: primary });
    expect(validateTokens(tokens)).toEqual([]);
    for (const scheme of ['light', 'dark'] as const) {
      expect(
        contrastRatio(tokens[scheme]['--text']!, tokens[scheme]['--bg']!),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(
          tokens[scheme]['--brand-primary-foreground']!,
          tokens[scheme]['--brand-primary']!,
        ),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('maps radius and density seeds to CSS values and keeps semantic colours fixed', () => {
    const a = deriveTokens({ primaryColor: '#0B6E4F', radius: 'none', density: 'compact' });
    const b = deriveTokens({ primaryColor: '#DC2626', radius: 'lg', density: 'comfortable' });
    expect(a.light['--radius']).toBe('0px');
    expect(b.light['--radius']).toBe('12px');
    expect(a.light['--density-row']).toBe('36px');
    expect(b.light['--density-row']).toBe('44px');
    expect(a.light['--danger']).toBe(b.light['--danger']);
    expect(a.dark['--success']).toBe(b.dark['--success']);
  });

  it.each(SAMPLE_PRIMARIES)('keeps every text and control pairing readable for %s', (primary) => {
    const tokens = deriveTokens({ primaryColor: primary });
    for (const scheme of ['light', 'dark'] as const) {
      const t = tokens[scheme];
      for (const surface of ['--bg', '--surface', '--surface-2'])
        for (const ink of ['--text', '--text-secondary', '--text-muted', '--brand-primary-text'])
          expect(
            contrastRatio(t[ink]!, t[surface]!),
            `${scheme} ${ink} on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(t['--brand-primary-foreground']!, t['--brand-primary-hover']!),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(t['--brand-primary-text']!, t['--brand-primary-soft']!),
      ).toBeGreaterThanOrEqual(4.5);
      for (const ink of ['--nav-text', '--nav-muted', '--nav-accent'])
        expect(contrastRatio(t[ink]!, t['--nav-bg']!), `${scheme} ${ink}`).toBeGreaterThanOrEqual(
          4.5,
        );
      expect(contrastRatio(t['--nav-accent']!, t['--nav-active']!)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t['--focus']!, t['--bg']!)).toBeGreaterThanOrEqual(3);
      // Code is read on the ink plane: every syntax colour is text there.
      for (const ink of [
        '--code-comment',
        '--code-string',
        '--code-number',
        '--code-type',
        '--code-function',
        '--code-operator',
        '--code-invalid',
      ]) {
        expect(contrastRatio(t[ink]!, t['--nav-bg']!), `${scheme} ${ink}`).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(
          contrastRatio(t[ink]!, t['--nav-hover']!),
          `${scheme} ${ink} on the active line`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('gives neutrals the brand temperature but never the brand hue', () => {
    const red = deriveTokens({ primaryColor: '#DC2626' });
    const wine = deriveTokens({ primaryColor: DEMO_PRIMARY });
    const blue = deriveTokens({ primaryColor: '#1D4ED8' });
    for (const tokens of [red, wine]) {
      const bg = hexToOklch(tokens.light['--bg']!);
      // Ivory: a yellow-orange hue at very low chroma — not a pink tint of the red.
      expect(bg.h).toBeGreaterThan(55);
      expect(bg.h).toBeLessThan(100);
      expect(bg.c).toBeLessThan(0.015);
    }
    const slate = hexToOklch(blue.light['--bg']!);
    expect(slate.h).toBeGreaterThan(230);
    expect(slate.h).toBeLessThan(280);
    // Two red brands share one neutral ramp: the neutrals are the product's, not the brand's.
    expect(red.light['--surface']).toBe(wine.light['--surface']);
  });

  it('derives the documented demo palette', () => {
    const { light, dark } = deriveTokens({ primaryColor: DEMO_PRIMARY });
    // Ivory canvas, cream cards (not white), warm-beige insets (ADR-0015).
    expect(light).toMatchObject({
      '--bg': '#f5f0e8',
      '--surface': '#fcf9f4',
      '--surface-2': '#efeae1',
      '--text': '#271b17',
      '--text-muted': '#6c625d',
      '--brand-primary': '#7f2331',
      '--brand-primary-foreground': '#ffffff',
      '--nav-bg': '#191211',
      '--nav-active': '#381e20',
      '--focus': '#7f2331',
    });
    // Layered charcoal with a warm-red undertone; the rail one step deeper than the page.
    expect(dark).toMatchObject({
      '--bg': '#100b0b',
      '--surface': '#1b1413',
      '--surface-2': '#241c1b',
      '--text': '#efeae2',
      '--brand-primary': '#ad4d56',
      '--brand-primary-text': '#f0959b',
      '--nav-bg': '#0c0706',
      '--focus': '#f5b9bb',
    });
  });

  it('keeps the semantic families fixed, readable and apart from the brand', () => {
    const wine = deriveTokens({ primaryColor: DEMO_PRIMARY });
    const blue = deriveTokens({ primaryColor: '#1D4ED8' });
    for (const scheme of ['light', 'dark'] as const) {
      const t = wine[scheme];
      for (const family of ['success', 'warning', 'danger', 'info', 'streak', 'achievement']) {
        expect(t[`--${family}`]).toBe(blue[scheme][`--${family}`]);
        for (const surface of ['--bg', '--surface', '--surface-2', `--${family}-soft`])
          expect(
            contrastRatio(t[`--${family}`]!, t[surface]!),
            `${scheme} ${family} on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
      }
      // The error red is not the brand's red, and focus is never the error colour.
      expect(t['--danger']).not.toBe(t['--brand-primary']);
      expect(t['--focus']).not.toBe(t['--danger']);
    }
  });

  it('takes the focus ring and the active rail item from the brand', () => {
    const wine = deriveTokens({ primaryColor: DEMO_PRIMARY });
    const blue = deriveTokens({ primaryColor: '#1D4ED8' });
    expect(wine.light['--focus']).not.toBe(blue.light['--focus']);
    expect(hexToOklch(wine.light['--nav-active']!).h).toBeLessThan(40);
    expect(hexToOklch(blue.light['--nav-active']!).h).toBeGreaterThan(230);
    for (const tokens of [wine, blue])
      for (const scheme of ['light', 'dark'] as const) {
        const t = tokens[scheme];
        for (const surface of ['--bg', '--surface', '--surface-2'])
          expect(contrastRatio(t['--focus']!, t[surface]!)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(t['--nav-focus']!, t['--nav-bg']!)).toBeGreaterThanOrEqual(3);
      }
    // An achromatic brand keeps a neutral rail.
    const ink = deriveTokens({ primaryColor: '#111111' });
    expect(hexToOklch(ink.light['--nav-active']!).c).toBeLessThan(0.02);
  });

  it('keeps chart marks in the readable band with the brand in the first slot', () => {
    const { light, dark } = deriveTokens({ primaryColor: DEMO_PRIMARY });
    const brandHue = hexToOklch(DEMO_PRIMARY).h;
    for (const [set, [min, max]] of [
      [light, [0.43, 0.77]],
      [dark, [0.48, 0.67]],
    ] as const) {
      const hues: number[] = [];
      for (let i = 1; i <= 6; i += 1) {
        const colour = hexToOklch(set[`--chart-${i}`]!);
        expect(colour.l).toBeGreaterThanOrEqual(min);
        expect(colour.l).toBeLessThanOrEqual(max);
        expect(colour.c).toBeGreaterThanOrEqual(0.1);
        hues.push(colour.h);
      }
      const distance = (a: number, b: number) => {
        const d = Math.abs(a - b) % 360;
        return d > 180 ? 360 - d : d;
      };
      expect(distance(hues[0]!, brandHue)).toBeLessThan(5);
      // No other series reuses the brand's hue family.
      for (const hue of hues.slice(1)) expect(distance(hue, brandHue)).toBeGreaterThan(25);
    }
  });

  it('uses the accent colour when given and falls back to the primary otherwise', () => {
    const withAccent = deriveTokens({ primaryColor: '#0B6E4F', accentColor: '#DC2626' });
    const without = deriveTokens({ primaryColor: '#0B6E4F' });
    expect(withAccent.light['--brand-accent']).not.toBe(without.light['--brand-accent']);
    expect(without.light['--brand-accent']).toBe(without.light['--brand-primary']);
  });
});

describe('validateTokens', () => {
  it('reports every failing pair with the measured ratio', () => {
    const tokens = deriveTokens({ primaryColor: '#0B6E4F' });
    tokens.light['--text'] = tokens.light['--bg']!;
    tokens.dark['--brand-primary-foreground'] = tokens.dark['--brand-primary']!;
    const issues = validateTokens(tokens);
    expect(issues.map((i) => i.token)).toEqual(
      expect.arrayContaining(['light:text-on-background', 'dark:primary-button-text']),
    );
    for (const issue of issues) {
      expect(issue.ratio).toBeLessThan(issue.required);
      expect(issue.message).toMatch(/contrast/);
    }
  });
});

describe('tokensToCss', () => {
  it('serialises declarations in order', () => {
    expect(tokensToCss({ '--bg': '#fff', '--radius': '8px' })).toBe('--bg: #fff; --radius: 8px;');
  });
});
