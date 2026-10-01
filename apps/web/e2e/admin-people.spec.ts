import { expect, test } from '@playwright/test';
import { ADMIN_STATE, TRAINER_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);
const hasTrainer = Boolean(process.env['E2E_TRAINER_EMAIL'] && process.env['E2E_TRAINER_PASSWORD']);

test.describe('Phase 2: people, cohorts and communication', () => {
  test.skip(!hasAdmin, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
  test.use({ storageState: ADMIN_STATE });

  test('the dashboard counts people and says which tiles are still pending', async ({ page }) => {
    await page.goto('/admin');
    // The tile's own label, by the explainer beside it: a bare "Students" also matches the
    // navigation link, which on a phone is rendered inside a closed drawer.
    const body = page.getByRole('main');
    await expect(body.getByRole('button', { name: 'What Students means' })).toBeVisible();
    // A tile whose module is not in this build states the reason instead of showing a number.
    await expect(body.getByText(/this installation does not have/).first()).toBeVisible();
  });

  test('J-01: an admin creates a student and finds them in the list', async ({ page }) => {
    const email = `e2e-student-${Date.now()}@siacademy.example`;
    await page.goto('/admin/students');
    await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible();

    await page.getByRole('button', { name: 'New student' }).click();
    await page.getByLabel('Full name').fill('Playwright Student');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Add student' }).click();
    // The dialog closes on success; the toast is transient, so the list is the real evidence.
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByLabel('Search students').fill(email);
    // Wait for the filtered list to settle on the single new row before following its link.
    const row = page.getByRole('row').filter({ hasText: email });
    await expect(row).toHaveCount(1);
    await row.getByRole('link').click();
    await page.waitForURL(/\/admin\/students\/[0-9a-f-]+$/);

    await expect(page.getByRole('heading', { name: 'Playwright Student' })).toBeVisible();
    await expect(page.getByText('invited')).toBeVisible();
  });

  test('J-02: a batch shows its roster and its trainer assignments', async ({ page }) => {
    await page.goto('/admin/batches');
    await expect(page.getByRole('heading', { name: 'Batches' })).toBeVisible();

    await page.getByRole('link', { name: 'JFS-2026-B1' }).click();
    await expect(page.getByRole('heading', { name: 'JFS-2026-B1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add students' })).toBeVisible();

    await page.getByRole('tab', { name: 'Trainers' }).click();
    await expect(page.getByRole('button', { name: 'Save assignments' })).toBeVisible();
  });

  test('the import page offers a template and checks a file before writing', async ({ page }) => {
    await page.goto('/admin/students/import');
    await expect(page.getByRole('heading', { name: 'Import students' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download template' })).toBeVisible();
    // Import stays disabled until a file has been checked.
    await expect(page.getByRole('button', { name: 'Import students' })).toBeDisabled();
  });

  test('the demo sample sheet checks out with exactly its three bad rows', async ({ page }) => {
    await page.goto('/admin/students/import');
    await page.getByLabel('Sheet').setInputFiles('../../clients/demo/seeds/students-sample.csv');
    await expect(page.getByText(/students-sample\.csv · 20 data rows/)).toBeVisible();

    await page.getByRole('button', { name: 'Check the file' }).click();
    await expect(page.getByText(/of 20 rows would be imported/)).toBeVisible();
    // One bad email, one missing name, one unknown batch code.
    await expect(
      page.getByRole('row').filter({ hasText: 'Enter a valid email address' }),
    ).toHaveCount(1);
    await expect(page.getByRole('row').filter({ hasText: 'Enter the full name' })).toHaveCount(1);
    await expect(page.getByRole('row').filter({ hasText: 'No batch with this code' })).toHaveCount(
      1,
    );
    // Checking never writes: the import button only becomes available afterwards.
    await expect(page.getByRole('button', { name: 'Import students' })).toBeEnabled();
  });

  test('the command palette searches the records the admin may see', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByLabel('Search term').fill('Java Full-Stack');
    await expect(page.getByRole('dialog').getByText('Programmes')).toBeVisible();
  });
});

test.describe('Phase 2: trainer scope', () => {
  test.skip(!hasTrainer, 'Set E2E_TRAINER_EMAIL and E2E_TRAINER_PASSWORD');
  test.use({ storageState: TRAINER_STATE });

  test('a trainer sees only the batches they teach', async ({ page }) => {
    await page.goto('/trainer/batches');
    await expect(page.getByRole('heading', { name: 'My batches' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'JFS-2026-B1' })).toBeVisible();
    // The trainer of batch 1 is not assigned to batch 2.
    await expect(page.getByRole('link', { name: 'JFS-2026-B2' })).toHaveCount(0);
  });

  test('the admin portal is not open to a trainer', async ({ page }) => {
    await page.goto('/admin/students');
    await expect(page).not.toHaveURL(/\/admin\/students$/);
  });
});
