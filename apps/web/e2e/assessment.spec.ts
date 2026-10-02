import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE, TRAINER_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);
const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const hasTrainer = Boolean(process.env['E2E_TRAINER_EMAIL'] && process.env['E2E_TRAINER_PASSWORD']);

const STAMP = Date.now();
const QUESTION_TITLE = `Playwright MCQ ${STAMP}`;
const CODING_TITLE = `Playwright sum of a list ${STAMP}`;
const ASSIGNMENT_TITLE = `Playwright Assignment ${STAMP}`;

/** A JavaScript solution: the first line is n, the second n integers; print their sum. */
const SUM_SOLUTION =
  "const [n, ...rest] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(rest.slice(0, n).reduce((a, b) => a + b, 0));";
const WRONG_SOLUTION = "require('fs').readFileSync(0, 'utf8');\nconsole.log(0);";

/*
 * The workspace on a phone: tabs (the editor is behind "Code"), a sticky action bar, and the
 * console as a bottom sheet. On wide screens everything is on show and these do nothing.
 */
async function openEditor(page: Page) {
  const codeTab = page.getByRole('tab', { name: 'Code', exact: true });
  if (await codeTab.isVisible()) await codeTab.click();
}

async function openConsole(page: Page) {
  const button = page.getByRole('button', { name: 'Console', exact: true });
  if (await button.isVisible()) await button.click();
}

async function closeConsole(page: Page) {
  const sheet = page.getByRole('dialog', { name: 'Console' });
  if (await sheet.isVisible()) {
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
  }
}

/** Types into a CodeMirror editor by its accessible name. */
async function typeCode(page: Page, name: string, code: string) {
  const editor = page.getByRole('textbox', { name, exact: true });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await editor.fill(code);
}

/**
 * J-06 and J-09 through the pages: an author writes questions (one checked in the code sandbox),
 * builds an assignment from them, publishes it, and the learner answers both and sees the marks.
 * The coding journeys need the sandbox runner (`apps/runner`) and Docker, as in production.
 */
