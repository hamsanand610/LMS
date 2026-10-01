export type Bucket = 'private' | 'public';

export interface PresignedUpload {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

export interface StoredObjectInfo {
  size: number;
  mime: string | null;
}

/** S3-compatible object storage abstraction. Drivers: s3 (MinIO/R2/S3). */
export interface StorageDriver {
  readonly name: string;
  bucketName(bucket: Bucket): string;
  /** A URL that accepts exactly `size` bytes of `mime` at `key`, and nothing else. */
  presignUpload(
    bucket: Bucket,
    key: string,
    mime: string,
    size: number,
    expiresSeconds?: number,
  ): Promise<PresignedUpload>;
  presignDownload(
    bucket: Bucket,
    key: string,
    expiresSeconds?: number,
    downloadName?: string,
  ): Promise<string>;
  /**
   * Writes an object the server produced (an export file), rather than one a browser uploaded
   * through a presigned URL.
   */
  put(bucket: Bucket, key: string, body: Uint8Array, mime: string): Promise<void>;
  /** Stable URL for objects in the public bucket. */
  publicUrl(key: string): string;
  head(bucket: Bucket, key: string): Promise<StoredObjectInfo | null>;
  delete(bucket: Bucket, key: string): Promise<void>;
  /** Reads the first bytes of an object (for MIME sniffing). */
  readHead(bucket: Bucket, key: string, bytes: number): Promise<Uint8Array | null>;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
