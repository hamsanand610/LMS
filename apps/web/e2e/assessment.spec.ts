import { expect, test } from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE, TRAINER_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);
const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const hasTrainer = Boolean(process.env['E2E_TRAINER_EMAIL'] && process.env['E2E_TRAINER_PASSWORD']);

const STAMP = Date.now();
const QUESTION_TITLE = `Playwright MCQ ${STAMP}`;
const ASSIGNMENT_TITLE = `Playwright Assignment ${STAMP}`;

/**
 * J-06 and J-09 through the pages: an author writes a question, builds an assignment from it,
 * publishes it, and the learner answers it and sees the mark.
 */
test.describe('Phase 4: the question bank, assignments and practice', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('an author writes and publishes', () => {
    test.skip(!hasAdmin, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
    test.use({ storageState: ADMIN_STATE });

    test('J-06a: write a question, publish it, and put it in an assignment', async ({ page }) => {
      await page.goto('/admin/question-bank/new');
      await expect(page.getByRole('heading', { name: 'New question' })).toBeVisible();

      await page.getByLabel('Title').fill(QUESTION_TITLE);
      await page.getByLabel('The question').fill('Which keyword refuses reassignment?');
      await page.getByRole('textbox', { name: 'Option 1' }).fill('var');
      await page.getByRole('textbox', { name: 'Option 2' }).fill('const');
      await page.getByRole('checkbox', { name: 'Option 2 is correct' }).check();
      await page
        .getByLabel('Explanation shown after answering')
        .fill('const refuses reassignment, though the value may still change.');
      await page.getByRole('button', { name: 'Create question' }).click();

      await page.waitForURL(/\/admin\/question-bank\/[0-9a-f-]+$/);
      await page.getByRole('button', { name: 'Publish' }).click();
      await expect(page.getByText('published').first()).toBeVisible();

      await page.goto('/admin/assignments');
      await page.getByRole('button', { name: 'New assignment' }).click();
      await page.getByLabel('Title').fill(ASSIGNMENT_TITLE);
      await page.getByRole('button', { name: 'Create assignment' }).click();

      await page.waitForURL(/\/admin\/assignments\/[0-9a-f-]+$/);
      await page.getByRole('button', { name: 'Add module' }).click();
      await page.getByLabel('Module 1 title').fill('Only module');
      await page.getByRole('button', { name: 'Pick questions' }).click();

      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Search the bank').fill(QUESTION_TITLE);
      const row = dialog.locator('div').filter({ hasText: QUESTION_TITLE }).last();
      await row.getByRole('button', { name: 'Add' }).click();
      await dialog.getByRole('button', { name: 'Done' }).click();

      await page.getByRole('button', { name: 'Save structure' }).click();
      await expect(page.getByText(QUESTION_TITLE)).toBeVisible();
    });

    test('J-06b: publish the assignment to a batch', async ({ page }) => {
      await page.goto('/admin/assignments');
      await page.getByLabel('Search assignments').fill(ASSIGNMENT_TITLE);
      const link = page.getByRole('link', { name: ASSIGNMENT_TITLE });
      await expect(link).toHaveCount(1);
      await link.click();
      await page.waitForURL(/\/admin\/assignments\/[0-9a-f-]+$/);

      await page.getByRole('tab', { name: 'Publishing' }).click();
      await page.getByRole('button', { name: 'Publish to a batch' }).click();

      const dialog = page.getByRole('dialog');
      const select = dialog.getByLabel('Batch');
      const value = await select
        .locator('option', { hasText: 'JFS-2026-B1' })
        .first()
        .getAttribute('value');
      await select.selectOption(value!);
      await dialog.getByRole('button', { name: 'Publish' }).click();

      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('cell', { name: /JFS-2026-B1/ })).toBeVisible();
    });
  });

  test.describe('a learner answers', () => {
    test.skip(!hasStudent, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD');
    test.use({ storageState: STUDENT_STATE });

    test('J-09: the assignment appears, the answer is marked, the figure moves', async ({
      page,
    }) => {
      await page.goto('/assignments');
      const card = page.getByRole('link', { name: ASSIGNMENT_TITLE });
      await expect(card).toBeVisible();
      await card.click();

      await page.waitForURL(/\/assignments\/[0-9a-f-]+$/);
      await page.getByRole('link', { name: new RegExp(QUESTION_TITLE) }).click();
      await page.waitForURL(/\/assignments\/[0-9a-f-]+\/q\/[0-9a-f-]+$/);

      await expect(page.getByRole('heading', { name: QUESTION_TITLE })).toBeVisible();
      await page.getByLabel('const', { exact: true }).check();
      await page.getByRole('button', { name: 'Submit answer' }).click();

      await expect(page.getByText('refuses reassignment', { exact: false })).toBeVisible();
      // The link appears above the question and again at the foot of it.
      await page.getByRole('link', { name: 'Back to the assignment' }).first().click();
      await page.waitForURL(/\/assignments\/[0-9a-f-]+$/);
      await expect(page.getByText('1 / 1').first()).toBeVisible();
    });

    test('the progress page counts the assignment', async ({ page }) => {
      await page.goto('/progress');
      await expect(page.getByRole('heading', { name: 'Assessment' })).toBeVisible();
      await expect(page.getByText('Assignment questions')).toBeVisible();
      // Attendance is the only figure still named as pending after Phase 4.
      await expect(page.getByText('Not measured yet')).toBeVisible();
      await expect(page.getByText('Attendance is recorded from Phase 5.')).toBeVisible();
    });

    test('solves a coding problem in the browser and records the verdict', async ({ page }) => {
      await page.goto('/practice');
      await expect(page.getByRole('heading', { name: 'Coding practice' })).toBeVisible();
      await page.getByRole('link', { name: 'Add two numbers' }).click();

      await page.waitForURL(/\/practice\/add-two-numbers$/);
      await expect(page.getByRole('heading', { name: 'Add two numbers' })).toBeVisible();
      await expect(page.getByText('Runs in your browser')).toBeVisible();

      await page
        .getByLabel('Your solution')
        .fill(
          "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);",
        );
      await page.getByRole('button', { name: 'Run the examples' }).click();
      await expect(page.getByText('Every example passed')).toBeVisible({ timeout: 30_000 });

      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(page.getByRole('cell', { name: 'Accepted' }).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByRole('cell', { name: 'your browser' }).first()).toBeVisible();
    });
  });

  test.describe('a learner sits a test', () => {
    test.skip(!hasStudent, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD');
    test.use({ storageState: STUDENT_STATE });

    /**
     * J-10 through the pages. The demo seeds one test whose window is open today; if that learner
     * has already used their attempt the test says so and this journey is skipped rather than
     * reported as a failure.
     */
    test('J-10: start a test, answer, and submit', async ({ page }) => {
      await page.goto('/tests');
      await expect(page.getByRole('heading', { name: 'Tests' })).toBeVisible();

      // Wait for the list to render before deciding whether anything is open.
      const liveTab = page.getByRole('tab', { name: /^Open now/ });
      await expect(liveTab).toBeVisible();
      const label = (await liveTab.textContent()) ?? '';
      test.skip(label.includes('(0)'), 'No test is open to this learner right now');
      await page.getByRole('link', { name: 'Start' }).first().click();

      await page.waitForURL(/\/tests\/[0-9a-f-]+$/);
      await expect(page.getByRole('heading', { name: 'Before you start' })).toBeVisible();
      await expect(page.getByText('The clock belongs to the server')).toBeVisible();
      await page.getByRole('button', { name: 'Start the test' }).click();

      await page.waitForURL(/\/attempt\?attempt=/);
      // The countdown and the palette are what tell the learner where they are.
      await expect(page.getByRole('button', { name: 'Submit the paper' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Question 1/ })).toBeVisible();

      const firstOption = page.getByRole('checkbox').first();
      await firstOption.check();
      await expect(page.getByText(/Saved at/)).toBeVisible({ timeout: 20_000 });

      await page.getByRole('button', { name: 'Submit the paper' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();

      await page.waitForURL(/\/result$/);
      // The results are held until the trainer releases them, and the page says exactly that.
      await expect(page.getByText('Results are not out yet')).toBeVisible();
    });
  });

  test.describe('a trainer marks written work', () => {
    test.skip(!hasTrainer, 'Set E2E_TRAINER_EMAIL and E2E_TRAINER_PASSWORD');
    test.use({ storageState: TRAINER_STATE });

    test('the question bank shows a trainer only their own questions', async ({ page }) => {
      await page.goto('/trainer/question-bank');
      await expect(page.getByRole('heading', { name: 'Question bank' })).toBeVisible();
      await page.getByLabel('Search questions').fill(QUESTION_TITLE);
      await expect(page.getByRole('link', { name: QUESTION_TITLE })).toHaveCount(0);
    });
  });
});