test.describe('Assignments: the question bank, assignments, reviews and practice', () => {
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

    test('J-06c: write a coding question, check it in the sandbox and add it', async ({ page }) => {
      await page.goto('/admin/question-bank/new');
      await page.getByLabel('Title').fill(CODING_TITLE);
      await page.getByLabel('The question').fill('Read n, then n integers. Print their sum.');
      await page.getByLabel('Type', { exact: true }).selectOption('coding');

      // JavaScript only: tick it first, since the last language cannot be unticked.
      await page.getByRole('checkbox', { name: 'JavaScript', exact: true }).check();
      await page.getByRole('checkbox', { name: 'Java', exact: true }).uncheck();
      await typeCode(page, 'JavaScript reference solution', SUM_SOLUTION);

      await page.getByLabel('Input', { exact: true }).first().fill('3\n1 2 3');
      await page.getByLabel('Expected output', { exact: true }).first().fill('6');
      await page.getByLabel('Input', { exact: true }).nth(1).fill('4\n10 20 30 40');
      await page.getByLabel('Expected output', { exact: true }).nth(1).fill('100');
      await page.getByRole('button', { name: 'Create question' }).click();

      await page.waitForURL(/\/admin\/question-bank\/[0-9a-f-]+$/);
      await page.getByRole('button', { name: 'Run the check' }).click();
      await expect(page.getByText('Passes every case', { exact: true })).toBeVisible({
        timeout: 60_000,
      });
      await page.getByRole('button', { name: 'Publish' }).click();
      await expect(page.getByText('published').first()).toBeVisible();

      await page.goto('/admin/assignments');
      await page.getByLabel('Search assignments').fill(ASSIGNMENT_TITLE);
      await page.getByRole('link', { name: ASSIGNMENT_TITLE }).click();
      await page.waitForURL(/\/admin\/assignments\/[0-9a-f-]+$/);
      await page.getByRole('button', { name: 'Pick questions' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Search the bank').fill(CODING_TITLE);
      await dialog
        .locator('div')
        .filter({ hasText: CODING_TITLE })
        .last()
        .getByRole('button', { name: 'Add' })
        .click();
      await dialog.getByRole('button', { name: 'Done' }).click();
      await page.getByRole('button', { name: 'Save structure' }).click();
      await expect(page.getByText(CODING_TITLE)).toBeVisible();
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

    test('the review queue and the analytics open', async ({ page }) => {
      await page.goto('/admin/reviews');
      await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Waiting' })).toBeVisible();

      await page.goto('/admin/assignments/analytics');
      await expect(page.getByRole('heading', { name: 'Assignment analytics' })).toBeVisible();
      await expect(page.getByText('Submissions each week')).toBeVisible();
    });
  });

  test.describe('a learner answers', () => {
    test.skip(!hasStudent, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD');
    test.use({ storageState: STUDENT_STATE });

    test('J-09: the assignment appears, the answer is marked, the figure moves', async ({
      page,
    }) => {
      // Searched, as a learner would: earlier runs publish more to the batch than one page holds.
      await page.goto(`/assignments?q=${encodeURIComponent(ASSIGNMENT_TITLE)}`);
      const title = page.getByRole('link', { name: ASSIGNMENT_TITLE, exact: true });
      await expect(title).toBeVisible();
      await title.click();

      await page.waitForURL(/\/assignments\/[0-9a-f-]+$/);
      await page.getByRole('link', { name: new RegExp(QUESTION_TITLE) }).click();
      await page.waitForURL(/\/assignments\/[0-9a-f-]+\/q\/[0-9a-f-]+$/);

      await expect(page.getByRole('heading', { name: QUESTION_TITLE })).toBeVisible();
      await page.getByLabel('const', { exact: true }).check();
      await page.getByRole('button', { name: 'Submit answer' }).click();

      await expect(
        page.getByText('const refuses reassignment, though the value may still change.'),
      ).toBeVisible();
      // The link appears above the question and again at the foot of it.
      await page.getByRole('link', { name: 'Back to the assignment' }).first().click();
      await page.waitForURL(/\/assignments\/[0-9a-f-]+$/);
      await expect(page.getByText('1 / 2').first()).toBeVisible();
    });

    test('J-09b: runs a coding answer on the visible cases, then submits it against every case', async ({
      page,
    }) => {
      await page.goto(`/assignments?q=${encodeURIComponent(ASSIGNMENT_TITLE)}`);
      await page.getByRole('link', { name: ASSIGNMENT_TITLE, exact: true }).click();
      await page.waitForURL(/\/assignments\/[0-9a-f-]+$/);
      await page.getByRole('link', { name: new RegExp(CODING_TITLE) }).click();
      await page.waitForURL(/\/assignments\/[0-9a-f-]+\/q\/[0-9a-f-]+$/);
      await expect(page.getByRole('heading', { name: CODING_TITLE })).toBeVisible();
      // The hidden case is counted, never shown.
      await expect(page.getByText(/1 more case is hidden/)).toBeVisible();

      await openEditor(page);
      await typeCode(page, 'Your solution', WRONG_SOLUTION);
      await openConsole(page);
      await page.getByRole('button', { name: 'Run the examples' }).click();
      await expect(page.getByText('1 of 1 visible cases did not pass')).toBeVisible({
        timeout: 60_000,
      });

      await closeConsole(page);
      await typeCode(page, 'Your solution', SUM_SOLUTION);
      // The console now shows the result; the action bar's Run checks the visible cases again.
      await page.getByRole('button', { name: 'Run', exact: true }).click();
      await expect(page.getByText('Every visible case passed')).toBeVisible({ timeout: 60_000 });

      await closeConsole(page);
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      // Checked in the sandbox against every case; the hidden one reports only its verdict.
      await expect(page.getByText('Solved').first()).toBeVisible({ timeout: 90_000 });
      await expect(page.getByText('(hidden)').first()).toBeVisible();
    });

    test('the progress page counts the assignment', async ({ page }) => {
      await page.goto('/progress');
      await expect(page.getByRole('heading', { name: 'Assessment' })).toBeVisible();
      await expect(page.getByText('Assignment questions', { exact: true })).toBeVisible();
      await expect(page.getByText('Not measured yet')).toHaveCount(0);
    });

    test('solves a coding lab in the sandbox and records the verdict', async ({ page }) => {
      // The old practice address still arrives, at the Labs (ADR-0018).
      await page.goto('/practice');
      await expect(page).toHaveURL(/\/labs$/);
      await expect(page.getByRole('heading', { name: 'Labs', exact: true })).toBeVisible();
      // The catalogue is long and ordered by level; find this one by name.
      await page.getByLabel('Search labs').fill('Add two numbers');
      await page.getByRole('link', { name: 'Add two numbers' }).click();

      await page.waitForURL(/\/labs\/add-two-numbers$/);
      await expect(page.getByRole('heading', { name: 'Add two numbers' })).toBeVisible();
      await openEditor(page);
      const language = page.getByLabel('Language', { exact: true });
      if (await language.count()) await language.selectOption('javascript');

      await typeCode(
        page,
        'Your solution',
        "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);",
      );
      await openConsole(page);
      await page.getByRole('button', { name: 'Run the examples' }).click();
      await expect(page.getByText('Every visible case passed')).toBeVisible({ timeout: 60_000 });

      // Your own input asks what the code prints: the output, and no verdict on it.
      await page.getByRole('tab', { name: 'Your own input' }).click();
      await page.getByLabel('Custom input').fill('2 40');
      await page.getByRole('button', { name: 'Run my own input' }).click();
      await expect(page.getByText('Your code ran')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('pre', { hasText: /^42\s*$/ })).toBeVisible();

      await closeConsole(page);
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(page.getByText('Accepted', { exact: true })).toBeVisible({ timeout: 60_000 });
    });

    test('a learner cannot open the staff pages', async ({ page }) => {
      for (const path of ['/admin/assignments', '/admin/reviews', '/trainer/reviews']) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/403$/);
      }
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

      // The tabs appear once the list has loaded; only then is a missing Start link meaningful.
      await expect(page.getByRole('tab', { name: /^Open now/ })).toBeVisible();
      /*
       * "Open now" lists what this learner can start or resume. A test allows one attempt by
       * default, and once they have sat it the journey cannot be walked again without putting the
       * attempt back.
       */
      /*
       * The demo's own tests only: the Phase 2 journeys open tests of their own for this learner
       * (titled "PW P2 …"), whose results are released at once.
       */
      const startable = page
        .locator('article')
        .filter({ has: page.getByRole('link', { name: 'Start' }) })
        .filter({ hasNotText: 'PW P2' });
      test.skip(
        (await startable.count()) === 0,
        'No test this learner can start is open. `demo:advance` opens a window; `demo:reset` also gives back an attempt already used.',
      );
      await startable.first().getByRole('link', { name: 'Start' }).click();

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

  test.describe('a trainer reviews', () => {
    test.skip(!hasTrainer, 'Set E2E_TRAINER_EMAIL and E2E_TRAINER_PASSWORD');
    test.use({ storageState: TRAINER_STATE });

    test('the question bank shows a trainer only their own questions', async ({ page }) => {
      await page.goto('/trainer/question-bank');
      await expect(page.getByRole('heading', { name: 'Question bank' })).toBeVisible();
      await page.getByLabel('Search questions').fill(QUESTION_TITLE);
      await expect(page.getByRole('link', { name: QUESTION_TITLE })).toHaveCount(0);
    });

    test('the review queue opens, and the admin pages stay closed', async ({ page }) => {
      await page.goto('/trainer/reviews');
      await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible();
      await page.goto('/admin/reviews');
      await expect(page).toHaveURL(/\/403$/);
    });
  });
});
