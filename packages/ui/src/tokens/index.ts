// Token derivation lives in @lms/shared (pure TypeScript, usable by the API);
// the UI package re-exports it for convenience.
export {
  deriveTokens,
  validateTokens,
  tokensToCss,
  contrastRatio,
  bestForeground,
  ensureContrast,
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
} from '@lms/shared';
export type { TokenSeeds, TokenSet, ComputedTokens, BrandingIssue } from '@lms/shared';
