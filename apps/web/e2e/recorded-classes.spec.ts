import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);

/** The first bytes of an MP4 file: what the API checks the real type by. Not a playable video. */
function mp4Bytes(): Buffer {
  const bytes = Buffer.alloc(4096);
  bytes.set([0x00, 0x00, 0x00, 0x18], 0);
  bytes.write('ftypisom', 4, 'ascii');
  return bytes;
}

/**
 * Recorded classes from the course builder: an administrator gives a lesson a video, which goes
 * straight to storage with its progress shown, is checked by the API, and stays with the lesson
 * when the outline is saved and opened again. The API tests prove the limits, the signed playback
 * link and the recording's measured length.
 */
test.describe('recorded classes: a lesson video from the course builder', () => {
  test.skip(!hasAdmin, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
  test.use({ storageState: ADMIN_STATE });

  test('uploads a video to a lesson and keeps it with the saved outline', async ({ page }) => {
    const title = `Recorded course ${test.info().project.name} ${Date.now().toString().slice(-6)}`;
    await page.goto('/admin/courses');
    await page.getByRole('button', { name: 'New course' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Title').fill(title);
    await dialog.getByRole('button', { name: /create/i }).click();
    await page.waitForURL(/\/admin\/courses\/[0-9a-f-]+/);
    await page.getByRole('tab', { name: 'Outline' }).click();

    await page.getByRole('button', { name: 'Add module' }).click();
    await page.getByRole('button', { name: 'Add lesson' }).click();
    await page.getByLabel('Lesson type').selectOption('video');
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByText('No video yet.')).toBeVisible();

    await page
      .locator('input[type="file"][accept*="video/mp4"]')
      .setInputFiles({ name: 'week-one.mp4', mimeType: 'video/mp4', buffer: mp4Bytes() });
    await expect(page.getByText(/A video is attached/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Replace the video' })).toBeVisible();

    await page.getByRole('button', { name: 'Save outline' }).click();
    await expect(page.getByText('Outline saved')).toBeVisible();

    // Opened again from what was saved: the video is still the lesson's.
    await page.reload();
    await page.getByRole('tab', { name: 'Outline' }).click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByText(/A video is attached/)).toBeVisible();
  });
});
