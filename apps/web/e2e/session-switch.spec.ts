import { expect, test, type Page } from '@playwright/test';

const adminEmail = process.env['E2E_ADMIN_EMAIL'] ?? '';
const adminPassword = process.env['E2E_ADMIN_PASSWORD'] ?? '';
const studentEmail = process.env['E2E_STUDENT_EMAIL'] ?? '';
const studentPassword = process.env['E2E_STUDENT_PASSWORD'] ?? '';

/** Signs in on this page, emptying the password box at once (as auth.setup.ts does). */
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  const passwordBox = page.getByLabel('Password', { exact: true });
  try {
    await passwordBox.fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
  } finally {
    await passwordBox.fill('', { timeout: 1000 }).catch(() => {});
  }
}

/**
 * Tabs share their cookies. An administrator's tab left open on the course list, while another tab
 * signs out and a learner signs in, must not go on showing the administrator's pages and acting as
 * the learner (the production "Create course: You do not have access to this resource" of
 * 8 October 2026): it reloads to the sign-in page as soon as the other tab signs out.
 * A fresh browser context of its own, so the suite's saved sessions are never signed out.
 */
test.describe('one browser, one account across its tabs', () => {
  test.skip(
    !adminEmail || !adminPassword || !studentEmail || !studentPassword,
    'Set the E2E_ADMIN_* and E2E_STUDENT_* variables',
  );

  test('an admin tab left open follows a sign-out in another tab', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const adminTab = await context.newPage();
      await signIn(adminTab, adminEmail, adminPassword);
      await expect(adminTab).toHaveURL(/\/admin/);
      await adminTab.goto('/admin/courses');
      await expect(adminTab.getByRole('button', { name: 'New course' }).first()).toBeVisible();

      const other = await context.newPage();
      await other.goto('/logout');
      await expect(other).toHaveURL(/\/login/);
      // The admin tab no longer shows the administrator's course list.
      await expect(adminTab).toHaveURL(/\/login/, { timeout: 15_000 });

      await signIn(other, studentEmail, studentPassword);
      await expect(other).toHaveURL(/\/dashboard/);
      // Asked for the course list again, it is the learner's portal that answers: no admin pages.
      await adminTab.goto('/admin/courses');
      await expect(adminTab).toHaveURL(/\/403/);
    } finally {
      await context.close();
    }
  });
});
