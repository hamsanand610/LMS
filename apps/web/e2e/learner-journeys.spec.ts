import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);
const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const API = process.env['E2E_API_URL'] ?? 'http://localhost:4000';

/** The demo learner's batch, and the course the QA fixtures leave one lesson short of complete. */
const BATCH_CODE = 'JFS-2026-B1';
const NEARLY_DONE = 'Programming Foundations';
const IN_PROGRESS = 'Aptitude and Soft Skills';

const STAMP = Date.now();
const MCQ_TITLE = `PW P2 MCQ ${STAMP}`;
const ASSIGNMENT_TITLE = `PW P2 Assignment ${STAMP}`;
const PROJECT_TITLE = `PW P2 Project ${STAMP}`;
const TEST_TITLE = `PW P2 Test ${STAMP}`;
const CLASS_TITLE = `PW P2 Class ${STAMP}`;
const CLASS_NOTES = `Bring your notes from week one (${STAMP}).`;

/**
 * Staff calls that set up what a journey needs, made with the administrator's stored session the
 * way the web app makes them (the CSRF header from its cookie). Nothing here is shown to the
 * learner except through the product's own pages.
 */
async function staffApi() {
  const context: APIRequestContext = await playwrightRequest.newContext({
    storageState: ADMIN_STATE,
  });
  const csrf =
    (await context.storageState()).cookies.find((cookie) => cookie.name === 'lms_csrf')?.value ??
    '';
  async function call<T>(method: string, path: string, data?: unknown): Promise<T> {
    const response = await context.fetch(`${API}/api/v1${path}`, {
      method,
      ...(data === undefined ? {} : { data }),
      headers: { 'x-csrf-token': csrf },
    });
    if (!response.ok()) {
      throw new Error(`${method} ${path} answered ${response.status()}: ${await response.text()}`);
    }
    return (response.status() === 204 ? null : await response.json()) as T;
  }
  return { call, dispose: () => context.dispose() };
}

/** A learner's phone navigation: the tab bar's "More" opens the full menu. */
async function openMenu(page: Page) {
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: 'More' })
    .click();
}

