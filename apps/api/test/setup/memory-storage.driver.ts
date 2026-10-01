import type {
  Bucket,
  PresignedUpload,
  StorageDriver,
  StoredObjectInfo,
} from '../../src/core/storage/storage.driver.js';

/** Signed links point here: a reserved name that nothing answers on, and nothing in a test calls. */
const HOST = 'http://storage.test';

/**
 * A stand-in for object storage in the API tests, so they need PostgreSQL and nothing else (as
 * docs/runbooks/testing.md says), the way the sandbox is replaced by FakeExecutionDriver. Objects
 * live in memory for the life of one test application; what the server writes (an export) can be
 * read back, and signed links have the shape a browser would be given. The S3 driver itself is
 * exercised against MinIO by the running stack, not here.
 */
export class MemoryStorageDriver implements StorageDriver {
  readonly name = 'memory';
  private readonly objects = new Map<string, { body: Uint8Array; mime: string }>();

  bucketName(bucket: Bucket): string {
    return `lms-test-${bucket}`;
  }

  presignUpload(
    bucket: Bucket,
    key: string,
    mime: string,
    _size: number,
    expiresSeconds = 900,
  ): Promise<PresignedUpload> {
    return Promise.resolve({
      url: `${this.link(bucket, key)}?expires=${expiresSeconds}`,
      method: 'PUT',
      headers: { 'Content-Type': mime },
      expiresAt: new Date(Date.now() + expiresSeconds * 1000).toISOString(),
    });
  }

  presignDownload(
    bucket: Bucket,
    key: string,
    expiresSeconds = 900,
    downloadName?: string,
  ): Promise<string> {
    const name = downloadName ? `&filename=${encodeURIComponent(downloadName)}` : '';
    return Promise.resolve(`${this.link(bucket, key)}?expires=${expiresSeconds}${name}`);
  }

  put(bucket: Bucket, key: string, body: Uint8Array, mime: string): Promise<void> {
    this.objects.set(this.id(bucket, key), { body: Uint8Array.from(body), mime });
    return Promise.resolve();
  }

  publicUrl(key: string): string {
    return this.link('public', key);
  }

  head(bucket: Bucket, key: string): Promise<StoredObjectInfo | null> {
    const object = this.objects.get(this.id(bucket, key));
    return Promise.resolve(object ? { size: object.body.byteLength, mime: object.mime } : null);
  }

  delete(bucket: Bucket, key: string): Promise<void> {
    this.objects.delete(this.id(bucket, key));
    return Promise.resolve();
  }

  readHead(bucket: Bucket, key: string, bytes: number): Promise<Uint8Array | null> {
    const object = this.objects.get(this.id(bucket, key));
    return Promise.resolve(object ? object.body.slice(0, bytes) : null);
  }

  healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    return Promise.resolve({ ok: true });
  }

  private id(bucket: Bucket, key: string): string {
    return `${bucket}/${key}`;
  }

  private link(bucket: Bucket, key: string): string {
    return `${HOST}/${this.bucketName(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
}
