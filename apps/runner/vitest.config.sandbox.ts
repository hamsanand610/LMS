import { defineConfig } from 'vitest/config';

/**
 * Runs real jobs in real containers: needs Docker and the `lms-sandbox:1` image
 * (`docker build -t lms-sandbox:1 infra/sandbox`). Slow by nature, so it is its own suite.
 */
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.sandbox.spec.ts'],
    testTimeout: 180_000,
    fileParallelism: false,
  },
});
