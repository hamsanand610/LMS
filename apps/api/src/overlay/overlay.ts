import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import {
  brandingSeedsSchema,
  navigationOverrideSchema,
  PORTALS,
  settingsUpdateSchema,
} from '@lms/shared';

/** Files a client overlay may provide under clients/<key>/. All optional; all validated. */
export const overlaySchema = z.object({
  branding: brandingSeedsSchema.partial().optional(),
  settings: settingsUpdateSchema.optional(),
  flags: z.record(z.string(), z.boolean()).optional(),
  navigation: z.record(z.enum(PORTALS), z.array(navigationOverrideSchema)).optional(),
});
export type ClientOverlay = z.infer<typeof overlaySchema>;

/** Finds the monorepo root (the directory containing pnpm-workspace.yaml). */
export function findRepoRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Loads and validates clients/<key>/{branding,settings,flags,navigation}.json when present. */
export function loadOverlay(
  clientKey: string,
  repoRoot = findRepoRoot(),
): { path: string; overlay: ClientOverlay } {
  const path = resolve(repoRoot, 'clients', clientKey);
  const raw: Record<string, unknown> = {};
  for (const name of ['branding', 'settings', 'flags', 'navigation'] as const) {
    const file = resolve(path, `${name}.json`);
    if (existsSync(file)) raw[name] = readJson(file);
  }
  const result = overlaySchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Client overlay "${clientKey}" is invalid:\n${lines.join('\n')}`);
  }
  return { path, overlay: result.data };
}
