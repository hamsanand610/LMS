import { z } from 'zod';
import { patchSchemaOf } from './common.js';

/** Audience restricts a flag to roles and/or batches; empty audience = everyone. */
/** Who a flag reaches when it is on: some roles, some batches, or (both empty) everyone. */
export const flagAudienceSchema = z.object({
  roleKeys: z.array(z.string().trim().min(2).max(64)).max(20).default([]),
  batchIds: z.array(z.uuid()).max(100).default([]),
});
export type FlagAudience = z.infer<typeof flagAudienceSchema>;

export const featureFlagSchema = z.object({
  key: z.string().min(1).max(80),
  description: z.string().max(240),
  enabled: z.boolean(),
  audience: flagAudienceSchema,
  /** Module flags gate an entire module (`module.<key>`); option flags gate behaviour within a module. */
  kind: z.enum(['module', 'option']),
  /** Flags that are always on cannot be toggled (core modules). */
  locked: z.boolean().default(false),
});
export type FeatureFlag = z.infer<typeof featureFlagSchema>;

export const featureFlagUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  // Without defaults: a patch naming roles only must leave the batches as they are (Phase 6).
  audience: patchSchemaOf(flagAudienceSchema).optional(),
});
export type FeatureFlagUpdate = z.infer<typeof featureFlagUpdateSchema>;

/** Effective flags for a user, as returned by GET /me (key → enabled). */
export type EffectiveFlags = Record<string, boolean>;

export function moduleFlagKey(moduleKey: string): string {
  return `module.${moduleKey}`;
}
