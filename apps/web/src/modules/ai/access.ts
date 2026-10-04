import { AI_MODULE_FLAG, type AiFeature, aiFeatureEnabled, type MeResponse } from '@lms/shared';

/** The permission each AI surface needs besides its flags (ADR-0031). */
const SURFACE_PERMISSION: Record<AiFeature, string> = {
  assistant: 'ai:chat',
  workspace: 'ai:chat',
  lab_hints: 'ai:hints',
  semantic_cache: 'ai:chat',
};

/**
 * Whether an SI Academy AI surface may be shown to this person: `module.ai`, the surface's own flag
 * and its permission, all three. The API decides again on every request; this only keeps the web
 * app from showing what the person cannot use.
 */
export function canUseAi(
  me: Pick<MeResponse, 'flags' | 'permissions'>,
  feature: AiFeature,
): boolean {
  return (
    aiFeatureEnabled(me.flags, feature) &&
    me.permissions.some((permission) => permission.key === SURFACE_PERMISSION[feature])
  );
}

/**
 * Whether one of SI Academy AI's management pages may be shown (Phase 7E): `module.ai` and the
 * page's permission — `ai:manage` for the settings (the Super Admin), `ai:usage_read` for usage.
 * The API refuses the same requests whatever the page shows.
 */
export function canSeeAiPage(
  me: Pick<MeResponse, 'flags' | 'permissions'>,
  permission: 'ai:manage' | 'ai:usage_read',
): boolean {
  return (
    me.flags[AI_MODULE_FLAG] === true &&
    me.permissions.some((granted) => granted.key === permission)
  );
}
