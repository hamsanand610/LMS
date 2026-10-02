import { NotFoundError } from '../http/errors.js';
import type { Bucket, StorageDriver } from './storage.driver.js';

/**
 * A signed download link to an object that is really in storage. Signing alone never touches the
 * bucket, so a file lost from storage would hand the browser a link that fails at the storage host
 * with its own error page. Checking first answers "not found" in the product's words (Phase 2,
 * LRN-19). `what` names the thing for the error, as `NotFoundError` does.
 */
export async function signedDownload(
  storage: StorageDriver,
  bucket: Bucket,
  key: string,
  what: string,
  expiresSeconds?: number,
  downloadName?: string,
): Promise<string> {
  if (!(await storage.head(bucket, key))) throw new NotFoundError(what);
  return storage.presignDownload(bucket, key, expiresSeconds, downloadName);
}
