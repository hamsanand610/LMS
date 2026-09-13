import { defineConfig } from 'vitest/config';

/**
 * API tests boot the real Nest application against a dedicated PostgreSQL database
 * (`lms_test`, created and migrated by test/setup/global-setup.ts). Files run one at a time
 * because they share that database.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
