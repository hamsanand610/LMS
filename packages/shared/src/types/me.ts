import type { Portal } from '../constants.js';
import type { GrantedPermission } from '../permissions.js';
import type { EffectiveFlags } from '../schemas/flags.js';
import type { NavigationItem } from '../schemas/navigation.js';
import type { BrandingPublic } from '../schemas/branding.js';

/** Everything the web shell needs after sign-in, from GET /me. */
export interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    status: 'invited' | 'active' | 'suspended' | 'deactivated';
  };
  roles: { key: string; name: string }[];
  homePortal: Portal;
  portals: Portal[];
  permissions: GrantedPermission[];
  flags: EffectiveFlags;
  navigation: Record<Portal, NavigationItem[]>;
  branding: BrandingPublic;
  organization: { key: string; name: string; timezone: string; locale: string };
  /** Who the user is in terms of people records, so the shell can link to the right pages. */
  person: {
    studentId: string | null;
    studentCode: string | null;
    trainerId: string | null;
    /** Batches the user belongs to or teaches; empty for staff without either role. */
    batchIds: string[];
  };
  serverTime: string;
}
