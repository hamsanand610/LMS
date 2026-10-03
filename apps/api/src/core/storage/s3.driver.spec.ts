import { describe, expect, it } from 'vitest';
import { envSchema } from '../config/env.js';
import { AppError } from '../http/errors.js';
import { S3StorageDriver } from './s3.driver.js';

/** Signing is local arithmetic: no store is contacted by these tests. */
function driver(overrides: Record<string, string>) {
  return new S3StorageDriver(
    envSchema.parse({
      DATABASE_URL: 'postgresql://user:secret@localhost:5432/db',
      JWT_ACCESS_SECRET: 'x'.repeat(40),
      S3_ACCESS_KEY: 'access-key',
      S3_SECRET_KEY: 'secret-key-secret-key',
      S3_FORCE_PATH_STYLE: 'true',
      ...overrides,
    }),
  );
}

describe('S3StorageDriver links (Phase 6)', () => {
  it('signs against the internal endpoint locally, where the browser reaches it', async () => {
    const local = driver({ APP_ENV: 'local', S3_ENDPOINT: 'http://localhost:9000' });
    expect(await local.presignDownload('private', 'demo/file.pdf', 60)).toMatch(
      /^http:\/\/localhost:9000\/lms-private\/demo\/file\.pdf\?/,
    );
  });

  it('never hands a browser a link naming an internal container host', async () => {
    const staging = driver({ APP_ENV: 'staging', S3_ENDPOINT: 'http://minio:9000' });
    const refused = await staging.presignDownload('private', 'demo/file.pdf', 60).catch((e) => e);
    expect(refused).toBeInstanceOf(AppError);
    expect((refused as AppError).status).toBe(503);
    expect((refused as AppError).code).toBe('storage_not_public');
    await expect(
      staging.presignUpload('private', 'demo/file.pdf', 'application/pdf', 10, 60),
    ).rejects.toMatchObject({ code: 'storage_not_public' });
  });

  it('signs for the public address when one is configured, and talks to the store inside', async () => {
    const staging = driver({
      APP_ENV: 'staging',
      S3_ENDPOINT: 'http://minio:9000',
      S3_PRESIGN_ENDPOINT: 'https://files.example.com',
    });
    const download = await staging.presignDownload('private', 'demo/file.pdf', 60);
    expect(download).toMatch(/^https:\/\/files\.example\.com\/lms-private\/demo\/file\.pdf\?/);
    expect(download).not.toContain('minio');
    const upload = await staging.presignUpload('public', 'demo/logo.png', 'image/png', 10, 60);
    expect(upload.url).toMatch(/^https:\/\/files\.example\.com\/lms-public\/demo\/logo\.png\?/);
  });

  it('links public files through the configured public address', () => {
    const staging = driver({
      APP_ENV: 'staging',
      S3_ENDPOINT: 'http://minio:9000',
      S3_PUBLIC_BASE_URL: 'https://lms.example.com/files/lms-public',
    });
    expect(staging.publicUrl('demo/logo.png')).toBe(
      'https://lms.example.com/files/lms-public/demo/logo.png',
    );
  });
});
