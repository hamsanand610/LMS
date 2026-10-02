import { expect, test, type Page } from '@playwright/test';
import { STUDENT_STATE, TRAINER_STATE } from './storage';

const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const hasTrainer = Boolean(process.env['E2E_TRAINER_EMAIL'] && process.env['E2E_TRAINER_PASSWORD']);

const STAMP = Date.now();
const LAB_TITLE = `Playwright web lab ${STAMP}`;
const API = process.env['E2E_API_URL'] ?? 'http://localhost:4000';

/** Types into a CodeMirror editor by its accessible name. */
async function typeCode(page: Page, name: string, code: string) {
  const editor = page.getByRole('textbox', { name, exact: true });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await editor.fill(code);
}

/** On a phone the workspace is behind tabs; on a wide screen everything is on show already. */
async function openWork(page: Page, name: 'Code' | 'Page') {
  // The workspace has loaded once its Lab tab is there, on a phone and on a wide screen alike.
  await expect(page.getByRole('tab', { name: 'Lab', exact: true })).toBeVisible();
  const tab = page.getByRole('tab', { name, exact: true });
  if (await tab.isVisible()) await tab.click();
}

/** On a phone a run's result opens in the console sheet, which covers the page until it closes. */
async function closeConsole(page: Page) {
  const sheet = page.getByRole('dialog', { name: 'Console' });
  if (await sheet.isVisible()) {
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
  }
}

/**
 * Roadmap Phase 1 through the pages: a trainer writes a web lab, keeps it as a draft, previews it,
 * checks it in the sandbox, publishes it and lists it; a learner finds it, works on it, runs its
 * checks, submits it, sees the attempt and the progress; a lab placed in a course completes its
 * lesson; and a learner is kept out of the staff pages. Every check runs in the sandbox runner
 * (apps/runner) and Docker, as in production; the preview only shows the page.
 */
