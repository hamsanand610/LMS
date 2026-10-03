import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Locator,
} from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);
const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const API = process.env['E2E_API_URL'] ?? 'http://localhost:4000';

/**
 * SI Academy AI in the browser (Phase 7C), against an API whose provider is the local fake with its
 * words paced (`AI_PROVIDER=fake`, `AI_FAKE_DELAY_MS`), so streaming can be watched. The Super
 * Admin's stored session switches the flags; everything the learner does goes through the page.
 */
test.describe('SI Academy AI (Phase 7C)', () => {
  test.skip(!hasAdmin || !hasStudent, 'Set the E2E_ADMIN_* and E2E_STUDENT_* variables');
  test.describe.configure({ mode: 'serial' });

  let staff: APIRequestContext;
  let csrf = '';

  async function setFlag(key: string, enabled: boolean) {
    const response = await staff.fetch(`${API}/api/v1/flags/${key}`, {
      method: 'PATCH',
      data: { enabled },
      headers: { 'x-csrf-token': csrf },
    });
    expect(response.ok(), `flag ${key}`).toBe(true);
  }

  async function answerLengths(answer: Locator, until: (text: string) => boolean) {
    const seen: number[] = [];
    for (let i = 0; i < 200; i += 1) {
      const text = (await answer.textContent()) ?? '';
      seen.push(text.length);
      if (until(text)) break;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return seen;
  }

  test.beforeAll(async () => {
    staff = await playwrightRequest.newContext({ storageState: ADMIN_STATE });
    csrf =
      (await staff.storageState()).cookies.find((cookie) => cookie.name === 'lms_csrf')?.value ??
      '';
  });
  test.afterAll(async () => {
    await setFlag('ai.workspace', false);
    await setFlag('module.ai', false);
    await staff.dispose();
  });

  test.use({ storageState: STUDENT_STATE });

  test('the AI page does not exist while SI Academy AI is off', async ({ page }) => {
    await setFlag('ai.workspace', false);
    await setFlag('module.ai', false);
    const response = await page.goto('/ai');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  test('streams an answer as it is written, and keeps it', async ({ page }) => {
    await setFlag('module.ai', true);
    await setFlag('ai.workspace', true);
    const response = await page.goto('/ai');
    expect(response?.status()).toBe(200);
    await page.getByLabel('Your question').fill('What is a class in Java?');
    await page.getByRole('button', { name: 'Send' }).click();

    const answer = page.locator('li[data-role="assistant"]').last();
    const full = 'Fake chat answer to: What is a class in Java?';
    const lengths = await answerLengths(answer.locator('p').nth(1), (text) => text === full);
    // The words arrived one after another: the page showed the answer part-written first.
    expect(lengths.some((length) => length > 0 && length < full.length)).toBe(true);
    await expect(answer).toHaveAttribute('data-status', 'complete');
    await expect(answer).toContainText(full);
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  });

  test('stops an answer mid-way, and the next question is answered', async ({ page }) => {
    await page.goto('/ai');
    await page
      .getByLabel('Your question')
      .fill(
        'Explain inheritance, polymorphism, encapsulation and abstraction in Java, with an example of each one',
      );
    await page.getByRole('button', { name: 'Send' }).click();
    const answer = page.locator('li[data-role="assistant"]').last();
    await expect(answer).toContainText('Fake chat answer');
    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(answer).toHaveAttribute('data-status', 'cancelled');
    await expect(answer).toContainText('Stopped.');

    // The server let go of the answer when the reader left: the next one goes through.
    await page.getByLabel('Your question').fill('And what is an interface?');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('li[data-role="assistant"]').last()).toHaveAttribute(
      'data-status',
      'complete',
    );
  });

  test('refuses a second question while one is being answered, in another tab', async ({
    context,
  }) => {
    const first = await context.newPage();
    const second = await context.newPage();
    await first.goto('/ai');
    await second.goto('/ai');
    await first
      .getByLabel('Your question')
      .fill('Describe every collection in the Java collections framework and when to use each one');
    await first.getByRole('button', { name: 'Send' }).click();
    await expect(first.locator('li[data-role="assistant"]').last()).toContainText(
      'Fake chat answer',
    );

    await second.getByLabel('Your question').fill('Me too');
    await second.getByRole('button', { name: 'Send' }).click();
    await expect(second.getByRole('status')).toContainText('still being answered');
    // The refused question was not kept: it is back where it was typed.
    await expect(second.getByLabel('Your question')).toHaveValue('Me too');
    await expect(second.locator('li[data-role="user"]')).toHaveCount(0);

    await expect(first.locator('li[data-role="assistant"]').last()).toHaveAttribute(
      'data-status',
      'complete',
      { timeout: 20_000 },
    );
  });

  test('fits a phone screen without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/ai');
    await page.getByLabel('Your question').fill('Short question');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('li[data-role="assistant"]').last()).toHaveAttribute(
      'data-status',
      'complete',
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
