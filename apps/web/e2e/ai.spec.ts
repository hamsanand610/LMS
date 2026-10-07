import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE, TRAINER_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);
const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const hasTrainer = Boolean(process.env['E2E_TRAINER_EMAIL'] && process.env['E2E_TRAINER_PASSWORD']);
const API = process.env['E2E_API_URL'] ?? 'http://localhost:4000';

/*
 * What the journeys open: a course the demo learner is enrolled in and its first lesson, a lab they
 * tried and did not pass, and a lab they have not tried. Set them for another data set; the
 * defaults are the demo seed's. The course is found by its slug, since every seeding gives it and
 * its lessons new ids (a fresh database, as CI's, had none of the ids once written here).
 */
const COURSE_SLUG = process.env['E2E_AI_COURSE_SLUG'] ?? 'core-java';
const FAILED_LAB = process.env['E2E_AI_FAILED_LAB'] ?? 'balanced-brackets';
const UNTRIED_LAB = process.env['E2E_AI_UNTRIED_LAB'] ?? 'count-the-words';
const FLAGS = ['module.ai', 'ai.workspace', 'ai.assistant', 'ai.lab_hints'];
/** The learning agent's flag (Phase 9D): on only for its own journeys, off again after them. */
const AGENT_FLAG = 'ai.agent';

const phone = () => test.info().project.name === 'mobile';

/**
 * SI Academy AI in the browser (Phase 7E): the workspace, the launcher and the assistant beside a
 * course or lesson, a lab's AI Hint, and the Super Admin's and a trainer's pages — on a desktop and
 * a phone. The API's provider is the local fake with its words paced (`AI_PROVIDER=fake`,
 * `AI_FAKE_DELAY_MS`), and course material and learners' own work are approved
 * (`AI_DATA_CLASSES=public,course,personal`). No real provider is called.
 */
