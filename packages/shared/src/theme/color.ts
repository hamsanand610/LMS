/** Small, dependency-free colour utilities (sRGB hex ↔ RGB ↔ HSL, WCAG contrast). */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number; // 0–360
  s: number; // 0–100
  l: number; // 0–100
}

const HEX6 = /^#?([0-9a-f]{6})$/i;

export function hexToRgb(hex: string): Rgb {
  const m = HEX6.exec(hex.trim());
  if (!m || !m[1]) throw new Error(`Invalid hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  const hn = (((h % 360) + 360) % 360) / 360;
  if (sn === 0) {
    const v = ln * 255;
    return { r: v, g: v, b: v };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return { r: channel(hn + 1 / 3) * 255, g: channel(hn) * 255, b: channel(hn - 1 / 3) * 255 };
}

export function hexToHsl(hex: string): Hsl {
  return rgbToHsl(hexToRgb(hex));
}

export function hslToHex(hsl: Hsl): string {
  return rgbToHex(hslToRgb(hsl));
}

/** WCAG 2.x relative luminance of an sRGB colour. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two hex colours (1–21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexToRgb(hexA));
  const lb = relativeLuminance(hexToRgb(hexB));
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** Returns the foreground (white or near-black) with the better contrast on the given background. */
export function bestForeground(backgroundHex: string, light = '#ffffff', dark = '#111827'): string {
  return contrastRatio(backgroundHex, light) >= contrastRatio(backgroundHex, dark) ? light : dark;
}

/**
 * Adjusts lightness of `hex` in steps until it reaches `minRatio` against `againstHex`,
 * moving away from the background's luminance. Returns the original if already sufficient.
 */
export function ensureContrast(
  hex: string,
  againstHex: string,
  minRatio: number,
  step = 2,
): string {
  if (contrastRatio(hex, againstHex) >= minRatio) return hex;
  const bgIsDark = relativeLuminance(hexToRgb(againstHex)) < 0.5;
  const hsl = hexToHsl(hex);
  for (let i = 0; i < 50; i += 1) {
    hsl.l = bgIsDark ? Math.min(100, hsl.l + step) : Math.max(0, hsl.l - step);
    const candidate = hslToHex(hsl);
    if (contrastRatio(candidate, againstHex) >= minRatio) return candidate;
    if (hsl.l === 0 || hsl.l === 100) break;
  }
  return hslToHex(hsl);
}
