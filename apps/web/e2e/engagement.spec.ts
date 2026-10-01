import { expect, test } from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE, TRAINER_STATE } from './storage';

const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const hasTrainer = Boolean(process.env['E2E_TRAINER_EMAIL'] && process.env['E2E_TRAINER_PASSWORD']);
const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);

/**
 * Task 2 (ADR-0014) through the pages: the learning habits on the dashboard, the leaderboard,
 * interview prep, the drives board, and a doubt asked by a learner and answered by their trainer.
 * Runs against the SI Academy sample data; every journey leaves the data as it found it or adds
 * only rows of its own.
 */
test.describe('Task 2: habits, leaderboard, placement and doubts', () => {
  // One title per run, so the trainer finds exactly the doubt this run asked.
  const doubtTitle = `Why does my loop stop early? (${Date.now()})`;

  test.describe('a learner', () => {
    test.skip(!hasStudent, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD');
    test.use({ storageState: STUDENT_STATE });

    test('sees their streak, their adherence and their place on the board', async ({ page }) => {
      await page.goto('/dashboard');
      const main = page.getByRole('main');
      await expect(main.getByText('Learning streak')).toBeVisible();
      await expect(main.getByText('Class-day adherence')).toBeVisible();
      await expect(main.getByText(/You are #\d+ of \d+/)).toBeVisible();

      await page.goto('/leaderboard');
      await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
      const ranking = page.getByRole('list', { name: 'Ranking' });
      await expect(ranking.locator('[aria-current="true"]')).toContainText('You');
      await expect(page.getByText('How points are counted')).toBeVisible();

      // The rules behind the figures are one click away on the progress page.
      await page.goto('/progress');
      await page.getByText('How the streak and adherence are counted').click();
      await expect(page.getByText('Learning activity is any of:')).toBeVisible();
    });

    test('opens a company’s kit and reaches a problem in the practice workspace', async ({
      page,
    }) => {
      await page.goto('/interview-prep');
      await page.getByRole('link', { name: 'Vellora Systems' }).click();
      await expect(page.getByRole('heading', { name: 'Vellora Systems' })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Strings/ })).toBeVisible();
      await page.getByRole('link', { name: /Reverse a string/ }).click();
      await page.waitForURL(/\/practice\/reverse-a-string$/);
      await expect(page.getByRole('heading', { name: 'Reverse a string' })).toBeVisible();
    });

    test('applies to an open drive, and withdraws again', async ({ page }) => {
      await page.goto('/placements');
      await page.getByRole('link', { name: /Data Analyst Trainee/ }).click();
      await expect(page.getByRole('heading', { name: 'Data Analyst Trainee' })).toBeVisible();

      await page.getByRole('button', { name: 'Apply', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Apply to Harbourline Analytics');
      await dialog.getByRole('button', { name: 'Send application' }).click();
      await expect(page.getByText(/^Applied \d/)).toBeVisible();

      await page.getByRole('button', { name: 'Withdraw my application' }).click();
      await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeVisible();
    });

    test('asks a doubt about a lesson', async ({ page }) => {
      await page.goto('/doubts/new');
      await expect(page.getByRole('heading', { name: 'Ask a doubt' })).toBeVisible();
      await page.getByLabel('Course').selectOption({ label: 'Core Java' });
      await page.getByLabel('Your question in one line').fill(doubtTitle);
      await page
        .getByLabel('The details')
        .fill('My for loop over a list stops before the last element. What should I check?');
      await page.getByRole('button', { name: 'Send to my trainers' }).click();
      await expect(page.getByRole('heading', { name: doubtTitle })).toBeVisible();
      await expect(page.getByText('Waiting for an answer')).toBeVisible();
    });
  });

  test.describe('their trainer', () => {
    test.skip(!hasTrainer || !hasStudent, 'Needs the trainer and the learner accounts');
    test.use({ storageState: TRAINER_STATE });

    test('finds the doubt in the queue and answers it', async ({ page }) => {
      await page.goto('/trainer/doubts');
      await expect(page.getByRole('heading', { name: 'Doubts' })).toBeVisible();
      await page
        .getByRole('link', { name: new RegExp(doubtTitle.replace(/[()?]/g, '\\$&')) })
        .click();
      await expect(page.getByRole('heading', { name: doubtTitle })).toBeVisible();
      await page
        .getByLabel('Your answer')
        .fill('Check the loop condition: use i < list.size(), not i < list.size() - 1.');
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await expect(page.getByText('Answered', { exact: true })).toBeVisible();
    });

    test('ranks only the batches they teach', async ({ page }) => {
      await page.goto('/trainer/leaderboard');
      await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
      await expect(page.getByText(/JFS-2026-B1/).first()).toBeVisible();
    });
  });

  test.describe('an administrator', () => {
    test.skip(!hasAdmin, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
    test.use({ storageState: ADMIN_STATE });

    test('runs the drives board and edits a company’s kit', async ({ page }) => {
      await page.goto('/admin/placements');
      await expect(page.getByRole('heading', { name: 'Drives' })).toBeVisible();
      await page.getByRole('link', { name: 'Associate Software Engineer' }).click();
      await expect(page.getByRole('heading', { name: 'Applicants' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Update/ }).first()).toBeVisible();

      await page.goto('/admin/companies');
      await page.getByRole('link', { name: 'Vellora Systems' }).click();
      await expect(page.getByText('Interview-prep kit')).toBeVisible();
      await expect(page.getByLabel('Topic for Balanced brackets')).toHaveValue('Stacks');
    });

    test('reads the placement figures on the dashboard', async ({ page }) => {
      await page.goto('/admin');
      const main = page.getByRole('main');
      await expect(main.getByRole('button', { name: 'What Students placed means' })).toBeVisible();
    });
  });
});
