import { expect, test } from '@playwright/test';

const email = process.env['E2E_STUDENT_EMAIL'];
const password = process.env['E2E_STUDENT_PASSWORD'];

/*
 * The one Phase 2 journey that types a password, so it starts from no session and records no
 * trace: a trace keeps a snapshot of every step, the filled password box among them.
 */
test.use({ storageState: { cookies: [], origins: [] }, trace: 'off' });

test.describe('Phase 2: a learner signs in', () => {
  test.skip(!email || !password, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD');

  test('J1: signs in and lands on the dashboard with its panels', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email!);
    const passwordBox = page.getByLabel('Password', { exact: true });
    try {
      await passwordBox.fill(password!);
      await page.getByRole('button', { name: 'Sign in' }).click();
    } finally {
      // Emptied the moment it has been sent, before anything that can fail (see auth.setup.ts).
      await passwordBox.fill('', { timeout: 1000 }).catch(() => {});
    }
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Overall progress')).toBeVisible();
    // The dashboard's own panels: on a phone the sidebar's links of the same names are hidden.
    const main = page.getByRole('main');
    for (const panel of ['Recent activity', 'Notifications', 'Labs', 'Certificates']) {
      await expect(main.getByText(panel, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'All notifications' })).toBeVisible();
  });
});
