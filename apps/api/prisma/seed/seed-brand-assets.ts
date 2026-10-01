/**
 * Brand assets a client overlay ships as files (ADR-0015): today, the sign-in photograph at
 * clients/<key>/assets/login-background.{webp,jpg,jpeg,png}. It is uploaded through the storage
 * driver into the `branding-background` context and set as the login background — only while none
 * is set, so an administrator's own upload always wins. Idempotent: the object key is derived from
 * the file's content, and a missing or unreachable store skips the step without failing the seed.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brandingSeedsSchema } from '@lms/shared';
import type { AppConfig } from '../../src/core/config/env.js';
import { S3StorageDriver } from '../../src/core/storage/s3.driver.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

const BACKGROUND_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/** Matches the `branding-background` upload context (modules/files/contexts.ts). */
const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024;

function findBackground(overlayPath: string): { path: string; ext: string } | null {
  for (const ext of Object.keys(BACKGROUND_TYPES)) {
    const path = resolve(overlayPath, 'assets', `login-background.${ext}`);
    if (existsSync(path)) return { path, ext };
  }
  return null;
}

export async function seedLoginBackground(options: {
  config: AppConfig;
  prisma: PrismaClient;
  organization: { id: string; key: string };
  overlayPath: string;
}): Promise<string> {
  const { config, prisma, organization, overlayPath } = options;
  const asset = findBackground(overlayPath);
  if (!asset) return 'no sign-in photograph in the overlay';

  const row = await prisma.brandingSettings.findUnique({
    where: { organizationId: organization.id },
  });
  if (!row) return 'skipped: branding is not seeded';
  const seeds = brandingSeedsSchema.parse(row.seeds);
  if (seeds.login.backgroundFileId) return 'kept the sign-in background already set';
  if (!config.S3_ENDPOINT && !config.S3_ACCESS_KEY) return 'skipped: storage is not configured';

  const body = readFileSync(asset.path);
  if (body.byteLength > MAX_BACKGROUND_BYTES) return 'skipped: the photograph is larger than 5 MB';
  const checksum = createHash('sha256').update(body).digest('hex');
  const mime = BACKGROUND_TYPES[asset.ext]!;
  const storage = new S3StorageDriver(config);
  const bucket = storage.bucketName('public');
  const key = `${organization.key}/branding-background/login-background-${checksum.slice(0, 12)}.${asset.ext}`;

  try {
    await storage.put('public', key, new Uint8Array(body), mime);
  } catch (error) {
    return `skipped: storage is unreachable (${(error as Error).message})`;
  }

  const file = await prisma.file.upsert({
    where: { bucket_key: { bucket, key } },
    create: {
      organizationId: organization.id,
      ownerType: 'branding-background',
      driver: storage.name,
      bucket,
      key,
      originalName: `login-background.${asset.ext}`,
      mime,
      size: body.byteLength,
      checksum,
      visibility: 'public',
      status: 'ready',
    },
    update: { status: 'ready', size: body.byteLength, checksum },
  });
  const updated = brandingSeedsSchema.parse({
    ...seeds,
    login: { ...seeds.login, backgroundFileId: file.id },
  });
  await prisma.brandingSettings.update({
    where: { organizationId: organization.id },
    data: { seeds: updated, version: { increment: 1 } },
  });
  return `sign-in photograph uploaded (${Math.round(body.byteLength / 1024)} KB)`;
}
