import axe from 'axe-core';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STATE, STUDENT_STATE, TRAINER_STATE } from './storage';

const hasAdmin = Boolean(process.env['E2E_ADMIN_EMAIL'] && process.env['E2E_ADMIN_PASSWORD']);
const hasStudent = Boolean(process.env['E2E_STUDENT_EMAIL'] && process.env['E2E_STUDENT_PASSWORD']);
const hasTrainer = Boolean(process.env['E2E_TRAINER_EMAIL'] && process.env['E2E_TRAINER_PASSWORD']);

/*
 * WCAG 2.1 A and AA, checked by axe-core on each role's main pages, at desktop size in the
 * `chromium` project and at phone size in `mobile`. Step 5 (UI refinement) fixed what this found;
 * the spec keeps it fixed. CodeMirror's scroller is left out: it is a third-party element whose
 * editable content takes the keyboard focus itself.
 */
const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const EXCLUDE = ['.cm-scroller'];

async function violations(page: Page, path: string): Promise<string[]> {
  await page.goto(path);
  await expect(page.locator('main h1').first()).toBeVisible();
  // Settled enough once nothing has loaded for half a second; a page that polls never is.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  // The page's own content-security policy refuses inline scripts, hence `bypassCSP` below.
  await page.addScriptTag({ content: axe.source });
  const found = await page.evaluate(
    async ({ rules, exclude }) => {
      const result = await window.axe.run(
        { exclude: exclude.map((selector) => [selector]) },
        { runOnly: { type: 'tag', values: rules }, resultTypes: ['violations'] },
      );
      return result.violations.map(
        (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
      );
    },
    { rules: RULES, exclude: EXCLUDE },
  );
  return found;
}

declare global {
  interface Window {
    axe: typeof axe;
  }
}

test.describe('Accessibility of the main pages (WCAG 2.1 AA, axe-core)', () => {
  test.use({ bypassCSP: true });

  test.describe('the learner', () => {
    test.skip(!hasStudent, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD');
    test.use({ storageState: STUDENT_STATE });

    for (const path of [
      '/dashboard',
      '/courses',
      '/schedule',
      '/assignments',
      '/tests',
      '/progress',
      '/doubts',
      '/placements',
      '/profile',
      '/settings/notifications',
    ]) {
      test(`${path} has no violations`, async ({ page }) => {
        expect(await violations(page, path)).toEqual([]);
      });
    }
  });

  test.describe('the trainer', () => {
    test.skip(!hasTrainer, 'Set E2E_TRAINER_EMAIL and E2E_TRAINER_PASSWORD');
    test.use({ storageState: TRAINER_STATE });

    for (const path of [
      '/trainer',
      '/trainer/students',
      '/trainer/courses',
      '/trainer/reviews',
      '/trainer/schedule',
    ]) {
      test(`${path} has no violations`, async ({ page }) => {
        expect(await violations(page, path)).toEqual([]);
      });
    }
  });

  test.describe('the administrator', () => {
    test.skip(!hasAdmin, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
    test.use({ storageState: ADMIN_STATE });

    for (const path of [
      '/admin',
      '/admin/students',
      '/admin/students/import',
      '/admin/batches',
      '/admin/courses',
      '/admin/placements',
      '/admin/reports',
      '/admin/settings/branding',
    ]) {
      test(`${path} has no violations`, async ({ page }) => {
        expect(await violations(page, path)).toEqual([]);
      });
    }
  });
});
