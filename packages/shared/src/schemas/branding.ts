import { z } from 'zod';
import { hexColorSchema } from './common.js';

/** Fonts the template can load without licensing work. Clients may add self-hosted fonts later. */
export const BRANDING_FONTS = [
  'system',
  'ibm-plex-sans',
  'inter',
  'manrope',
  'source-sans-3',
  'noto-sans',
] as const;
export const LOGIN_LAYOUTS = ['split', 'centered'] as const;
export const DENSITIES = ['comfortable', 'compact'] as const;
export const RADII = ['none', 'sm', 'md', 'lg'] as const;

/** Seed values a client edits. Everything visual derives from these. */
export const brandingSeedsSchema = z.object({
  brandName: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(120).default(''),
  logoLightFileId: z.string().nullable().default(null),
  logoDarkFileId: z.string().nullable().default(null),
  faviconFileId: z.string().nullable().default(null),
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema.nullable().default(null),
  fontUi: z.enum(BRANDING_FONTS).default('ibm-plex-sans'),
  radius: z.enum(RADII).default('md'),
  density: z.enum(DENSITIES).default('comfortable'),
  login: z
    .object({
      layout: z.enum(LOGIN_LAYOUTS).default('split'),
      welcomeTitle: z.string().trim().max(80).default('Welcome back'),
      welcomeText: z.string().trim().max(240).default(''),
      backgroundFileId: z.string().nullable().default(null),
    })
    .default({
      layout: 'split',
      welcomeTitle: 'Welcome back',
      welcomeText: '',
      backgroundFileId: null,
    }),
  dashboard: z
    .object({
      welcomeText: z.string().trim().max(160).default(''),
    })
    .default({ welcomeText: '' }),
  email: z
    .object({
      footerText: z.string().trim().max(240).default(''),
      supportEmail: z.email().nullable().default(null),
    })
    .default({ footerText: '', supportEmail: null }),
});
export type BrandingSeeds = z.infer<typeof brandingSeedsSchema>;

/** Partial update accepted by PATCH /branding. */
export const brandingUpdateSchema = brandingSeedsSchema.partial();
export type BrandingUpdate = z.infer<typeof brandingUpdateSchema>;

/** CSS variable name → value, for one colour scheme. */
export type TokenSet = Record<string, string>;

/** Type alias (not interface) so it satisfies JSON column input types structurally. */
export type ComputedTokens = {
  light: TokenSet;
  dark: TokenSet;
};

export interface BrandingPublic {
  brandName: string;
  tagline: string;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  fontUi: (typeof BRANDING_FONTS)[number];
  radius: (typeof RADII)[number];
  density: (typeof DENSITIES)[number];
  login: BrandingSeeds['login'] & { backgroundUrl: string | null };
  dashboard: BrandingSeeds['dashboard'];
  tokens: ComputedTokens;
  version: number;
}
