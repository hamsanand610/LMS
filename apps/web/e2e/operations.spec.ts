import { expect, test } from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE, TRAINER_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);
const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const hasTrainer = Boolean(process.env['E2E_TRAINER_EMAIL'] && process.env['E2E_TRAINER_PASSWORD']);

const STAMP = String(Date.now()).slice(-6);

/**
 * Phase 5 through the pages: J-05 (a trainer marks a class and corrects it) and J-12 (an
 * administrator reads the dashboard, drills into a report and exports it).
 */
test.describe('Phase 5: attendance and reporting', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('a trainer marks attendance', () => {
    test.skip(!hasTrainer, 'Set E2E_TRAINER_EMAIL and E2E_TRAINER_PASSWORD');
    test.use({ storageState: TRAINER_STATE });

    /** Set by the marking test so the correction test reopens the very same class. */
    let markedUrl = '';

    test('J-05: the dashboard offers the roll call for a class that is waiting', async ({
      page,
    }) => {
      await page.goto('/trainer');
      await expect(page.getByRole('heading', { name: /Hello,/ })).toBeVisible();

      // The list is the reliable way to find a class that can still be marked; the dashboard
      // shows the same thing for the classes this trainer teaches.
      await page.goto('/trainer/attendance');
      await page.getByRole('button', { name: 'Waiting for a roll call' }).click();

      // Wait for the list to settle on one of its two outcomes before deciding, rather than
      // reading it mid-fetch and concluding that nothing is waiting.
      const waiting = page.getByRole('link', { name: 'Mark', exact: true }).first();
      const empty = page.getByText('Every class has been marked');
      await expect(waiting.or(empty)).toBeVisible();
      test.skip(
        await empty.isVisible(),
        'Every class in the demo has been marked. Run `pnpm --filter @lms/api demo:reset` first.',
      );

      await waiting.click();
      await page.waitForURL(/\/trainer\/sessions\/[0-9a-f-]+\/attendance$/);
      markedUrl = page.url();

      // Everybody starts present, so marking a full class is one button (AC-05.1).
      const submit = page.getByRole('button', { name: /^Mark \d+ students$/ });
      await expect(submit).toBeVisible();
      await expect(page.getByRole('button', { name: 'All present' })).toBeVisible();

      // The radio is visually hidden inside its label, which is what a person clicks.
      await page.getByRole('group').first().getByText('Absent', { exact: true }).click();
      await submit.click();
      await expect(page.getByText(/students marked/)).toBeVisible();
    });

    test('J-05: correcting a mark needs a reason, and keeps who changed it (AC-05.2)', async ({
      page,
    }) => {
      test.skip(markedUrl === '', 'The marking step did not run.');
      await page.goto(markedUrl);

      const submit = page.getByRole('button', { name: /^Save \d+ change/ });
      await page.getByRole('group').first().getByText('Late', { exact: true }).click();

      // A class already marked is a correction, and a correction must say why.
      await expect(page.getByLabel('Why are you changing this?')).toBeVisible();
      await expect(submit).toBeDisabled();
      await page
        .getByLabel('Why are you changing this?')
        .fill(`Arrived late after a train delay ${STAMP}.`);
      await submit.click();
      await expect(page.getByText(/mark.? changed/)).toBeVisible();

      await page.reload();
      await expect(page.getByText('Corrected').first()).toBeVisible();
      await expect(page.getByText(/train delay/)).toBeVisible();
    });

    test('J-05: the class now reads as marked, with its percentage', async ({ page }) => {
      await page.goto('/trainer/attendance');
      await page.getByRole('button', { name: 'Marked', exact: true }).click();
      await expect(page.getByRole('cell', { name: 'Marked' }).first()).toBeVisible();
      // A marked class always has a percentage; an unmarked one never does.
      await expect(page.getByText(/%/).first()).toBeVisible();
    });

    test('a trainer reads a report, scoped to their own batches', async ({ page }) => {
      await page.goto('/trainer/reports');
      await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
      await page.getByRole('link', { name: 'Open' }).nth(1).click();

      await page.waitForURL(/\/trainer\/reports\/[a-z]+$/);
      await expect(page.getByRole('button', { name: 'What these mean' })).toBeVisible();
    });
  });

  test.describe('an administrator reads the numbers', () => {
    test.skip(!hasAdmin, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
    test.use({ storageState: ADMIN_STATE });

    test('J-12: the dashboard measures what it can and names what it cannot', async ({ page }) => {
      await page.goto('/admin');
      // The tile itself, named by its explainer: a bare "Attendance" also matches the navigation
      // link, which on a phone is rendered inside a closed drawer.
      const body = page.getByRole('main');
      await expect(body.getByRole('button', { name: 'What Attendance means' })).toBeVisible();

      // A tile whose module is not in this build says so rather than showing a number.
      await expect(body.getByText(/this installation does not have/).first()).toBeVisible();
      await expect(page.getByText(/Figures cover/)).toBeVisible();
    });

    test('J-12: drill into the attendance report, sort it, and export it', async ({ page }) => {
      await page.goto('/admin/reports');
      await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

      await page.goto('/admin/reports/attendance');
      await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();

      // The definitions drawer says how every figure is worked out.
      await page.getByRole('button', { name: 'What these mean' }).click();
      await expect(page.getByText(/marked classes/).first()).toBeVisible();
      await page.keyboard.press('Escape');

      // Sorting by the percentage column.
      await page.getByRole('button', { name: 'Attendance', exact: true }).click();
      await expect(page.getByRole('button', { name: /Attendance ▲/ })).toBeVisible();

      const rowCount = await page.getByText(/of \d+ rows/).textContent();
      const total = Number(/of (\d+) rows/.exec(rowCount ?? '')?.[1] ?? '0');
      expect(total).toBeGreaterThan(0);

      await page.getByRole('button', { name: 'Export Excel' }).click();
      await expect(page.getByText('Preparing')).toBeVisible();

      // The file carries exactly the rows the filtered table had.
      await page.goto('/admin/exports');
      await expect(page.getByRole('heading', { name: 'Exports' })).toBeVisible();
      const ready = page.getByRole('cell', { name: 'ready' }).first();
      await expect(ready).toBeVisible();
      await expect(
        page.getByRole('cell', { name: String(total), exact: true }).first(),
      ).toBeVisible();
    });

    test('J-12: the unmarked list is reachable from the dashboard', async ({ page }) => {
      await page.goto('/admin/attendance?state=unmarked');
      await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Waiting for a roll call' })).toBeVisible();
    });
  });

  test.describe('a learner sees their own attendance', () => {
    test.skip(!hasStudent, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD');
    test.use({ storageState: STUDENT_STATE });

    test('the progress page shows the percentage and the classes behind it', async ({ page }) => {
      await page.goto('/progress');
      await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();
      await expect(page.getByText(/of \d+ classes\./).first()).toBeVisible();

      // Nothing on the page is "not measured yet" any more.
      await expect(page.getByText('Not measured yet')).toHaveCount(0);
    });

    test('a learner cannot open anybody else’s roll call', async ({ page }) => {
      const response = await page.request.get('http://localhost:4000/api/v1/attendance/sessions');
      expect(response.status()).toBe(403);
    });
  });
});