test.describe('SI Academy AI (Phase 7E)', () => {
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

  /** Every text the answer showed until it was whole: proof that it arrived part by part. */
  async function watchAnswer(answer: Locator, full: RegExp) {
    const seen: string[] = [];
    for (let i = 0; i < 300; i += 1) {
      const text = (await answer.locator('p').nth(1).textContent()) ?? '';
      seen.push(text);
      if (full.test(text)) break;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    return seen;
  }

  /** The learner's course by its slug, and the first lesson of its first module. */
  async function courseAndLesson(page: Page) {
    const mine = await page.request.get(`${API}/api/v1/me/courses`);
    expect(mine.ok(), 'the learner’s courses').toBe(true);
    const courses = (await mine.json()) as { courseId: string; slug: string }[];
    const course = courses.find((item) => item.slug === COURSE_SLUG)?.courseId;
    expect(course, `the learner is enrolled in ${COURSE_SLUG}`).toBeDefined();
    const outline = await page.request.get(`${API}/api/v1/courses/${course}`);
    expect(outline.ok(), `${COURSE_SLUG}'s outline`).toBe(true);
    const { modules } = (await outline.json()) as { modules: { lessons: { id: string }[] }[] };
    const lesson = modules[0]?.lessons[0]?.id;
    expect(lesson, `${COURSE_SLUG}'s first lesson`).toBeDefined();
    return { course: course!, lesson: lesson! };
  }

  async function ask(scope: Page | Locator, question: string) {
    await scope.getByLabel(/Your question|What you are stuck on/).fill(question);
    await scope.getByRole('button', { name: 'Send' }).click();
  }

  async function noSidewaysScroll(page: Page) {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }

  test.beforeAll(async () => {
    staff = await playwrightRequest.newContext({ storageState: ADMIN_STATE });
    csrf =
      (await staff.storageState()).cookies.find((cookie) => cookie.name === 'lms_csrf')?.value ??
      '';
  });
  test.afterAll(async () => {
    for (const key of [...FLAGS, AGENT_FLAG]) await setFlag(key, false);
    await staff.dispose();
  });

  test.use({ storageState: STUDENT_STATE });

  test('nothing of SI Academy AI shows while it is off', async ({ page }) => {
    for (const key of FLAGS) await setFlag(key, false);
    const response = await page.goto('/ai');
    expect(response?.status()).toBe(404);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ask SI Academy AI' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'SI Academy AI' })).toHaveCount(0);
  });

  test('the launcher opens the assistant, out of the way of the page', async ({ page }) => {
    for (const key of FLAGS) await setFlag(key, true);
    await page.goto('/dashboard');
    const launcher = page.getByRole('button', { name: 'Ask SI Academy AI', exact: true });
    await expect(launcher).toBeVisible();
    if (phone()) {
      // Above the learner's tab bar, never on it.
      const bar = await page.getByRole('navigation', { name: 'Sections' }).boundingBox();
      const button = await launcher.boundingBox();
      if (bar && button) expect(button.y + button.height).toBeLessThanOrEqual(bar.y);
    }
    await launcher.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('dialog');
    await expect(panel.getByText('Ask about what you are learning.')).toBeVisible();
    await ask(panel, 'What is a variable?');
    await expect(panel.locator('li[data-role="assistant"]').last()).toHaveAttribute(
      'data-status',
      'complete',
    );
    await expect(panel).toContainText('Fake chat answer to: What is a variable?');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await noSidewaysScroll(page);
  });

  test('the workspace: a new conversation streams, stops, returns from history, and is deleted', async ({
    page,
  }) => {
    await page.goto('/ai');
    await expect(page.getByRole('heading', { name: 'SI Academy AI' })).toBeVisible();
    const question = 'What is a class in Java?';
    await ask(page, question);
    const answer = page.locator('li[data-role="assistant"]').last();
    const seen = await watchAnswer(answer, /^Fake chat answer to: What is a class in Java\?$/);
    // The words arrived one after another: the answer was shown part-written first.
    const full = `Fake chat answer to: ${question}`;
    expect(seen.some((text) => text.length > 0 && text !== full && full.startsWith(text))).toBe(
      true,
    );
    await expect(answer).toHaveAttribute('data-status', 'complete');
    await expect(page).toHaveURL(/\/ai\?c=[0-9a-f-]{36}$/);
    const address = page.url();

    // Stop: the answer ends where it was, and the next question is answered.
    await ask(
      page,
      'Explain inheritance, polymorphism, encapsulation and abstraction in Java, with an example of each one',
    );
    await expect(page.locator('li[data-role="assistant"]').last()).toContainText('Fake chat');
    await page.getByRole('button', { name: 'Stop the answer' }).click();
    await expect(page.locator('li[data-role="assistant"]').last()).toHaveAttribute(
      'data-status',
      'cancelled',
    );
    await expect(page.locator('li[data-role="assistant"]').last()).toContainText('Stopped.');
    await expect(page.getByLabel('Your question')).toBeEditable();

    // History: the conversation comes back as it was kept.
    await page.goto(address);
    await expect(page.locator('li[data-role="user"]').first()).toContainText(question);
    await expect(page.locator('li[data-role="assistant"]').first()).toContainText(full);
    if (phone()) {
      await page.getByRole('button', { name: 'Conversations' }).click();
      const drawer = page.getByRole('dialog');
      await expect(drawer.getByRole('heading', { name: 'Your conversations' })).toBeVisible();
      await expect(drawer.locator('li [aria-current="true"]')).toHaveCount(1);
      await page.keyboard.press('Escape');
    } else {
      const history = page.getByRole('complementary', { name: 'Your conversations' });
      await expect(history.locator('li [aria-current="true"]')).toHaveCount(1);
    }

    // Delete: gone from the screen at once, before the server answers (by design), and from the
    // server once it has answered — asked any sooner, it may still have it (CI run #29).
    const id = address.split('c=')[1]!;
    await page.getByRole('button', { name: 'Delete this conversation' }).click();
    const deleted = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        response.url().endsWith(`/api/v1/ai/conversations/${id}`),
    );
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/ai$/);
    await expect(page.getByText('What are you learning today?')).toBeVisible();
    expect((await deleted).ok(), 'the server deleted it').toBe(true);
    const gone = await page.request.get(`${API}/api/v1/ai/conversations/${id}`);
    expect(gone.status()).toBe(404);
    await noSidewaysScroll(page);
  });

  test('the assistant beside a course and a lesson asks about them', async ({ page }) => {
    const { course, lesson } = await courseAndLesson(page);
    await page.goto(`/courses/${course}`);
    const about = page.getByRole('button', { name: /About this course/ });
    await expect(about).toBeVisible();
    await about.click();
    let panel = page.getByRole('dialog');
    await expect(panel.getByText(/^About this course: /)).toBeVisible();
    await ask(panel, 'What does this course cover first?');
    await expect(panel.locator('li[data-role="assistant"]').last()).toHaveAttribute(
      'data-status',
      'complete',
    );
    await page.keyboard.press('Escape');

    await page.goto(`/courses/${course}/lessons/${lesson}`);
    await page.getByRole('button', { name: 'Ask SI Academy AI about this lesson' }).click();
    panel = page.getByRole('dialog');
    await expect(panel.getByText(/^About this lesson: /)).toBeVisible();
    await ask(panel, 'Explain this lesson in one line');
    await expect(panel.locator('li[data-role="assistant"]').last()).toHaveAttribute(
      'data-status',
      'complete',
    );
    await expect(panel).toContainText('Fake chat answer to: Explain this lesson in one line');
    await noSidewaysScroll(page);
  });

  test('a lab’s AI Hint waits for a failed attempt, and then hints', async ({ page }) => {
    await page.goto(`/labs/${UNTRIED_LAB}`);
    await page.getByRole('button', { name: 'AI Hint' }).click();
    let panel = page.getByRole('dialog');
    await expect(
      panel.getByText('AI Hint — helps you reason about the problem without giving the solution.'),
    ).toBeVisible();
    await expect(panel.getByText('Try the lab first.')).toBeVisible();
    await expect(panel.getByLabel('What you are stuck on')).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.goto(`/labs/${FAILED_LAB}`);
    // No floating launcher over the editor: the lab has its own AI Hint.
    await expect(page.getByRole('button', { name: 'Ask SI Academy AI', exact: true })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: 'AI Hint' }).click();
    panel = page.getByRole('dialog');
    await ask(panel, 'Why does my bracket check fail?');
    await expect(panel.locator('li[data-role="assistant"]').last()).toHaveAttribute(
      'data-status',
      'complete',
    );
    await expect(panel).toContainText('Fake hint answer to: Why does my bracket check fail?');
    await noSidewaysScroll(page);
  });

  test('the learning agent beside a lesson: its questions, its steps, a verified answer and its sources', async ({
    page,
  }) => {
    for (const key of [...FLAGS, AGENT_FLAG]) await setFlag(key, true);
    const { course, lesson } = await courseAndLesson(page);
    await page.goto(`/courses/${course}/lessons/${lesson}`);
    await page.getByRole('button', { name: 'Ask SI Academy AI about this lesson' }).click();
    const panel = page.getByRole('dialog');
    const suggestions = panel.getByRole('list', { name: 'Suggested questions' });
    await expect(suggestions).toBeVisible();
    for (const question of [
      'Explain this lesson',
      'What should I learn next?',
      'How am I progressing?',
      'Why am I struggling with this topic?',
    ]) {
      await expect(suggestions.getByRole('button', { name: question })).toBeVisible();
    }
    // Asked with one click: what the agent does is said in fixed words, then the run ends.
    const runs = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/ai\/agent\/conversations\/[^/]+\/runs$/.test(response.url()),
    );
    await suggestions.getByRole('button', { name: 'What should I learn next?' }).click();
    expect((await runs).ok()).toBe(true);
    const answer = panel.locator('li[data-role="assistant"]').last();
    await expect(answer).toHaveAttribute('data-status', 'complete');
    // A verified answer with its sources, or the platform's own words — never anything else.
    const text = (await answer.textContent()) ?? '';
    if (/Sources/.test(text)) {
      await expect(answer.getByRole('list', { name: 'Sources' })).toContainText('Your progress');
    } else {
      expect(text).toMatch(/SI Academy AI/);
    }
    expect(text).not.toMatch(/learning_state|lab_attempt|knowledge_search|"arguments"/);
    await noSidewaysScroll(page);
  });

  test('“Explain my failed attempt” beside a lab the learner did not pass, and not beside one untried', async ({
    page,
  }) => {
    await setFlag(AGENT_FLAG, true);
    await page.goto(`/labs/${UNTRIED_LAB}`);
    await expect(page.getByRole('button', { name: 'AI Hint' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Explain my failed attempt' })).toHaveCount(0);

    await page.goto(`/labs/${FAILED_LAB}`);
    await page.getByRole('button', { name: 'Explain my failed attempt' }).click();
    const panel = page.getByRole('dialog');
    await expect(panel.getByText(/never the solution/)).toBeVisible();
    // It asks once, by itself: the learner's question, then the agent's answer.
    await expect(panel.locator('li[data-role="user"]').first()).toContainText(
      'Explain my failed attempt',
    );
    const answer = panel.locator('li[data-role="assistant"]').last();
    await expect(answer).toHaveAttribute('data-status', 'complete');
    await expect(answer.getByRole('list', { name: 'Sources' })).toContainText(
      'Your latest failed attempt',
    );
    expect((await answer.textContent()) ?? '').not.toContain('```');
    await noSidewaysScroll(page);
  });

  test('the workspace starts and continues learning agent conversations', async ({ page }) => {
    await setFlag(AGENT_FLAG, true);
    await page.goto('/ai');
    await page.getByRole('button', { name: 'Ask the learning agent' }).click();
    const suggestions = page.getByRole('list', { name: 'Suggested questions' });
    await expect(suggestions).toBeVisible();
    await suggestions.getByRole('button', { name: 'What should I learn next?' }).click();
    const answer = page.locator('li[data-role="assistant"]').last();
    await expect(answer).toHaveAttribute('data-status', 'complete');
    await expect(page).toHaveURL(/\/ai\?c=[0-9a-f-]{36}$/);
    // Back from history: the conversation is the learning agent's, and is continued as one.
    await page.goto(page.url());
    await expect(page.locator('li[data-role="user"]').first()).toContainText(
      'What should I learn next?',
    );
    // The conversation's own label, beside its title (not the button that starts one).
    await expect(page.getByText('Learning agent', { exact: true }).first()).toBeVisible();
    await ask(page, 'How am I progressing?');
    await expect(page.locator('li[data-role="assistant"]').last()).toHaveAttribute(
      'data-status',
      'complete',
    );
    await setFlag(AGENT_FLAG, false);
    await noSidewaysScroll(page);
  });

  test('the Super Admin sets SI Academy AI up and reads its usage', async ({ browser }) => {
    test.skip(phone(), 'The management pages are checked on a desktop');
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await context.newPage();
    try {
      await page.goto('/admin/settings/ai');
      await expect(page.getByRole('heading', { name: 'AI settings' })).toBeVisible();
      await expect(page.getByText('Model service')).toBeVisible();
      await expect(page.getByLabel('Questions per person per day')).toBeVisible();
      await page.getByRole('button', { name: 'Save AI settings' }).click();
      await expect(page.getByText('AI settings saved.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'AI usage' })).toBeVisible();

      await page.goto('/admin/ai-usage');
      await expect(page.getByRole('heading', { name: 'AI usage' })).toBeVisible();
      await expect(page.getByText(/Costs are estimates/)).toBeVisible();
      await expect(page.getByText('Questions', { exact: true }).first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('a trainer reads their batches’ usage and cannot reach the settings', async ({
    browser,
  }) => {
    test.skip(phone() || !hasTrainer, 'Set the E2E_TRAINER_* variables; checked on a desktop');
    const context = await browser.newContext({ storageState: TRAINER_STATE });
    const page = await context.newPage();
    try {
      await page.goto('/trainer/ai-usage');
      await expect(page.getByRole('heading', { name: 'AI usage' })).toBeVisible();
      await expect(page.getByText(/Costs are estimates/)).toBeVisible();
      await expect(page.getByText('Monthly budget')).toHaveCount(0);
      const settings = await page.request.get(`${API}/api/v1/ai/admin/settings`);
      expect(settings.status()).toBe(403);
    } finally {
      await context.close();
    }
  });
});
