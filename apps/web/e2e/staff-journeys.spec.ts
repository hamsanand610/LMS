import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE, TRAINER_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);
const hasTrainer = Boolean(process.env['E2E_TRAINER_EMAIL'] && process.env['E2E_TRAINER_PASSWORD']);
const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const trainerEmail = process.env['E2E_TRAINER_EMAIL'] ?? '';
/** The batch the demo's trainer teaches (and the one they do not). */
const TAUGHT_BATCH = 'JFS-2026-B1';

/** Names unique to this run and this project, so the desktop and phone runs never collide. */
function named(label: string): string {
  return `${label} ${test.info().project.name} ${Date.now().toString().slice(-6)}`;
}

/** The audit log, narrowed to one action, holds an entry whose summary mentions `text`. */
async function expectAudited(page: Page, action: string, text: string | RegExp) {
  await page.goto('/admin/settings/audit-log');
  await page.getByLabel('Filter by action').fill(action);
  await expect(page.getByRole('row').filter({ hasText: text }).first()).toBeVisible();
}

/**
 * Phases 3 and 4: the trainer and the administrator as operational roles, walked through the pages
 * on a desktop and a phone. The API tests prove each rule from both sides; these prove the pages
 * reach those rules — a course handed to a trainer, an announcement to the trainer's own batch, a
 * learner seen within the trainer's batches, the Super Admin's records and privacy operations.
 */
