import { defineConfig } from 'vitest/config';

/** Unit tests: no Docker needed. The sandbox itself is exercised by vitest.config.sandbox.ts. */
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.sandbox.spec.ts'],
  },
});
