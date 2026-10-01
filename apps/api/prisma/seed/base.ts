/**
 * Base seed: organisation, permission catalogue, system roles, settings, branding, flags and navigation.
 * Idempotent — safe to run repeatedly. Client values come from clients/<CLIENT_KEY>/*.json when present.
 *
 *   pnpm --filter @lms/api db:seed      (or: pnpm db:seed from the repository root)
 */
import {
  DEFAULT_TERMS,
  TAXONOMY_KEYS,
  brandingSeedsSchema,
  deriveTokens,
  moduleFlagKey,
  validateTokens,
} from '@lms/shared';
import { MODULE_MANIFESTS } from '../../src/modules/manifests.js';
import { syncPermissionCatalogue, syncSystemRoles } from '../../src/modules/rbac/sync.js';
import { loadOverlay } from '../../src/overlay/overlay.js';
import { createSeedContext } from './client.js';
import { seedLoginBackground } from './seed-brand-assets.js';

async function main(): Promise<void> {
  const { config, prisma } = createSeedContext();
  const { path, overlay } = loadOverlay(config.CLIENT_KEY);
  console.log(`Seeding base data for client "${config.CLIENT_KEY}" (overlay: ${path})`);

  const general = overlay.settings?.general ?? {};
  const instituteName = general.instituteName ?? 'Your institute';
  const organization = await prisma.organization.upsert({
    where: { key: config.CLIENT_KEY },
    create: {
      key: config.CLIENT_KEY,
      name: instituteName,
      timezone: general.timezone ?? 'Asia/Kolkata',
      locale: general.locale ?? 'en-IN',
    },
    update: {},
  });
  console.log(`- organisation ${organization.name} (${organization.id})`);

  const permissionCount = await syncPermissionCatalogue(prisma, MODULE_MANIFESTS);
  await syncSystemRoles(prisma, organization.id);
  console.log(`- ${permissionCount} permissions, system roles synced`);

  // Settings sections from the overlay (only create when absent; runtime edits win).
  for (const section of ['general', 'academic', 'legal'] as const) {
    const value = overlay.settings?.[section];
    if (!value) continue;
    await prisma.setting.upsert({
      where: { organizationId_key: { organizationId: organization.id, key: section } },
      create: { organizationId: organization.id, key: section, value },
      update: {},
    });
  }

  // Branding: overlay seeds merged over defaults; tokens derived and contrast-checked.
  const seeds = brandingSeedsSchema.parse({
    brandName: instituteName,
    primaryColor: '#7F2331',
    ...(overlay.branding ?? {}),
  });
  const tokens = deriveTokens(seeds);
  const issues = validateTokens(tokens);
  if (issues.length) {
    throw new Error(
      `Overlay branding fails contrast checks:\n${issues.map((i) => `  - ${i.message}`).join('\n')}`,
    );
  }
  await prisma.brandingSettings.upsert({
    where: { organizationId: organization.id },
    create: { organizationId: organization.id, seeds, computedTokens: tokens, version: 1 },
    update: {},
  });
  console.log(`- branding "${seeds.brandName}" (${seeds.primaryColor})`);
  const background = await seedLoginBackground({
    config,
    prisma,
    organization,
    overlayPath: path,
  });
  console.log(`- ${background}`);

  // Flags: manifest defaults, then overlay overrides (module flags of non-core modules default on).
  for (const manifest of MODULE_MANIFESTS) {
    const declared = [...manifest.flags];
    if (!manifest.core && !declared.some((f) => f.key === moduleFlagKey(manifest.key))) {
      declared.push({
        key: moduleFlagKey(manifest.key),
        description: `Enable the ${manifest.name} module`,
        default: true,
        kind: 'module',
      });
    }
    for (const flag of declared) {
      const override = overlay.flags?.[flag.key];
      await prisma.featureFlag.upsert({
        where: { organizationId_key: { organizationId: organization.id, key: flag.key } },
        create: {
          organizationId: organization.id,
          key: flag.key,
          description: flag.description,
          enabled: override ?? flag.default,
          kind: flag.kind,
          locked: flag.locked ?? false,
        },
        update: { description: flag.description, kind: flag.kind, locked: flag.locked ?? false },
      });
    }
  }

  // Curated vocabularies: the terms a client starts with, never overwriting an edited one.
  let terms = 0;
  for (const taxonomy of TAXONOMY_KEYS) {
    for (const [position, term] of DEFAULT_TERMS[taxonomy].entries()) {
      await prisma.taxonomyTerm.upsert({
        where: {
          organizationId_taxonomy_key: {
            organizationId: organization.id,
            taxonomy,
            key: term.key,
          },
        },
        create: {
          organizationId: organization.id,
          taxonomy,
          key: term.key,
          label: term.label,
          position,
        },
        update: {},
      });
      terms += 1;
    }
  }
  console.log(`- ${terms} taxonomy terms ensured`);

  // Navigation overrides from the overlay (create only).
  for (const [portal, items] of Object.entries(overlay.navigation ?? {})) {
    await prisma.navigationConfig.upsert({
      where: { organizationId_portal: { organizationId: organization.id, portal } },
      create: { organizationId: organization.id, portal, items },
      update: {},
    });
  }

  await prisma.$disconnect();
  console.log('Base seed complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
