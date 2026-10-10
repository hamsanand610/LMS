import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type AppConfig, isBrowserFacingUrl } from '../config/env.js';
import { AppError } from '../http/errors.js';
import type { Bucket, PresignedUpload, StorageDriver, StoredObjectInfo } from './storage.driver.js';

/** Works with MinIO (local), Cloudflare R2 (staging) and AWS S3 (production). */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3';
  private readonly client: S3Client;
  /**
   * Signs the links browsers follow, against the address browsers use (Phase 6). The same keys sign
   * for both; only the host in the signature differs from the one the API itself talks to.
   */
  private readonly signer: S3Client;
  private readonly signingEndpoint: string;

  constructor(private readonly config: AppConfig) {
    const base = {
      region: config.S3_REGION,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
    };
    this.client = new S3Client({ ...base, endpoint: config.S3_ENDPOINT || undefined });
    this.signingEndpoint = config.S3_PRESIGN_ENDPOINT || config.S3_ENDPOINT;
    this.signer = config.S3_PRESIGN_ENDPOINT
      ? new S3Client({ ...base, endpoint: config.S3_PRESIGN_ENDPOINT })
      : this.client;
  }

  /**
   * Outside local, a link naming a host browsers cannot reach — an internal container address —
   * is refused rather than handed to a browser (Phase 6). An empty endpoint means the provider's
   * own public one (AWS S3), which is fine.
   */
  private assertSigningHostIsPublic(): void {
    if (this.config.APP_ENV === 'local' || !this.signingEndpoint) return;
    if (!isBrowserFacingUrl(this.signingEndpoint)) {
      throw new AppError(
        503,
        'storage_not_public',
        'File links unavailable',
        'File storage has no public address configured (S3_PRESIGN_ENDPOINT).',
      );
    }
  }

  bucketName(bucket: Bucket): string {
    return bucket === 'public' ? this.config.S3_BUCKET_PUBLIC : this.config.S3_BUCKET_PRIVATE;
  }

  async presignUpload(
    bucket: Bucket,
    key: string,
    mime: string,
    size: number,
    expiresSeconds = 900,
  ): Promise<PresignedUpload> {
    // Content-Length is part of the signature: a body of any other size is refused by the store.
    // So is Content-Type, which the presigner leaves out unless told (Step 6 audit): otherwise a
    // signed-in person could store any type, a web page among them, under the institute's address.
    const command = new PutObjectCommand({
      Bucket: this.bucketName(bucket),
      Key: key,
      ContentType: mime,
      ContentLength: size,
    });
    this.assertSigningHostIsPublic();
    const url = await getSignedUrl(this.signer, command, {
      expiresIn: expiresSeconds,
      signableHeaders: new Set(['content-type']),
    });
    return {
      url,
      method: 'PUT',
      headers: { 'Content-Type': mime },
      expiresAt: new Date(Date.now() + expiresSeconds * 1000).toISOString(),
    };
  }

  async presignDownload(
    bucket: Bucket,
    key: string,
    expiresSeconds = 900,
    downloadName?: string,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName(bucket),
      Key: key,
      ResponseContentDisposition: downloadName
        ? `attachment; filename="${encodeURIComponent(downloadName)}"`
        : undefined,
    });
    this.assertSigningHostIsPublic();
    return getSignedUrl(this.signer, command, { expiresIn: expiresSeconds });
  }

  async put(bucket: Bucket, key: string, body: Uint8Array, mime: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName(bucket),
        Key: key,
        Body: body,
        ContentType: mime,
        ContentLength: body.byteLength,
      }),
    );
  }

  publicUrl(key: string): string {
    // Outside local S3_PUBLIC_BASE_URL is required and checked at start-up (env.ts).
    const base =
      this.config.S3_PUBLIC_BASE_URL ||
      `${this.signingEndpoint.replace(/\/$/, '')}/${this.config.S3_BUCKET_PUBLIC}`;
    return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async head(bucket: Bucket, key: string): Promise<StoredObjectInfo | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucketName(bucket), Key: key }),
      );
      return { size: Number(result.ContentLength ?? 0), mime: result.ContentType ?? null };
    } catch (error) {
      if (
        (error as { name?: string }).name === 'NotFound' ||
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  async delete(bucket: Bucket, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName(bucket), Key: key }));
  }

  async readHead(bucket: Bucket, key: string, bytes: number): Promise<Uint8Array | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName(bucket),
          Key: key,
          Range: `bytes=0-${Math.max(0, bytes - 1)}`,
        }),
      );
      if (!result.Body) return null;
      return await result.Body.transformToByteArray();
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
        return null;
      throw error;
    }
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName('private') }));
      return { ok: true };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) };
    }
  }
}