test.describe('Phases 3–4: staff journeys', () => {
  test.describe.configure({ mode: 'serial' });
  let courseTitle = '';

  test.describe('an administrator hands a course to a trainer', () => {
    test.skip(!hasAdmin || !hasTrainer, 'Set the E2E_ADMIN_* and E2E_TRAINER_* variables');
    test.use({ storageState: ADMIN_STATE });

    test('creates a course and names its staff; the audit log records it', async ({ page }) => {
      courseTitle = named('Staffed course');
      await page.goto('/admin/courses');
      await page.getByRole('button', { name: 'New course' }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Title').fill(courseTitle);
      await dialog.getByRole('button', { name: /create/i }).click();
      await page.waitForURL(/\/admin\/courses\/[0-9a-f-]+/);

      await page.getByRole('tab', { name: 'Details' }).click();
      await page.getByRole('button', { name: 'Change staff' }).click();
      const staff = page.getByRole('dialog');
      await staff.getByRole('checkbox', { name: new RegExp(trainerEmail) }).check();
      await staff.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('list', { name: 'Course staff' }).getByText(/./)).toHaveCount(1);

      await expectAudited(page, 'course.staff_changed', /staff/i);
    });
  });

  test.describe('the trainer works within what they were given', () => {
    test.skip(!hasTrainer, 'Set E2E_TRAINER_EMAIL and E2E_TRAINER_PASSWORD');
    test.use({ storageState: TRAINER_STATE });

    test('finds the course among theirs, as one they edit', async ({ page }) => {
      test.skip(!courseTitle, 'Needs the course the administrator staffed');
      await page.goto('/trainer/courses');
      const row = page.getByRole('row').filter({ hasText: courseTitle });
      await expect(row).toBeVisible();
      await expect(row.getByText('You edit this')).toBeVisible();
    });

    test('reads a course they do not teach, without links into the student portal', async ({
      page,
    }) => {
      await page.goto('/trainer/courses');
      const reading = page
        .getByRole('main')
        .getByRole('row')
        .filter({ has: page.locator('a[href^="/trainer/courses/"]') })
        .filter({ hasNotText: 'You edit this' })
        .first();
      await expect(page.getByRole('main').getByRole('row').nth(1)).toBeVisible();
      test.skip((await reading.count()) === 0, 'Needs a course this trainer does not teach');
      await reading.locator('a[href^="/trainer/courses/"]').first().click();
      await expect(page.getByRole('heading', { name: 'Curriculum' })).toBeVisible();
      // The learner's buttons and lesson links lead to student pages, which a trainer is refused.
      await expect(
        page.locator(
          'main a[href^="/courses"], main a[href^="/assignments"], main a[href^="/doubts"]',
        ),
      ).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'All courses' })).toHaveAttribute(
        'href',
        '/trainer/courses',
      );
    });

    test('announces to a batch they teach, and only there', async ({ page }) => {
      const title = named('Lab moved');
      await page.goto('/trainer/announcements');
      await page.getByRole('button', { name: 'New announcement' }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Title').fill(title);
      await dialog.getByLabel('Message').fill('Thursday’s lab is in room 4.');
      // Only the batches they teach are offered, and nothing wider than a batch.
      await expect(dialog.getByRole('checkbox', { name: 'JFS-2026-B2' })).toHaveCount(0);
      await dialog.getByRole('checkbox', { name: TAUGHT_BATCH }).check();
      await dialog.getByRole('button', { name: 'Create announcement' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByText(title)).toBeVisible();
    });

    test('reads a learner of their batch, without the administrator’s pages', async ({ page }) => {
      await page.goto('/trainer/students');
      await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible();
      const first = page.getByRole('main').getByRole('row').nth(1).getByRole('link').first();
      await first.click();
      await page.waitForURL(/\/trainer\/students\/[0-9a-f-]+/);
      await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
    });

    test('finds the Super Admin’s and the administrator’s screens closed', async ({ page }) => {
      for (const path of ['/admin/settings/general', '/admin/settings/audit-log', '/admin/users']) {
        await page.goto(path);
        await expect(page).not.toHaveURL(new RegExp(`${path}$`));
      }
    });
  });

  test.describe('the Super Admin keeps the records', () => {
    test.skip(!hasAdmin, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
    test.use({ storageState: ADMIN_STATE });

    test('names a certificate signatory, kept for certificates issued from now on', async ({
      page,
    }) => {
      await page.goto('/admin/settings/general');
      const signatory = page.getByLabel('Certificate signatory');
      await signatory.fill('Dr Meera Nair');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByText('Settings saved')).toBeVisible();
      await page.reload();
      await expect(page.getByLabel('Certificate signatory')).toHaveValue('Dr Meera Nair');
      // Back as it was, so the sample institute keeps its own settings.
      await page.getByLabel('Certificate signatory').fill('');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByText('Settings saved').first()).toBeVisible();
    });

    test('a flag change is recorded in the audit log', async ({ page }) => {
      await page.goto('/admin/settings/feature-flags');
      // Feedback is the module no other journey uses, so the moment it is off disturbs nobody.
      const toggle = page.getByRole('switch', { name: 'Toggle module.feedback' });
      const before = await toggle.getAttribute('aria-checked');
      await toggle.click();
      await expect(toggle).not.toHaveAttribute('aria-checked', before ?? '');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', before ?? '');
      await expectAudited(page, 'flags', /module\.feedback/);
    });

    test('a permission change is recorded in the audit log', async ({ page }) => {
      const suffix = `${test.info().project.name}_${Date.now().toString().slice(-6)}`;
      const name = `E2E reader ${suffix}`;
      await page.goto('/admin/settings/roles');
      await page.getByRole('button', { name: 'New role' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Key').fill(`e2e_reader_${suffix}`);
      await dialog.getByLabel('Name').fill(name);
      await dialog.getByRole('button', { name: 'Create role' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await page.getByRole('combobox', { name: `search:use for ${name}` }).click();
      await page.getByRole('option', { name: 'own', exact: true }).click();
      await page.getByRole('button', { name: 'Save', exact: true, disabled: false }).click();
      await expect(page.getByText(/Permissions saved/)).toBeVisible();

      await expectAudited(page, 'rbac.bundle_updated', `Permissions of ${name} updated`);
    });

    test('lists failed background jobs beside system health', async ({ page }) => {
      await page.goto('/admin/settings/system-health');
      await expect(page.getByText('Failed jobs')).toBeVisible();
    });

    test('exports a learner’s data and erases it, on request', async ({ page }) => {
      const email = `e2e-privacy-${test.info().project.name}-${Date.now()}@siacademy.example`;
      await page.goto('/admin/students');
      await page.getByRole('button', { name: 'New student' }).click();
      await page.getByLabel('Full name').fill('Privacy Request');
      await page.getByLabel('Email', { exact: true }).fill(email);
      await page.getByRole('button', { name: 'Add student' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByLabel('Search students').fill(email);
      const row = page.getByRole('row').filter({ hasText: email });
      await expect(row).toHaveCount(1);
      await row.getByRole('link').click();
      await page.waitForURL(/\/admin\/students\/[0-9a-f-]+$/);

      await page.getByRole('tab', { name: 'Privacy' }).click();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export data' }).click();
      expect((await download).suggestedFilename()).toMatch(/^learner-data-.+\.json$/);

      await page.getByRole('button', { name: 'Erase…' }).click();
      const dialog = page.getByRole('dialog');
      const erase = dialog.getByRole('button', { name: 'Erase permanently' });
      await expect(erase).toBeDisabled();
      await dialog.getByLabel('E-mail address').fill(email);
      await dialog.getByLabel('Reason').fill('Asked to be forgotten, by e-mail');
      await erase.click();
      await page.waitForURL(/\/admin\/students$/);
      await page.getByLabel('Search students').fill(email);
      await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(0);
    });
  });

  test.describe('a learner', () => {
    test.skip(!hasStudent, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD');
    test.use({ storageState: STUDENT_STATE });

    test('cannot reach a staff screen by its address', async ({ page }) => {
      for (const path of ['/trainer', '/trainer/students', '/admin/certificates']) {
        await page.goto(path);
        await expect(page).not.toHaveURL(new RegExp(`${path}$`));
      }
    });
  });
});
