import { expect, test as setup } from '@playwright/test';
import { ADMIN_STATE, TRAINER_STATE } from './storage';

/**
 * Signs in once per role and stores the cookies for the other specs.
 *
 * The API allows five sign-in attempts per quarter of an hour for one address, which is the
 * behaviour the auth tests assert; without a shared session a suite of a dozen browser tests
 * would trip that limit on itself.
 */

async function signIn(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  expectedUrl: RegExp,
  file: string,
) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(expectedUrl);
  await page.context().storageState({ path: file });
}

setup('sign in as an administrator', async ({ page }) => {
  const email = process.env['E2E_ADMIN_EMAIL'];
  const password = process.env['E2E_ADMIN_PASSWORD'];
  setup.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
  await signIn(page, email!, password!, /\/admin$/, ADMIN_STATE);
});

setup('sign in as a trainer', async ({ page }) => {
  const email = process.env['E2E_TRAINER_EMAIL'];
  const password = process.env['E2E_TRAINER_PASSWORD'];
  setup.skip(!email || !password, 'Set E2E_TRAINER_EMAIL and E2E_TRAINER_PASSWORD');
  await signIn(page, email!, password!, /\/trainer$/, TRAINER_STATE);
});
