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

/** OKLCH: perceptual lightness (0–1), chroma (0–~0.37) and hue (degrees). */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const fromLinear = (v: number) =>
  (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255;

export function hexToOklch(hex: string): Oklch {
  const { r, g, b } = hexToRgb(hex);
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

/** Linear sRGB for an OKLCH colour, possibly outside the 0–1 gamut. */
function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l3 = Math.pow(l + 0.3963377774 * A + 0.2158037573 * B, 3);
  const m3 = Math.pow(l - 0.1055613458 * A - 0.0638541728 * B, 3);
  const s3 = Math.pow(l - 0.0894841775 * A - 1.291485548 * B, 3);
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

/**
 * OKLCH → hex. A colour outside sRGB keeps its lightness and hue and loses chroma until it fits,
 * which is what a person would expect from "the same colour, lighter" — clipping the channels
 * instead would shift the hue.
 */
export function oklchToHex(color: Oklch): string {
  const inGamut = (rgb: [number, number, number]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  let rgb = oklchToLinear(color);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = color.c;
    for (let i = 0; i < 16; i += 1) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ ...color, c: mid }))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinear({ ...color, c: lo });
  }
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return rgbToHex({
    r: fromLinear(clamp(rgb[0])),
    g: fromLinear(clamp(rgb[1])),
    b: fromLinear(clamp(rgb[2])),
  });
}

/**
 * Moves an OKLCH colour's lightness, keeping hue and chroma, until it reaches `minRatio` against
 * `againstHex` — darker on a light background, lighter on a dark one.
 */
export function ensureContrastOklch(
  color: Oklch,
  againstHex: string,
  minRatio: number,
  step = 0.01,
): Oklch {
  const bgIsDark = relativeLuminance(hexToRgb(againstHex)) < 0.18;
  let current = { ...color };
  for (let i = 0; i < 100; i += 1) {
    if (contrastRatio(oklchToHex(current), againstHex) >= minRatio) return current;
    const l = bgIsDark ? current.l + step : current.l - step;
    if (l <= 0 || l >= 1) break;
    current = { ...current, l };
  }
  return current;
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
