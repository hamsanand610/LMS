import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE, TRAINER_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);
const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const hasTrainer = Boolean(process.env['E2E_TRAINER_EMAIL'] && process.env['E2E_TRAINER_PASSWORD']);
const API = process.env['E2E_API_URL'] ?? 'http://localhost:4000';
const FLAGS = ['module.ai', 'ai.knowledge', 'ai.knowledge_answers'];

/**
 * The Knowledge base page in the browser (Roadmap Phase 10; ADR-0043): the Super Admin creates a
 * source, uploads a document, publishes it, watches it read and indexed, inspects its passages,
 * tries a question and reads the answer with its citation, then deletes it all. Trainers and
 * learners reach none of it. The API's provider is the local fake (`AI_PROVIDER=fake`); nothing
 * real is called.
 */
test.describe('The Knowledge base page (Phase 10)', () => {
  test.skip(!hasAdmin, 'Set the E2E_ADMIN_* variables');
  test.describe.configure({ mode: 'serial' });

  let staff: APIRequestContext;
  let csrf = '';
  const unique = `${Date.now().toString(36)}`;
  const subject = `quillon${unique} lantern`;

  async function setFlag(key: string, enabled: boolean) {
    const response = await staff.fetch(`${API}/api/v1/flags/${key}`, {
      method: 'PATCH',
      data: { enabled },
      headers: { 'x-csrf-token': csrf },
    });
    expect(response.ok(), `flag ${key}`).toBe(true);
  }

  test.beforeAll(async () => {
    staff = await playwrightRequest.newContext({ storageState: ADMIN_STATE });
    csrf =
      (await staff.storageState()).cookies.find((cookie) => cookie.name === 'lms_csrf')?.value ??
      '';
    for (const key of FLAGS) await setFlag(key, true);
  });
  test.afterAll(async () => {
    for (const key of FLAGS) await setFlag(key, false);
    await staff.dispose();
  });

  test.use({ storageState: ADMIN_STATE });

  test('a document uploaded, published, indexed, answered from, and deleted', async ({ page }) => {
    test.skip(
      test.info().project.name === 'mobile',
      'The management pages are checked on a desktop',
    );
    await page.goto('/admin/knowledge');
    await expect(page.getByRole('heading', { name: 'Knowledge base' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Knowledge base' }).first()).toBeVisible();

    // A new source, for everyone in the institute.
    await page.getByRole('button', { name: 'New source' }).click();
    const create = page.getByRole('dialog');
    await create.getByLabel('Name').fill(`Handbook ${unique}`);
    await create.getByLabel('Who may draw on it').selectOption('institute');
    await create.getByRole('button', { name: 'Create source' }).click();
    await expect(page.getByRole('heading', { name: `Handbook ${unique}` })).toBeVisible();

    // A Markdown file uploaded: read at once, indexed once published.
    await page.getByRole('button', { name: 'Upload document' }).first().click();
    const upload = page.getByRole('dialog');
    await upload.getByLabel('File').setInputFiles({
      name: 'lantern-notes.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(`# Lantern notes\n\nThe ${subject} glows green after sunset.\n`),
    });
    await expect(upload.getByLabel('Title')).toHaveValue('Lantern notes');
    await upload.getByRole('button', { name: 'Upload' }).click();
    const row = page.getByRole('row', { name: /Lantern notes/ });
    await expect(row).toBeVisible();
    await expect(row.getByText(/^(Read|Reading)$/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(row.getByText('Ready')).toBeVisible({ timeout: 30_000 });

    // Its passages, as SI Academy AI is given them.
    await row.getByRole('button', { name: 'Lantern notes' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText(`The ${subject} glows green after sunset.`)).toBeVisible();
    await page.keyboard.press('Escape');

    // A question tried: answered from the document, with its citation.
    await page.getByRole('tab', { name: 'Try a question' }).click();
    await page.getByLabel('Question').fill(`What colour does the ${subject} glow?`);
    await page.getByRole('button', { name: 'Ask' }).click();
    await expect(page.getByText('Answered from the documents')).toBeVisible();
    await expect(page.getByText('Lantern notes', { exact: true }).last()).toBeVisible();

    // Deleted: nothing of it is drawn on again.
    await page.getByRole('tab', { name: 'Documents' }).click();
    await row.getByRole('button', { name: 'Actions for Lantern notes' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete for good' }).click();
    await expect(page.getByText('No documents yet')).toBeVisible();
    const after = await page.request.post(`${API}/api/v1/ai/knowledge/preview`, {
      data: { query: `What colour does the ${subject} glow?` },
      headers: {
        'x-csrf-token':
          (await page.context().cookies()).find((cookie) => cookie.name === 'lms_csrf')?.value ??
          '',
      },
    });
    expect(after.ok()).toBe(true);
    expect(((await after.json()) as { status: string }).status).toBe('insufficient_evidence');

    // The source deleted too: back to the list.
    await page.getByRole('button', { name: `More actions for Handbook ${unique}` }).click();
    await page.getByRole('menuitem', { name: 'Delete source' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete for good' }).click();
    await expect(page).toHaveURL(/\/admin\/knowledge$/);
    await expect(page.getByRole('link', { name: `Handbook ${unique}` })).toHaveCount(0);
  });

  test('trainers and learners reach none of it', async ({ browser }) => {
    test.skip(test.info().project.name === 'mobile', 'Checked on a desktop');
    for (const [state, present] of [
      [TRAINER_STATE, hasTrainer],
      [STUDENT_STATE, hasStudent],
    ] as const) {
      if (!present) continue;
      const context = await browser.newContext({ storageState: state });
      const page = await context.newPage();
      try {
        const sources = await page.request.get(`${API}/api/v1/ai/knowledge/sources`);
        expect(sources.status()).toBe(403);
        const response = await page.goto('/admin/knowledge');
        expect(page.url().includes('/admin/knowledge') ? response?.status() : 404).toBe(404);
      } finally {
        await context.close();
      }
    }
  });
});
