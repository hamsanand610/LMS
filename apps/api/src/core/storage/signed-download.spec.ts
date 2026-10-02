import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../http/errors.js';
import { signedDownload } from './signed-download.js';
import type { StorageDriver } from './storage.driver.js';

const storage = (present: boolean) =>
  ({
    head: vi.fn(async () => (present ? { size: 10, mime: 'application/pdf' } : null)),
    presignDownload: vi.fn(async () => 'https://storage.example/signed'),
  }) as unknown as StorageDriver & {
    head: ReturnType<typeof vi.fn>;
    presignDownload: ReturnType<typeof vi.fn>;
  };

describe('signed downloads (Phase 2, LRN-19)', () => {
  it('signs a link to an object that is there, passing the name and lifetime through', async () => {
    const driver = storage(true);
    await expect(
      signedDownload(driver, 'private', 'files/a.pdf', 'File', 300, 'Notes.pdf'),
    ).resolves.toBe('https://storage.example/signed');
    expect(driver.head).toHaveBeenCalledWith('private', 'files/a.pdf');
    expect(driver.presignDownload).toHaveBeenCalledWith('private', 'files/a.pdf', 300, 'Notes.pdf');
  });

  it('answers "not found" for an object lost from storage, and signs nothing', async () => {
    const driver = storage(false);
    const attempt = signedDownload(driver, 'private', 'files/gone.pdf', 'Resource');
    await expect(attempt).rejects.toBeInstanceOf(NotFoundError);
    await expect(attempt).rejects.toMatchObject({ status: 404 });
    expect(driver.presignDownload).not.toHaveBeenCalled();
  });
});
