import { defineConfig, devices } from '@playwright/test';

/**
 * Browser journeys against a running stack (web on 3000, API on 4000 by default).
 * Credentials come from the environment only (E2E_ADMIN_* / E2E_TRAINER_*), and the `setup`
 * project turns them into a stored session the other specs reuse.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
    /*
     * Phone emulation is a separate project rather than part of the default run: the two together
     * double the load on the dev server, and the responsive pass belongs to Phase 6. Run it with
     * `pnpm --filter @lms/web exec playwright test --project=mobile`.
     */
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
});
