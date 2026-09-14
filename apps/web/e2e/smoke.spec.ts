import { expect, test } from '@playwright/test';

const email = process.env['E2E_ADMIN_EMAIL'];
const password = process.env['E2E_ADMIN_PASSWORD'];

/** These tests exercise signing in itself, so they start from no session. */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Phase 1 smoke: sign in, admin shell, settings, sign out', () => {
  test.skip(
    !email || !password,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for a Super Admin account',
  );

  test('unauthenticated visitors are sent to the branded sign-in page', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('a Super Admin reaches the admin dashboard, opens settings and signs out', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: /^Welcome, / })).toBeVisible();

    // The settings pages belong to a Super Admin. When E2E_ADMIN_* names an ordinary Admin the
    // menu does not offer them, and this part of the walk is skipped rather than reported failed.
    const me = await page.request.get('http://localhost:4000/api/v1/me');
    const permissions =
      ((await me.json()) as { permissions?: { key: string }[] }).permissions ?? [];
    if (permissions.some((p) => p.key === 'settings:manage')) {
      await page.goto('/admin/settings/general');
      await expect(page.getByRole('heading', { name: 'General settings' })).toBeVisible();
      await expect(page.getByLabel('Institute name')).not.toHaveValue('');

      await page.goto('/admin/settings/roles');
      await expect(page.getByRole('heading', { name: 'Roles and permissions' })).toBeVisible();
      await expect(page.getByText('Always full access').first()).toBeVisible();
      await page.goto('/admin');
    }

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('wrong credentials show a generic message and stay on the page', async ({ page }) => {
    await page.goto('/login');
    // A throw-away address: repeating this test must not lock or throttle a real account.
    await page.getByLabel('Email').fill(`nobody-${Date.now()}@demo.local`);
    await page.getByLabel('Password').fill(`${password}-wrong`);
    await page.getByRole('button', { name: 'Sign in' }).click();
    // Next.js adds its own empty route announcer with role="alert"; target the form's message.
    await expect(page.getByRole('alert').filter({ hasText: /incorrect/ })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
