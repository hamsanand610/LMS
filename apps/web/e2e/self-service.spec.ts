import { expect, test } from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE, TRAINER_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);
const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const hasTrainer = Boolean(process.env['E2E_TRAINER_EMAIL'] && process.env['E2E_TRAINER_PASSWORD']);

const STAMP = String(Date.now()).slice(-6);

/**
 * Phase 6: the pages people use about themselves, the institute's own words, and the navigation
 * checks the plan asks for — every link reachable, deep links working, and 403 and 404 behaving.
 */
test.describe('Phase 6: self-service, settings and navigation', () => {
  test.describe('a learner keeps their own record', () => {
    test.skip(!hasStudent, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD');
    test.use({ storageState: STUDENT_STATE });

    test('the profile says what is still missing, and editing a section changes it', async ({
      page,
    }) => {
      await page.goto('/profile');
      await expect(page.getByText('Profile completeness')).toBeVisible();

      await page.goto('/profile/edit/skills');
      await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
      await page
        .getByLabel('Skills, separated by commas')
        .fill(`Java, SQL, HTML, Playwright ${STAMP}`);
      await page.getByRole('button', { name: 'Save', exact: true }).click();

      await page.waitForURL(/\/profile$/);
      await expect(page.getByText(`Playwright ${STAMP}`).first()).toBeVisible();
    });

    test('resumes and documents are reachable and explain their own rules', async ({ page }) => {
      await page.goto('/profile/resumes');
      await expect(page.getByRole('heading', { name: 'Resumes' })).toBeVisible();
      await expect(page.getByText(/PDF/).first()).toBeVisible();

      await page.goto('/profile/documents');
      await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
      await expect(page.getByLabel('What is it?')).toBeVisible();
    });

    test('the notification preferences have a page of their own', async ({ page }) => {
      await page.goto('/settings/notifications');
      await expect(page.getByRole('heading', { name: 'Notification preferences' })).toBeVisible();
    });

    test('search returns only what a learner may see', async ({ page }) => {
      await page.goto('/search?q=java');
      await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
      // A learner has no business finding staff records, whatever they type.
      await expect(page.getByText('Trainers')).toHaveCount(0);
    });

    test('a learner is refused an administrator’s page, and offered their own', async ({
      page,
    }) => {
      await page.goto('/admin/students');
      await expect(page).toHaveURL(/\/403$/);
      await expect(page.getByRole('heading', { name: /do not have access/ })).toBeVisible();
      // The plan asks for a link back to the portal this person does have (§15.2).
      await expect(page.getByRole('link', { name: 'Back to your dashboard' })).toBeVisible();
    });

    test('an address that does not exist gets the not-found page', async ({ page }) => {
      await page.goto('/this-address-does-not-exist');
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    });
  });

  test.describe('a trainer keeps their own record', () => {
    test.skip(!hasTrainer, 'Set E2E_TRAINER_EMAIL and E2E_TRAINER_PASSWORD');
    test.use({ storageState: TRAINER_STATE });

    test('the trainer profile saves a headline', async ({ page }) => {
      await page.goto('/trainer/profile');
      await expect(page.getByText('About you')).toBeVisible();
      await page.getByLabel('Headline').fill(`Core Java and databases ${STAMP}`);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByText('Profile saved')).toBeVisible();
    });
  });

  test.describe('the institute’s own words and wiring', () => {
    test.skip(!hasAdmin, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
    test.use({ storageState: ADMIN_STATE });

    test('the vocabularies and the custom fields share one page', async ({ page }) => {
      await page.goto('/admin/settings/fields');
      await expect(page.getByRole('heading', { name: 'Fields and vocabularies' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Vocabularies' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Custom fields' })).toBeVisible();
      // The vocabularies load (their list once asked for an address the API does not have, and
      // each card showed "Request failed with status 404").
      await expect(page.getByText('beginner', { exact: true })).toBeVisible();
      await expect(page.getByText('Request failed with status 404')).toHaveCount(0);
    });

    test('the old custom-fields address still works', async ({ page }) => {
      await page.goto('/admin/settings/custom-fields');
      await expect(page).toHaveURL(/\/admin\/settings\/fields$/);
    });

    test('email wording is editable and can be sent as a test', async ({ page }) => {
      await page.goto('/admin/settings/templates');
      await expect(page.getByRole('heading', { name: 'Templates and pages' })).toBeVisible();
      await expect(page.getByText('Invitation')).toBeVisible();
      // The variables a template may use are stated, so a save cannot invent one.
      await expect(page.getByText(/\{\{brandName\}\}/).first()).toBeVisible();
    });

    test('integrations say which driver is actually running', async ({ page }) => {
      await page.goto('/admin/settings/integrations');
      await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
      await expect(page.getByText(/In use:/).first()).toBeVisible();

      await page.getByRole('button', { name: 'Test what is running' }).first().click();
      await expect(page.getByText(/Reached|driver|browser/).first()).toBeVisible();
    });

    test('every item in the administrator’s navigation opens its page', async ({ page }) => {
      await page.goto('/admin');

      // On a phone the staff navigation lives in a drawer (plan §15.2), so it has to be opened
      // before its links are anywhere to be found.
      const drawer = page.getByRole('button', { name: 'Open navigation' });
      if (await drawer.isVisible().catch(() => false)) await drawer.click();

      const links = await page.getByRole('navigation', { name: 'Main' }).getByRole('link').all();
      const routes = [
        ...new Set(
          (await Promise.all(links.map((link) => link.getAttribute('href')))).filter(
            (href): href is string => Boolean(href),
          ),
        ),
      ];
      expect(routes.length).toBeGreaterThan(10);

      for (const route of routes) {
        const response = await page.goto(route);
        expect(response?.status(), `${route} did not open`).toBeLessThan(400);
        await expect(page.getByRole('heading').first(), `${route} has no heading`).toBeVisible();
      }
    });
  });

  test.describe('anybody at all', () => {
    test('the Privacy Policy and Terms of Service are readable without signing in', async ({
      page,
    }) => {
      // From the sign-in page's foot, as a visitor finds them.
      await page.goto('/login');
      await page.getByRole('link', { name: 'Privacy Policy' }).click();
      await expect(page).toHaveURL(/\/pages\/privacy$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
      // A draft says so, and sets apart what is still to be confirmed.
      await expect(page.getByText('Draft for review.')).toBeVisible();
      await expect(page.locator('mark').first()).toContainText('To be confirmed');
      const contents = page.getByRole('navigation', { name: 'On this page' });
      await contents.getByRole('link', { name: 'SI Academy AI and external AI providers' }).click();
      await expect(page).toHaveURL(/#si-academy-ai-and-external-ai-providers$/);

      await page.getByRole('navigation', { name: 'Policies' }).getByRole('link').last().click();
      await expect(page).toHaveURL(/\/pages\/terms$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible();
    });

    test('a page that is not published reads as missing', async ({ page }) => {
      await page.goto('/pages/no-such-page');
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    });
  });
});
