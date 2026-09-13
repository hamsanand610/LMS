import { describe, expect, it } from 'vitest';
import { contrastRatio } from './color.js';
import { deriveTokens, tokensToCss, validateTokens } from './derive.js';

const REQUIRED_TOKENS = [
  '--bg',
  '--surface',
  '--surface-2',
  '--border',
  '--text',
  '--text-muted',
  '--brand-primary',
  '--brand-primary-foreground',
  '--brand-primary-soft',
  '--brand-accent',
  '--success',
  '--warning',
  '--danger',
  '--info',
  '--ring',
  '--radius',
  '--font-ui',
  '--chart-1',
  '--chart-6',
];

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
