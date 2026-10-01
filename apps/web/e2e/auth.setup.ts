import { expect, test as setup } from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE, TRAINER_STATE } from './storage';

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
  const passwordBox = page.getByLabel('Password', { exact: true });
  try {
    await passwordBox.fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
  } finally {
    /*
     * Empty the password box the moment it has been submitted — before anything that can fail.
     * Playwright writes the value of every form field into a failure's `error-context.md`, and
     * a failed assertion captures that snapshot at the instant it fails, so clearing the box
     * afterwards (in a `finally` round the assertion) is too late. The form has already read
     * the value by the time the click returns, so this cannot change what was sent; a sign-in
     * that has already navigated away simply finds no box, hence the short wait and the catch.
     */
    await passwordBox.fill('', { timeout: 1000 }).catch(() => {});
  }
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

setup('sign in as a student', async ({ page }) => {
  const email = process.env['E2E_STUDENT_EMAIL'];
  const password = process.env['E2E_STUDENT_PASSWORD'];
  setup.skip(!email || !password, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD');
  await signIn(page, email!, password!, /\/dashboard$/, STUDENT_STATE);
});