/** Shows the next week when what the test looks for falls after this one. */
async function inThisOrNextWeek(page: Page, text: string) {
  const target = page.getByText(text).first();
  // The week loads after the page; only once it has is a missing entry meaningful.
  const here = await target.waitFor({ state: 'visible', timeout: 10_000 }).then(
    () => true,
    () => false,
  );
  if (here) return target;
  const range = page.locator('[data-week-range]').first();
  const before = (await range.textContent()) ?? '';
  await expect(async () => {
    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(range).not.toHaveText(before, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  return target;
}

/**
 * Roadmap Phase 2, the complete learner experience, through the pages (J1–J18 of the phase plan).
 * The data each journey needs is set up through the API first: an assignment, a project, a test
 * with immediate results and a class, all for the demo learner's batch. Journeys the earlier
 * suites already walk (coding, labs, the profile, placement) are listed in the phase record.
 */
test.describe('Phase 2: learner journeys', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!hasAdmin || !hasStudent, 'Set the E2E_ADMIN_* and E2E_STUDENT_* accounts');

  test.beforeAll(async () => {
    const staff = await staffApi();
    try {
      const batches = await staff.call<{ data: { id: string; code: string }[] }>(
        'GET',
        `/batches?q=${BATCH_CODE}`,
      );
      const batchId = batches.data.find((b) => b.code === BATCH_CODE)!.id;
      const now = Date.now();
      const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

      const mcq = await staff.call<{ id: string }>('POST', '/questions', {
        title: MCQ_TITLE,
        body: 'Which keyword makes a Java variable a constant?',
        type: 'mcq_single',
        subject: 'core-java',
        marks: 2,
        explanation: 'final makes the variable a constant.',
        options: [
          { body: 'static', isCorrect: false },
          { body: 'final', isCorrect: true },
          { body: 'const', isCorrect: false },
        ],
      });
      await staff.call('POST', `/questions/${mcq.id}/status`, { status: 'published' });

      const assignment = await staff.call<{ id: string }>('POST', '/assignments', {
        title: ASSIGNMENT_TITLE,
        subject: 'core-java',
      });
      await staff.call('PUT', `/assignments/${assignment.id}/structure`, {
        modules: [
          { title: 'Basics', unlockRule: { type: 'always' }, questions: [{ questionId: mcq.id }] },
        ],
      });
      await staff.call('POST', `/assignments/${assignment.id}/publish`, {
        batchId,
        opensAt: at(-1),
        dueAt: at(180),
      });

      const brief = await staff.call<{ id: string }>('POST', '/questions', {
        title: `${PROJECT_TITLE} brief`,
        body: 'Build and deploy a responsive landing page for the institute.',
        type: 'project',
        subject: 'html-css',
        marks: 10,
        rubric: 'Layout, responsiveness, accessibility.',
        spec: {
          linkRequired: true,
          linkLabel: 'repository link',
          checklist: ['It works on a phone'],
        },
      });
      await staff.call('POST', `/questions/${brief.id}/status`, { status: 'published' });
      const project = await staff.call<{ id: string }>('POST', '/assignments', {
        title: PROJECT_TITLE,
        subject: 'html-css',
        kind: 'project',
      });
      await staff.call('PUT', `/assignments/${project.id}/structure`, {
        modules: [
          { title: 'Build', unlockRule: { type: 'always' }, questions: [{ questionId: brief.id }] },
        ],
      });
      await staff.call('POST', `/assignments/${project.id}/publish`, {
        batchId,
        opensAt: at(-1),
        dueAt: at(7 * 24 * 60),
      });

      const exam = await staff.call<{ id: string }>('POST', '/tests', {
        title: TEST_TITLE,
        kind: 'weekly',
        subject: 'core-java',
        description: 'Ten minutes on the basics.',
        instructions: 'Answer the one question, then submit.',
        settings: {
          durationMinutes: 15,
          maxAttempts: 1,
          shuffleQuestions: false,
          shuffleOptions: false,
          resultPolicy: 'immediately',
          reviewPolicy: 'full',
          trackTabSwitches: true,
          requireFullScreen: false,
          showRank: true,
        },
      });
      await staff.call('PUT', `/tests/${exam.id}/paper`, {
        sections: [{ title: 'Basics', instructions: '', questions: [{ questionId: mcq.id }] }],
      });
      await staff.call('POST', `/tests/${exam.id}/status`, { status: 'published' });
      await staff.call('POST', `/tests/${exam.id}/schedules`, {
        batchId,
        opensAt: at(-1),
        closesAt: at(24 * 60),
      });

      // A class later today, at a time nothing else of the batch's holds.
      for (let tries = 0; ; tries += 1) {
        try {
          await staff.call('POST', `/batches/${batchId}/sessions`, {
            subject: 'Core Java',
            title: CLASS_TITLE,
            startsAt: at(90 + tries * 45),
            endsAt: at(120 + tries * 45),
            notes: CLASS_NOTES,
          });
          break;
        } catch (error) {
          if (tries >= 10) throw error;
        }
      }
    } finally {
      await staff.dispose();
    }
  });

  test.describe('a learner', () => {
    test.use({ storageState: STUDENT_STATE });

    test('J2: goes from the dashboard to a course and into its next lesson', async ({ page }) => {
      await page.goto('/dashboard');
      await page.getByRole('link', { name: 'Courses', exact: true }).first().click();
      await page.waitForURL(/\/courses$/);
      await page.getByText(IN_PROGRESS, { exact: true }).first().click();
      await page.waitForURL(/\/courses\/[0-9a-f-]+$/);
      await expect(page.getByRole('heading', { name: IN_PROGRESS })).toBeVisible();
      await expect(page.getByText(/\d+% complete/)).toBeVisible();
      await page
        .getByRole('link', { name: /^(Continue|Start the course)$/ })
        .first()
        .click();
      await page.waitForURL(/\/lessons\/[0-9a-f-]+$/);
      await expect(page.getByRole('button', { name: 'Mark complete' })).toBeVisible();
    });

    test('J3: completes the lesson, and the progress page shows the new figure', async ({
      page,
    }) => {
      await page.goto('/courses');
      await page.getByText(IN_PROGRESS, { exact: true }).first().click();
      await page.waitForURL(/\/courses\/[0-9a-f-]+$/);
      await page
        .getByRole('link', { name: /^(Continue|Start the course)$/ })
        .first()
        .click();
      await page.waitForURL(/\/lessons\/[0-9a-f-]+$/);
      await page.getByRole('button', { name: 'Mark complete' }).click();
      const toast = page.getByText(/Marked complete\. You are \d+% through this course\./);
      await expect(toast).toBeVisible();
      const pct = Number(/(\d+)%/.exec((await toast.textContent()) ?? '')![1]);

      await page.goto('/progress');
      const block = page
        .getByRole('listitem')
        .filter({ has: page.getByRole('link', { name: IN_PROGRESS, exact: true }) });
      await expect(block).toContainText(`${pct}%`);
    });

    test('J4: answers an assignment and sees the result at once', async ({ page }) => {
      await page.goto(`/assignments?q=${encodeURIComponent(ASSIGNMENT_TITLE)}`);
      await page.getByRole('link', { name: ASSIGNMENT_TITLE, exact: true }).click();
      await page.waitForURL(/\/assignments\/[0-9a-f-]+$/);
      await page.getByRole('link', { name: new RegExp(MCQ_TITLE) }).click();
      await page.waitForURL(/\/assignments\/[0-9a-f-]+\/q\/[0-9a-f-]+$/);
      await page.getByLabel('final', { exact: true }).check();
      await page.getByRole('button', { name: 'Submit answer' }).click();
      // Solved, so the explanation is shown (the assignment reveals it once solved).
      await expect(page.getByText('final makes the variable a constant.')).toBeVisible();
    });

    test('J5: sits a test, submits it and reads the score; the answers wait for the window', async ({
      page,
    }) => {
      await page.goto('/tests');
      await expect(page.getByRole('tab', { name: /^Open now/ })).toBeVisible();
      const card = page.locator('article').filter({ hasText: TEST_TITLE });
      await card.getByRole('link', { name: 'Start' }).click();
      await page.waitForURL(/\/tests\/[0-9a-f-]+$/);
      await expect(page.getByText('Ten minutes on the basics.')).toBeVisible();
      await page.getByRole('button', { name: 'Start the test' }).click();
      await page.waitForURL(/\/attempt\?attempt=/);
      await page.getByLabel('final', { exact: true }).check();
      await expect(page.getByText(/Saved at/)).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Submit the paper' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
      await page.waitForURL(/\/result/);
      await expect(page.getByLabel('You scored 100%')).toBeVisible();
      await expect(
        page.getByText(/The answers are shown once the test closes for everyone/),
      ).toBeVisible();
    });

    test('J8: finds the class and what is due on the schedule, then their attendance', async ({
      page,
    }) => {
      await page.goto('/schedule');
      await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
      await expect(await inThisOrNextWeek(page, CLASS_TITLE)).toBeVisible();
      await expect(page.getByText(CLASS_NOTES)).toBeVisible();
      const due = page.getByRole('link', { name: new RegExp(ASSIGNMENT_TITLE) });
      await expect(due.first()).toBeVisible();
      await due.first().click();
      await page.waitForURL(/\/assignments\/[0-9a-f-]+$/);
      await expect(page.getByRole('heading', { name: ASSIGNMENT_TITLE })).toBeVisible();

      await page.goto('/attendance');
      await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible();
      await expect(page.getByText('Class by class')).toBeVisible();
    });

    test('J9: asks a doubt, resolves it and reopens it', async ({ page }) => {
      const title = `Why is final not const? ${STAMP}`;
      await page.goto('/doubts/new');
      await page.getByLabel('Course').selectOption({ label: 'Core Java' });
      await page.getByLabel('Your question in one line').fill(title);
      await page.getByLabel('The details').fill('Both seem to mean a value that does not change.');
      await page.getByRole('button', { name: 'Send to my trainers' }).click();
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
      await expect(page.getByText('Waiting for an answer')).toBeVisible();
      await page.getByRole('button', { name: 'Mark resolved' }).click();
      await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
      await page.getByRole('button', { name: 'Reopen' }).click();
      await expect(page.getByRole('button', { name: 'Mark resolved' })).toBeVisible();
    });

    test('J11: finds the project among their projects and opens its brief', async ({ page }) => {
      await page.goto('/projects');
      await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
      await page
        .getByRole('listitem')
        .filter({ hasText: PROJECT_TITLE })
        .getByRole('link', { name: /^Open/ })
        .click();
      await page.waitForURL(/\/assignments\/[0-9a-f-]+$/);
      await expect(page.getByRole('heading', { name: PROJECT_TITLE })).toBeVisible();
      // An ordinary assignment is not a project.
      await page.goto('/projects');
      await expect(page.getByText(ASSIGNMENT_TITLE)).toHaveCount(0);
    });

    test('J12: finishes a course, downloads the certificate and checks it publicly', async ({
      page,
      browser,
    }) => {
      await page.goto('/courses');
      await page.getByText(NEARLY_DONE, { exact: true }).first().click();
      await page.waitForURL(/\/courses\/[0-9a-f-]+$/);
      // Read to the end, lesson by lesson: the player moves on after each one. A later run finds
      // the course already finished and goes straight to the certificate.
      await expect(page.getByText(/\d+% complete/)).toBeVisible();
      if (
        !(await page
          .getByText('100% complete')
          .isVisible()
          .catch(() => false))
      ) {
        await page
          .getByRole('link', { name: /^(Continue|Start the course)$/ })
          .first()
          .click();
        await page.waitForURL(/\/lessons\/[0-9a-f-]+$/);
        for (let lessons = 0; lessons < 40; lessons += 1) {
          const here = page.url();
          const saved = page.waitForResponse(
            (r) =>
              /\/lessons\/[0-9a-f-]+\/complete$/.test(r.url()) && r.request().method() === 'POST',
          );
          await page.getByRole('button', { name: 'Mark complete' }).click();
          const { coursePct } = (await (await saved).json()) as { coursePct: number };
          if (coursePct === 100) break;
          await page.waitForURL((url) => url.href !== here);
        }
        await expect(page.getByText(/You are 100% through this course/)).toBeVisible();
      }

      await page.goto('/certificates');
      const card = page.getByRole('listitem').filter({ hasText: NEARLY_DONE });
      // Issued by a job straight after the course completes; the page is reloaded until it is.
      await expect(async () => {
        await page.reload();
        await expect(card.getByRole('button', { name: 'Download PDF' })).toBeEnabled({
          timeout: 2000,
        });
      }).toPass({ timeout: 30_000 });
      const code = ((await card.locator('.font-mono').textContent()) ?? '').trim();
      expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);

      const download = page.waitForEvent('download');
      await card.getByRole('button', { name: 'Download PDF' }).click();
      expect((await download).suggestedFilename()).toMatch(/^Certificate - .+\.pdf$/);

      // Anyone may check it, signed in or not.
      const visitor = await browser.newContext();
      try {
        const check = await visitor.newPage();
        await check.goto(`/verify/${code}`);
        await expect(
          check.getByRole('heading', { name: 'This certificate is genuine' }),
        ).toBeVisible();
        await expect(check.getByText(NEARLY_DONE)).toBeVisible();
        await check.goto('/verify/0000-0000-0000');
        await expect(
          check.getByRole('heading', { name: 'No certificate has this code' }),
        ).toBeVisible();
      } finally {
        await visitor.close();
      }
    });

    test('J13: opens a notification and lands on what it is about', async ({ page }) => {
      await page.goto('/notifications');
      const notice = page
        .getByRole('listitem')
        .filter({ hasText: `New assignment: ${ASSIGNMENT_TITLE}` });
      await expect(notice).toBeVisible();
      await notice.getByRole('link', { name: 'Open' }).click();
      await page.waitForURL(/\/assignments\/[0-9a-f-]+$/);
      await expect(page.getByRole('heading', { name: ASSIGNMENT_TITLE })).toBeVisible();
      // Opening it read it.
      await page.goto('/notifications');
      await expect(notice.getByRole('button', { name: 'Mark read' })).toHaveCount(0);
    });

    test('J14: searches and opens what they find', async ({ page }) => {
      await page.goto(`/search?q=${encodeURIComponent(PROJECT_TITLE)}`);
      await page
        .getByRole('link', { name: new RegExp(PROJECT_TITLE) })
        .first()
        .click();
      await page.waitForURL(/\/assignments\/[0-9a-f-]+$/);
      await expect(page.getByRole('heading', { name: PROJECT_TITLE })).toBeVisible();

      await page.goto(`/search?q=${encodeURIComponent(IN_PROGRESS)}`);
      // A course hit reads "<title> <n>% complete".
      await page
        .getByRole('link', { name: new RegExp(`^${IN_PROGRESS}`) })
        .first()
        .click();
      await page.waitForURL(/\/courses\/[0-9a-f-]+$/);
      await expect(page.getByRole('heading', { name: IN_PROGRESS })).toBeVisible();
    });

    test('J15: reaches their documents, and downloads one they hold', async ({ page }) => {
      await page.goto('/profile/documents');
      await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
      await expect(page.getByLabel('What is it?')).toBeVisible();
      const downloads = page.getByRole('button', { name: 'Download', exact: true });
      if ((await downloads.count()) > 0) {
        const response = page.waitForResponse((r) =>
          /\/me\/documents\/[0-9a-f-]+\/download$/.test(r.url()),
        );
        await downloads.first().click();
        expect([200, 404]).toContain((await response).status());
      } else {
        await expect(page.getByText('Nothing uploaded yet')).toBeVisible();
      }
    });

    test('J17: on a phone, the navigation holds the new pages and nothing scrolls sideways', async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, 'The phone layout: run with --project=mobile');
      for (const path of ['/dashboard', '/schedule', '/certificates', '/projects', '/attendance']) {
        await page.goto(path);
        await expect(page.locator('main').first()).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
      }
      await page.goto('/dashboard');
      await openMenu(page);
      for (const name of ['Certificates', 'Projects', 'Attendance']) {
        await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible();
      }
      await page.getByRole('link', { name: 'Certificates', exact: true }).first().click();
      await page.waitForURL(/\/certificates$/);
      await expect(page.getByRole('heading', { name: 'Certificates', exact: true })).toBeVisible();
    });

    test('J18: switches between dark and light, and the choice stays', async ({ page }) => {
      await page.goto('/dashboard');
      const html = page.locator('html');
      const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const choose = async (mode: 'Dark' | 'Light') => {
        const toggle = page.getByRole('button', { name: /theme \(click to change\)$/ });
        if (await toggle.isVisible()) {
          await expect(async () => {
            await toggle.click();
            await expect(html).toHaveAttribute('data-theme', mode.toLowerCase(), { timeout: 1000 });
          }).toPass({ timeout: 15_000 });
          return;
        }
        await openMenu(page);
        await page
          .getByRole('radiogroup', { name: 'Theme' })
          .getByRole('radio', { name: mode })
          .click();
        await expect(html).toHaveAttribute('data-theme', mode.toLowerCase());
        await page.keyboard.press('Escape');
      };
      const luminance = (rgb: string) => {
        const [r, g, b] = (rgb.match(/\d+/g) ?? ['0', '0', '0']).map(Number);
        return (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255;
      };

      await choose('Dark');
      expect(luminance(await background())).toBeLessThan(0.25);
      await page.reload();
      await expect(html).toHaveAttribute('data-theme', 'dark');
      await choose('Light');
      expect(luminance(await background())).toBeGreaterThan(0.75);
      await page.reload();
      await expect(html).toHaveAttribute('data-theme', 'light');
    });
  });
});