test.describe('Labs and Playground', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('a trainer writes a lab', () => {
    test.skip(!hasTrainer, 'Set E2E_TRAINER_EMAIL and E2E_TRAINER_PASSWORD');
    test.use({ storageState: TRAINER_STATE });

    test('1–2: writes a web lab and keeps it as a draft', async ({ page }) => {
      await page.goto('/trainer/labs');
      await expect(page.getByRole('heading', { name: 'Labs', exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Web lab' }).click();
      await page.waitForURL(/\/trainer\/question-bank\/new\?type=web$/);
      await expect(page.getByLabel('Type')).toHaveValue('web');

      await page.getByLabel('Title').fill(LAB_TITLE);
      await page
        .getByLabel('The question', { exact: true })
        .fill('Give the page a heading that says hello.');
      // A new web lab starts from a page with a heading and a check for it.
      await expect(
        page.getByText('Learners read: At least 1 element matches `h1`').first(),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Create question' }).click();
      await page.waitForURL(/\/trainer\/question-bank\/[0-9a-f-]+$/);
      await expect(page.getByText('Draft').first()).toBeVisible();
    });

    test('3: previews the lab as learners will see it, running its checks in the sandbox', async ({
      page,
    }) => {
      await page.goto('/trainer/labs?q=');
      await page.getByLabel('Search labs').fill(LAB_TITLE);
      await page.getByRole('link', { name: LAB_TITLE, exact: true }).click();
      await page.waitForURL(/\/trainer\/labs\/[0-9a-f-]+\/preview$/);
      await expect(page.getByText('This is the lab as learners see it')).toBeVisible();
      await openWork(page, 'Page');
      await page.getByRole('button', { name: 'Run checks' }).click();
      await expect(page.getByText('Every check passed')).toBeVisible({ timeout: 90_000 });
      // Nothing is recorded in a preview: there is no Submit.
      await expect(page.getByRole('button', { name: 'Submit', exact: true })).toHaveCount(0);
    });

    test('4: checks it, publishes it and puts it in the Labs', async ({ page }) => {
      await page.goto('/trainer/labs');
      await page.getByLabel('Search labs').fill(LAB_TITLE);
      await page.getByRole('link', { name: `Edit ${LAB_TITLE}` }).click();
      await page.waitForURL(/\/trainer\/question-bank\/[0-9a-f-]+$/);

      await page.getByRole('button', { name: 'Run the check' }).click();
      await expect(page.getByText('Passes every case', { exact: true })).toBeVisible({
        timeout: 90_000,
      });
      await page.getByRole('button', { name: 'Publish' }).click();
      await expect(page.getByText('Published').first()).toBeVisible();

      await page.getByRole('checkbox', { name: 'Offer it in the Labs' }).check();
      await page.getByRole('button', { name: 'Save catalogue settings' }).click();
      await expect(page.getByText('In the Labs catalogue', { exact: true })).toBeVisible();
    });
  });

  test.describe('a learner does the lab', () => {
    test.skip(!hasStudent || !hasTrainer, 'Needs the trainer’s lab and a student');
    test.use({ storageState: STUDENT_STATE });

    test('5–6: finds the lab in the catalogue and opens it', async ({ page }) => {
      await page.goto('/labs');
      await page.getByRole('tab', { name: /^Web/ }).click();
      await page.getByLabel('Search labs').fill(LAB_TITLE);
      await page.getByRole('link', { name: LAB_TITLE, exact: true }).click();
      await page.waitForURL(/\/labs\/playwright-web-lab-\d+$/);
      await expect(page.getByRole('heading', { name: LAB_TITLE })).toBeVisible();
      await expect(page.getByText('What is checked')).toBeVisible();
    });

    test('7–9: changes the page, previews it, runs the checks and submits', async ({ page }) => {
      await page.goto('/labs');
      await page.getByLabel('Search labs').fill(LAB_TITLE);
      await page.getByRole('link', { name: LAB_TITLE, exact: true }).click();
      await openWork(page, 'Page');

      await page.getByRole('tab', { name: 'script.js' }).click();
      await typeCode(page, 'Your page: script.js', "console.log('page ready');");
      await page.getByRole('button', { name: 'Preview' }).click();
      const preview = page.frameLocator('iframe[title="Preview of your page"]');
      await expect(preview.getByRole('heading', { name: 'Hello' })).toBeVisible();
      await expect(page.getByRole('list', { name: 'What your page logged' })).toContainText(
        'page ready',
      );

      await page.getByRole('button', { name: 'Run checks' }).click();
      await expect(page.getByText('Every check passed')).toBeVisible({ timeout: 90_000 });

      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(page.getByText('Accepted', { exact: true })).toBeVisible({ timeout: 90_000 });
      await expect(page.getByText('First solve')).toBeVisible();
    });

    test('10–11: finds the attempt recorded and the lab solved', async ({ page }) => {
      await page.goto('/labs');
      await page.getByLabel('Search labs').fill(LAB_TITLE);
      const row = page.getByRole('row', { name: new RegExp(LAB_TITLE) });
      await expect(row.getByText('Solved')).toBeVisible();
      await page.getByRole('link', { name: LAB_TITLE, exact: true }).click();
      await page.getByRole('tab', { name: 'Submissions' }).click();
      await page.getByRole('button', { name: 'Open', exact: true }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText("console.log('page ready');");
      await expect(dialog).toContainText('cases passed');
    });

    test('a lab in a course completes its lesson when it is passed', async ({ page }) => {
      await page.goto('/courses');
      await page
        .getByRole('link', { name: /Core Java/ })
        .first()
        .click();
      // The lab is in the first module, which is shown folded once it is finished. Only once the
      // outline has loaded does a hidden link mean a folded module.
      const firstModule = page.locator('summary', { hasText: 'The language' });
      await expect(firstModule).toBeVisible();
      const lessonLink = page.getByRole('link', { name: /Lab: fix the average/ }).first();
      if (!(await lessonLink.isVisible())) await firstModule.click();
      await lessonLink.click();
      await expect(
        page
          .getByText('This lesson completes itself once you pass its lab')
          .or(page.getByText('Done', { exact: true })),
      ).toBeVisible();
      await page.getByRole('link', { name: /Open the lab/ }).click();
      await page.waitForURL(/\/lessons\/[0-9a-f-]+\/lab$/);
      const complete = page.getByText('This lesson is complete.');
      await expect(
        complete.or(page.getByText('Passing this lab completes the lesson.')),
      ).toBeVisible();
      // A learner who has already passed it (an earlier run) has nothing left to do here.
      if (await complete.isVisible()) return;

      await openWork(page, 'Code');
      await typeCode(
        page,
        'Your solution',
        'import java.util.*;\n\npublic class Main {\npublic static void main(String[] args) {\nScanner in = new Scanner(System.in);\nint n = in.nextInt();\nint total = 0;\nfor (int i = 0; i < n; i++) total += in.nextInt();\nSystem.out.printf("%.2f%n", (double) total / n);\n}\n}\n',
      );
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(page.getByText('Lesson complete').first()).toBeVisible({ timeout: 90_000 });
      await closeConsole(page);
      await page.getByRole('link', { name: 'Back to the lesson' }).click();
      await expect(page.getByText('Done', { exact: true })).toBeVisible();
    });

    test('the playground runs code in the sandbox', async ({ page }) => {
      await page.goto('/labs/playground');
      await page.getByLabel('Language').selectOption('python');
      await typeCode(page, 'Your code', 'print(sum(map(int, input().split())))');
      await page.getByLabel('Input').fill('20 22');
      await page.getByRole('button', { name: 'Run', exact: true }).click();
      await expect(page.locator('pre', { hasText: /^42\s*$/ })).toBeVisible({ timeout: 90_000 });
    });

    test('12: a learner cannot open the staff side of the Labs', async ({ page, playwright }) => {
      for (const path of ['/trainer/labs', '/admin/labs']) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/403$/);
      }
      // Nor reach its API with the learner's session.
      const listing = await page.request.get(`${API}/api/v1/practice/labs`);
      expect(listing.status()).toBe(403);
      // And without one, nothing at all. The state is empty on purpose: under the test runner a new
      // context would otherwise take the stored session.
      const anonymous = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });
      expect((await anonymous.get(`${API}/api/v1/practice/problems`)).status()).toBe(401);
      await anonymous.dispose();
    });
  });

  /**
   * The preview frame's isolation in a real browser (ADR-0019): the learner's page runs with an
   * opaque origin under its own policy, so it reaches nothing of the platform.
   */
  test.describe('the Web Lab preview is isolated', () => {
    test.skip(!hasStudent, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD');
    test.use({ storageState: STUDENT_STATE });

    test('no cookies, storage, parent, network, forms, popups or navigation', async ({ page }) => {
      const response = await page.goto('/labs/web-profile-card');
      // The app's own policy is unchanged: no frames from anywhere.
      expect(response?.headers()['content-security-policy']).toContain("frame-src 'none'");
      await openWork(page, 'Page');

      // The browser may start a request for the page's own markup (an <img>, say) and then refuse
      // it under the frame's policy. What matters is that nothing is answered: no request from the
      // frame reaches any server, and every one it starts fails as blocked.
      const answered: string[] = [];
      const blocked: string[] = [];
      page.on('response', (response) => {
        if (response.frame() !== page.mainFrame() && !response.url().startsWith('data:')) {
          answered.push(response.url());
        }
      });
      page.on('requestfailed', (request) => {
        if (request.frame() !== page.mainFrame()) {
          blocked.push(request.failure()?.errorText ?? 'failed');
        }
      });

      await page.getByRole('tab', { name: 'index.html' }).click();
      await typeCode(
        page,
        'Your page: index.html',
        `<h1>Probe</h1>
<script src="${API}/api/v1/me"></script>
<img src="${API}/api/v1/me?beacon=1" alt="">
<form id="f" action="${API}/api/v1/auth/logout" method="post"><button>Go</button></form>`,
      );
      await page.getByRole('tab', { name: 'script.js' }).click();
      await typeCode(
        page,
        'Your page: script.js',
        `const out = [];
const tryIt = (name, fn) => { try { out.push(name + ':' + fn()); } catch (e) { out.push(name + ':' + e.name); } };
tryIt('origin', () => window.origin);
tryIt('cookie', () => document.cookie);
tryIt('storage', () => localStorage.length);
tryIt('session', () => sessionStorage.length);
tryIt('parent', () => parent.document.title);
tryIt('popup', () => String(window.open('${API}/api/v1/me')));
tryIt('top', () => { top.location.href = '/dashboard'; return 'moved'; });
fetch('${API}/api/v1/me', { credentials: 'include' })
  .then(() => console.log('fetch:allowed'))
  .catch(() => console.log('fetch:blocked'))
  .finally(() => console.log(out.join(' ')));
document.getElementById('f').requestSubmit();`,
      );
      const url = page.url();
      await page.getByRole('button', { name: 'Preview' }).click();

      const logged = page.getByRole('list', { name: 'What your page logged' });
      await expect(logged).toContainText('fetch:blocked');
      await expect(logged).toContainText('origin:null');
      await expect(logged).toContainText('cookie:SecurityError');
      await expect(logged).toContainText('storage:SecurityError');
      await expect(logged).toContainText('session:SecurityError');
      await expect(logged).toContainText('parent:SecurityError');
      await expect(logged).toContainText('popup:null');
      await expect(logged).not.toContainText('top:moved');

      // The frame is sandboxed with scripts only, and its document starts with its own policy.
      const frame = page.locator('iframe[title="Preview of your page"]');
      await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
      expect(await frame.getAttribute('srcdoc')).toContain("default-src 'none'");
      // Nothing left the frame, and the learner is still where they were.
      await page.waitForTimeout(1000);
      expect(answered).toEqual([]);
      for (const reason of blocked) expect(reason).toMatch(/^csp$|BLOCKED_BY_CSP/i);
      expect(page.url()).toBe(url);
    });
  });
});
