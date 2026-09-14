import { expect, test } from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE, TRAINER_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);
const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const hasTrainer = Boolean(process.env['E2E_TRAINER_EMAIL'] && process.env['E2E_TRAINER_PASSWORD']);

/**
 * Steps the schedule back a week. The buttons are server-rendered before React attaches its
 * handlers, so a click can land on nothing; retrying until the range actually moves makes the
 * step deterministic without a fixed wait.
 */
async function goToPreviousWeek(page: import('@playwright/test').Page): Promise<void> {
  const range = page.getByText(/\d+\/\d+\/\d+ . \d+\/\d+\/\d+/);
  const before = (await range.first().textContent()) ?? '';
  // Retried because the buttons are server-rendered before React attaches its handlers, so the
  // first click can land on nothing. Works however many weeks back the caller has already gone.
  await expect(async () => {
    await page.getByRole('button', { name: 'Previous week' }).click();
    await expect(range.first()).not.toHaveText(before, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

/** One title for the whole file, so the learner journey can find what the author published. */
const COURSE_TITLE = `Playwright Course ${Date.now()}`;
const LESSON_TITLE = 'What this lesson covers';

test.describe('Phase 3: courses, the player and the timetable', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('an author builds and publishes a course', () => {
    test.skip(!hasAdmin, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
    test.use({ storageState: ADMIN_STATE });

    test('J-03a: create a course, give it a lesson and publish it to a batch', async ({ page }) => {
      await page.goto('/admin/courses');
      await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible();

      await page.getByRole('button', { name: 'New course' }).click();
      await page.getByLabel('Title').fill(COURSE_TITLE);
      await page.getByLabel('Description').fill('Created by the browser tests.');
      await page.getByRole('button', { name: 'Create course' }).click();

      // Creating opens the workspace for the new course.
      await page.waitForURL(/\/admin\/courses\/[0-9a-f-]+$/);
      await expect(page.getByRole('heading', { name: COURSE_TITLE })).toBeVisible();

      await page.getByRole('button', { name: 'Add module' }).click();
      await page.getByLabel('Module 1 title').fill('Getting started');
      await page.getByRole('button', { name: 'Add lesson' }).click();
      await page.getByLabel('Lesson 1 title').fill(LESSON_TITLE);

      await page.getByRole('button', { name: 'Edit' }).click();
      await page
        .getByLabel('Lesson content')
        .fill('<p>Read this, then mark the lesson complete.</p>');
      await page.getByRole('button', { name: 'Save outline' }).click();
      await expect(page.getByText('1 module, 1 lesson')).toBeVisible();

      await page.getByRole('tab', { name: 'Publishing' }).click();
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Audience').selectOption('batch');
      const batch = dialog.getByLabel('Batch');
      const batchValue = await batch
        .locator('option', { hasText: 'JFS-2026-B1' })
        .first()
        .getAttribute('value');
      await batch.selectOption(batchValue!);
      await dialog.getByRole('button', { name: 'Publish' }).click();

      await expect(page.getByRole('dialog')).toHaveCount(0);
      // The audience table is the evidence: a toast disappears, a row does not.
      await expect(page.getByRole('cell', { name: /JFS-2026-B1/ })).toBeVisible();
    });
  });

  test.describe('a learner works through it', () => {
    test.skip(!hasStudent, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD');
    test.use({ storageState: STUDENT_STATE });

    test('J-03b: the course appears, a lesson opens and completing it moves the bar', async ({
      page,
    }) => {
      await page.goto('/courses');
      const card = page.getByText(COURSE_TITLE, { exact: true });
      await expect(card).toBeVisible();
      await card.click();

      await page.waitForURL(/\/courses\/[0-9a-f-]+$/);
      await expect(page.getByRole('heading', { name: COURSE_TITLE })).toBeVisible();
      await page.getByRole('link', { name: new RegExp(LESSON_TITLE) }).click();

      await page.waitForURL(/\/lessons\/[0-9a-f-]+$/);
      await expect(page.getByRole('heading', { name: LESSON_TITLE })).toBeVisible();
      await expect(page.getByText('Read this, then mark the lesson complete.')).toBeVisible();

      // It is the only lesson, so there is nowhere to go next: the player stays and says so.
      await page.getByRole('button', { name: 'Mark complete' }).click();
      await expect(page.getByText('Completed')).toBeVisible();

      await page.getByRole('link', { name: 'Back to the course' }).click();
      await page.waitForURL(/\/courses\/[0-9a-f-]+$/);
      await expect(page.getByText('100% complete')).toBeVisible();
    });

    test('the progress page reports the same figure as the course', async ({ page }) => {
      await page.goto('/progress');
      await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
      const block = page
        .locator('div.rounded-lg.border.p-4')
        .filter({ has: page.getByRole('link', { name: COURSE_TITLE, exact: true }) });
      await expect(block).toContainText('1 of 1 lessons');
      await expect(block).toContainText('100%');
      // Figures that later phases will fill are named rather than shown as zero.
      await expect(page.getByText('Not measured yet')).toBeVisible();
    });

    test('the dashboard shows today’s classes and where to carry on', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.getByText('Overall progress')).toBeVisible();
      await expect(page.getByText('Today and tomorrow')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Open the schedule' })).toBeVisible();
    });

    test('J-07: the learner sees their own week', async ({ page }) => {
      await page.goto('/schedule');
      await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
      await goToPreviousWeek(page);
      // The demo seeds classes either side of today for this learner's batch.
      await expect(page.getByText('JFS-2026-B1').first()).toBeVisible();
    });
  });

  test.describe('a trainer runs a class', () => {
    test.skip(!hasTrainer, 'Set E2E_TRAINER_EMAIL and E2E_TRAINER_PASSWORD');
    test.use({ storageState: TRAINER_STATE });

    test('J-08: publish the recording of a class that has been taught', async ({ page }) => {
      await page.goto('/trainer/schedule');
      await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
      // Step back until a class that has been taught has no recording yet. Earlier runs of this
      // suite attach recordings, so the most recent week is often already done.
      let button = page.getByRole('button', { name: 'Add recording' }).first();
      for (let week = 0; week < 3; week += 1) {
        await goToPreviousWeek(page);
        button = page.getByRole('button', { name: 'Add recording' }).first();
        if ((await button.count()) > 0) break;
      }
      test.skip(
        (await button.count()) === 0,
        'Every class this trainer has taught already has its recording',
      );
      await button.click();

      const dialog = page.getByRole('dialog');
      const course = dialog.getByLabel('Course');
      const courseValue = await course
        .locator('option', { hasText: 'Core Java' })
        .first()
        .getAttribute('value');
      await course.selectOption(courseValue!);
      await dialog.getByLabel('Link to the recording').fill('https://recordings.example.test/e2e');
      await dialog.getByRole('button', { name: 'Publish recording' }).click();

      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Recording' }).first()).toBeVisible();
    });
  });
});
